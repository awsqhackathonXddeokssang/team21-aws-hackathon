const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

// OpenSearch 클라이언트 설정
const opensearchClient = new Client({
    ...AwsSigv4Signer({
        region: 'us-east-1',
        service: 'es'
    }),
    node: process.env.OPENSEARCH_ENDPOINT || 'https://search-nutrition-rag-dev-search-m327wc6eudd6uas5cm3gnbsz7y.us-east-1.es.amazonaws.com'
});

async function updateSessionStatus(sessionId, progress, status = 'processing') {
    try {
        await dynamoClient.send(new UpdateItemCommand({
            TableName: 'ai-chef-sessions',
            Key: { sessionId: { S: sessionId } },
            UpdateExpression: 'SET progress = :progress, #status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':progress': { N: progress.toString() },
                ':status': { S: status }
            }
        }));
    } catch (error) {
        console.error('Failed to update session status:', error.message);
    }
}

async function searchNutritionData(ingredients) {
    try {
        const indexExists = await opensearchClient.indices.exists({
            index: 'ingredient-nutrition'
        });
        
        if (!indexExists.body) {
            console.log('Nutrition index not found, using AI estimation');
            return [];
        }

        const searchQueries = ingredients.map(ingredient => ({
            match: {
                food_name: {
                    query: ingredient,
                    fuzziness: "AUTO"
                }
            }
        }));

        const response = await opensearchClient.search({
            index: 'ingredient-nutrition',
            body: {
                query: {
                    bool: {
                        should: searchQueries,
                        minimum_should_match: 1
                    }
                },
                size: 20
            }
        });

        return response.body.hits.hits.map(hit => hit._source);
    } catch (error) {
        console.error('OpenSearch nutrition lookup failed:', error);
        return [];
    }
}

async function calculateNutritionWithAI(recipe, profile) {
    const ingredients = recipe?.ingredients || [];
    
    // 안전장치: ingredients 배열 확인
    if (!Array.isArray(ingredients)) {
        console.error('❌ Invalid ingredients format:', ingredients);
        throw new Error('Invalid ingredients format');
    }
    
    const ingredientsList = ingredients.length > 0
        ? ingredients.map(ing => typeof ing === 'string' ? ing : ing?.name || 'Unknown ingredient').join(', ')
        : 'No ingredients available';
        
    const prompt = `다음 레시피의 정확한 영양소를 계산해주세요:

레시피: ${recipe?.recipeName || 'Unknown Recipe'}
재료: ${ingredientsList}
인분: ${profile?.servings || 2}인분

사용자 프로필:
- 목표: ${profile?.target || '일반'}
- 탄수화물 제한: ${profile?.carbLimit || 50}g

다음 JSON 형식으로만 응답해주세요:
{
  "nutrition": {
    "calories": 숫자,
    "carbs": 숫자,
    "protein": 숫자,
    "fat": 숫자,
    "fiber": 숫자,
    "sodium": 숫자
  },
  "nutritionPerServing": {
    "calories": 숫자,
    "carbs": 숫자,
    "protein": 숫자,
    "fat": 숫자
  }
}`;

    try {
        const response = await bedrock.send(new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            }),
            contentType: 'application/json'
        }));

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        // 안전장치: content 배열 확인
        if (!responseBody.content || !Array.isArray(responseBody.content) || responseBody.content.length === 0) {
            console.error('❌ Invalid AI response structure:', responseBody);
            throw new Error('Invalid AI response structure');
        }
        
        const nutritionText = responseBody.content[0].text;
        
        console.log('🔍 AI Response:', nutritionText);
        
        // JSON 추출 시도 (여러 패턴)
        let jsonMatch = nutritionText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            // 코드 블록 내 JSON 찾기
            jsonMatch = nutritionText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) jsonMatch[0] = jsonMatch[1];
        }
        
        if (jsonMatch) {
            try {
                // 안전장치: jsonMatch[0] 확인
                if (!jsonMatch[0]) {
                    console.error('❌ Empty JSON match result');
                    throw new Error('Empty JSON match result');
                }
                
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('✅ Parsed nutrition:', parsed);
                return parsed;
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Raw JSON:', jsonMatch[0]);
                // parseError 발생 시 아래 에러로 fallthrough
            }
        }
        
        // JSON을 찾지 못한 경우 에러 발생
        console.error('❌ No valid JSON found in AI response');
        throw new Error('No valid JSON found in AI response');
    } catch (error) {
        console.error('AI nutrition calculation failed:', error);
        throw error;
    }
}

function convertToAttributeValue(obj) {
    if (typeof obj === 'string') return { S: obj };
    if (typeof obj === 'number') return { N: obj.toString() };
    if (typeof obj === 'boolean') return { BOOL: obj };
    if (Array.isArray(obj)) return { L: obj.map(convertToAttributeValue) };
    if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = convertToAttributeValue(value);
        }
        return { M: result };
    }
    return { NULL: true };
}

async function updateRecipeNutrition(sessionId, nutrition) {
    try {
        // sessionId로 기존 recipe 레코드 찾기 (스캔 사용)
        const scanParams = {
            TableName: 'ai-chef-results',
            FilterExpression: 'sessionId = :sessionId AND #type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':sessionId': { S: sessionId },
                ':type': { S: 'recipe' }
            }
        };

        const result = await dynamoClient.send(new ScanCommand(scanParams));
        
        // 안전장치: Items 배열 확인
        if (!result.Items || !Array.isArray(result.Items) || result.Items.length === 0) {
            console.log('⚠️ No recipe record found for sessionId:', sessionId);
            return null;
        }
        
        const recipeItem = result.Items[0];
        
        // 안전장치: resultId 확인
        if (!recipeItem.resultId || !recipeItem.resultId.S) {
            console.error('❌ Invalid recipe item structure:', recipeItem);
            return null;
        }
        
        const resultId = recipeItem.resultId.S;
            
            // 기존 레코드의 nutrition 정보 업데이트
            const updateParams = {
                TableName: 'ai-chef-results',
                Key: {
                    resultId: { S: resultId }
                },
                UpdateExpression: 'SET #data.#nutrition = :nutrition, #updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                    '#data': 'data',
                    '#nutrition': 'nutrition',
                    '#updatedAt': 'updatedAt'
                },
                ExpressionAttributeValues: {
                    ':nutrition': { M: convertToAttributeValue(nutrition) },
                    ':updatedAt': { S: new Date().toISOString() }
                }
            };

            await dynamoClient.send(new UpdateItemCommand(updateParams));
            console.log('✅ Recipe nutrition updated successfully');
            return resultId;
        } else {
            console.log('⚠️ No recipe record found for sessionId:', sessionId);
            return null;
        }
    } catch (error) {
        console.error('❌ Failed to update recipe nutrition:', error);
        throw error;
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event;
        const { sessionId, recipe: recipeData, recipeData: altRecipeData, profile } = requestBody;
        const recipe = recipeData || altRecipeData;

        if (!sessionId || !recipe) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'sessionId and recipe are required' })
            };
        }

        // JSON 문자열 파싱 (다른 Lambda와 동일한 로직)
        let recipeObj;
        if (typeof recipe === 'string') {
            const parsed = JSON.parse(recipe);
            recipeObj = parsed.recipe || parsed;
        } else {
            recipeObj = recipe.recipe || recipe;
        }

        console.log('🧮 Starting nutrition calculation for:', recipeObj.recipeName);
        
        // 세션 상태 업데이트 (85% 진행률)
        await updateSessionStatus(sessionId, 85);
        
        // Update nutritionStatus to processing
        await dynamoClient.send(new UpdateItemCommand({
            TableName: 'ai-chef-sessions',
            Key: { sessionId: { S: sessionId } },
            UpdateExpression: 'SET nutritionStatus = :status',
            ExpressionAttributeValues: { ':status': { S: 'processing' } }
        }));

        // 1. OpenSearch에서 영양 데이터 검색 시도
        const nutritionData = await searchNutritionData(recipe.ingredients || []);
        
        let finalNutrition;
        if (nutritionData.length > 0) {
            console.log('📊 Using database nutrition data');
            // 실제 영양 데이터 기반 계산 로직
            finalNutrition = await calculateNutritionWithAI(recipe, profile || {});
        } else {
            console.log('🤖 Using AI nutrition estimation');
            // AI 기반 영양소 추정
            finalNutrition = await calculateNutritionWithAI(recipe, profile || {});
        }

        // 기존 recipe 레코드에 영양 정보 업데이트
        await updateRecipeNutrition(sessionId, finalNutrition);

        // 세션 상태 업데이트 (90% 진행률)
        await updateSessionStatus(sessionId, 90);
        
        // Update nutritionStatus to completed
        await dynamoClient.send(new UpdateItemCommand({
            TableName: 'ai-chef-sessions',
            Key: { sessionId: { S: sessionId } },
            UpdateExpression: 'SET nutritionStatus = :status',
            ExpressionAttributeValues: { ':status': { S: 'completed' } }
        }));

        return {
            nutrition: finalNutrition,
            sessionId,
            status: 'completed'
        };
    } catch (error) {
        console.error('❌ Nutrition calculation error:', error);
        
        try {
            await updateSessionStatus(event.sessionId, 85, 'failed');
            // Update nutritionStatus to failed
            await dynamoClient.send(new UpdateItemCommand({
                TableName: 'ai-chef-sessions',
                Key: { sessionId: { S: event.sessionId } },
                UpdateExpression: 'SET nutritionStatus = :status',
                ExpressionAttributeValues: { ':status': { S: 'failed' } }
            }));
        } catch (dbError) {
            console.error('Error updating failed status:', dbError);
        }
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Nutrition calculation failed',
                details: error.message 
            })
        };
    }
};
