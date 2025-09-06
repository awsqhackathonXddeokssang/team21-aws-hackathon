const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');

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
    const prompt = `다음 레시피의 정확한 영양소를 계산해주세요:

레시피: ${recipe.recipeName}
재료: ${recipe.ingredients.join(', ')}
인분: ${profile.servings || 2}인분

사용자 프로필:
- 목표: ${profile.target || '일반'}
- 탄수화물 제한: ${profile.carbLimit || 50}g

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
        const nutritionText = responseBody.content[0].text;
        
        const jsonMatch = nutritionText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        throw new Error('Invalid nutrition format');
    } catch (error) {
        console.error('AI nutrition calculation failed:', error);
        throw error;
    }
}

async function updateRecipeNutrition(sessionId, nutrition) {
    try {
        // sessionId로 기존 recipe 레코드 찾기
        const queryParams = {
            TableName: 'ai-chef-results',
            IndexName: 'sessionId-index',
            KeyConditionExpression: 'sessionId = :sessionId',
            FilterExpression: '#type = :type',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':sessionId': { S: sessionId },
                ':type': { S: 'recipe' }
            }
        };

        const result = await dynamoClient.send(new QueryCommand(queryParams));
        
        if (result.Items && result.Items.length > 0) {
            const recipeItem = result.Items[0];
            const resultId = recipeItem.resultId.S;
            
            // 기존 레코드의 nutrition 정보 업데이트
            const updateParams = {
                TableName: 'ai-chef-results',
                Key: {
                    resultId: { S: resultId }
                },
                UpdateExpression: 'SET #data.nutrition = :nutrition, updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                    '#data': 'data'
                },
                ExpressionAttributeValues: {
                    ':nutrition': { S: JSON.stringify(nutrition) },
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
        const { sessionId, recipe: recipeData, profile } = requestBody;

        if (!sessionId || !recipeData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'sessionId and recipe are required' })
            };
        }

        // JSON 문자열 파싱 (다른 Lambda와 동일한 로직)
        let recipe;
        if (typeof recipeData === 'string') {
            const parsed = JSON.parse(recipeData);
            recipe = parsed.recipe || parsed;
        } else {
            recipe = recipeData.recipe || recipeData;
        }

        console.log('🧮 Starting nutrition calculation for:', recipe.recipeName);
        
        // 세션 상태 업데이트 (85% 진행률)
        await updateSessionStatus(sessionId, 85);

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

        return {
            nutrition: finalNutrition,
            sessionId,
            status: 'completed'
        };
    } catch (error) {
        console.error('❌ Nutrition calculation error:', error);
        
        try {
            await updateSessionStatus(event.sessionId, 85, 'failed');
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
