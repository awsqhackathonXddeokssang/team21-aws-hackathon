const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');
const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

// OpenSearch 클라이언트 설정
const opensearchClient = new Client({
    ...AwsSigv4Signer({
        region: 'us-east-1',
        service: 'es'
    }),
    node: process.env.OPENSEARCH_ENDPOINT
});

async function getSessionProfile(sessionId) {
    try {
        const response = await dynamoClient.send(new GetItemCommand({
            TableName: 'ai-chef-sessions',
            Key: {
                sessionId: { S: sessionId }
            }
        }));

        if (!response.Item) {
            throw new Error('Session not found');
        }

        return JSON.parse(response.Item.profile.S);
    } catch (error) {
        console.error('Error getting session profile:', error);
        throw error;
    }
}

async function searchNutritionData(ingredients) {
    try {
        // 먼저 인덱스 존재 확인
        const indexExists = await opensearchClient.indices.exists({
            index: 'ingredient-nutrition'
        });
        
        console.log('Index exists:', indexExists.body);
        
        if (!indexExists.body) {
            console.log('Index does not exist');
            return [];
        }

        // 재료별 검색
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
                size: 10
            }
        });

        console.log('Search response hits:', JSON.stringify(response.body.hits.hits.slice(0, 2), null, 2));
        const results = response.body.hits.hits.map(hit => hit._source);
        console.log('First result sample:', JSON.stringify(results[0], null, 2));
        return results;
    } catch (error) {
        console.error('OpenSearch error:', error);
        return [];
    }
}

async function generateRecipe(profile) {
    console.log('Starting recipe generation for profile:', JSON.stringify(profile));
    
    const nutritionData = await searchNutritionData(['닭가슴살', '브로콜리', '현미', '올리브오일', '아보카도']);
    console.log('Retrieved nutrition data:', nutritionData.length, 'items');
    
    const nutritionContext = nutritionData.map(item => 
        `${item.food_name}: 칼로리 ${item.energy_kcal}kcal/100g, 탄수화물 ${item.carb_g}g, 단백질 ${item.protein_g}g, 지방 ${item.fat_g}g`
    ).join('\n');

    console.log('Nutrition context:', nutritionContext);

    const prompt = `다음 사용자 프로필에 맞는 레시피를 생성해주세요:

프로필 정보:
- 목표: ${profile.target || '일반'}
- 예산: ${profile.budget || 20000}원
- 인분: ${profile.servings || 2}인분
- 탄수화물 제한: ${profile.carbLimit || 50}g
- 알레르기: ${profile.allergies ? profile.allergies.join(', ') : '없음'}
- 조리시간: ${profile.cookingTime || 30}분
- 추가 정보: ${profile.additional_info ? JSON.stringify(profile.additional_info) : '없음'}

영양소 데이터베이스:
${nutritionContext}

다음 JSON 형식으로 응답해주세요:
{
  "recipeName": "레시피 이름",
  "description": "레시피 설명",
  "ingredients": ["재료 1", "재료 2"],
  "instructions": ["조리 단계 1", "조리 단계 2"],
  "nutrition": {
    "calories": 420,
    "carbs": 8,
    "protein": 25,
    "fat": 35
  },
  "tips": "추가 팁"
}

중요한 규칙:
1. 프로필의 모든 조건을 반드시 지켜서 생성해주세요
2. 모든 텍스트는 반드시 한국어로만 작성해주세요
3. 재료명, 조리법, 설명 등 모든 내용을 한국어로 작성해주세요
4. JSON만 응답하고 다른 설명은 하지 마세요`;

    try {
        const response = await bedrock.send(new InvokeModelCommand({
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            }),
            contentType: 'application/json'
        }));

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const recipeText = responseBody.content[0].text;
        
        const jsonMatch = recipeText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        throw new Error('Invalid recipe format');
    } catch (error) {
        console.error('Bedrock error:', error);
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
        const { sessionId } = requestBody;

        if (!sessionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'sessionId is required' })
            };
        }

        // 세션에서 프로필 조회
        const profile = await getSessionProfile(sessionId);
        const recipe = await generateRecipe(profile);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                recipe: recipe,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Recipe generation failed' })
        };
    }
};
