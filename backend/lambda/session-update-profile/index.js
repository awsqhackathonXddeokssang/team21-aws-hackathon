const { DynamoDBClient, UpdateItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

async function analyzeUserPrompt(userPrompt) {
    const prompt = `다음 사용자 입력을 분석해주세요:

"${userPrompt}"

먼저 이 입력이 음식, 요리, 식단, 건강, 영양과 관련된 내용인지 판단해주세요.

만약 음식/요리와 관련이 없다면:
{
  "is_food_related": false,
  "error": "음식이나 요리와 관련된 내용이 아닙니다"
}

음식/요리와 관련된 내용이라면:
{
  "is_food_related": true,
  "allergies": ["알레르기 목록"],
  "dislikes": ["싫어하는 음식 목록"],
  "nutritionist_consultation": true/false,
  "dietary_recommendations": ["영양사 권장사항"],
  "cooking_time_preference": 숫자(분),
  "health_conditions": ["건강 상태"],
  "taste_preferences": ["매운맛", "단맛" 등 맛 선호도],
  "dietary_considerations": "특별한 식단 고려사항",
  "cooking_preferences": ["간단한 요리", "빠른 조리" 등 요리 선호도],
  "meal_timing": ["아침", "점심", "저녁" 등 식사 시간대],
  "other_notes": "기타 중요한 정보"
}

JSON만 응답하고 다른 설명은 하지 마세요.`;

    try {
        const response = await bedrock.send(new InvokeModelCommand({
            modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
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
        const analysisText = responseBody.content[0].text;
        
        // JSON 부분만 추출
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            
            // 음식 관련 내용이 아닌 경우 에러 발생
            if (result.is_food_related === false) {
                throw new Error('NON_FOOD_RELATED_PROMPT');
            }
            
            return result;
        }
        
        return { other_notes: userPrompt };
    } catch (error) {
        console.error('Bedrock analysis error:', error);
        if (error.message === 'NON_FOOD_RELATED_PROMPT') {
            throw error;
        }
        return { other_notes: userPrompt };
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const requestBody = JSON.parse(event.body);
        const { sessionId, userPrompt, ...profileData } = requestBody;

        if (!sessionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Session ID is required' })
            };
        }

        // Get current session
        const getResult = await dynamodb.send(new GetItemCommand({
            TableName: process.env.SESSIONS_TABLE_NAME,
            Key: { sessionId: { S: sessionId } }
        }));

        if (!getResult.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Session not found' })
            };
        }

        // Parse existing profile
        const existingProfile = getResult.Item.profile ? 
            JSON.parse(getResult.Item.profile.S) : {};

        // Handle both additionalInfo format and direct profile format
        let updatedProfile;
        if (requestBody.additionalInfo) {
            // Legacy format with additionalInfo
            updatedProfile = {
                ...existingProfile,
                hasAdditionalQuestions: requestBody.additionalInfo.hasAdditionalQuestions || false,
                additionalInfo: {
                    ...existingProfile.additionalInfo,
                    ...requestBody.additionalInfo
                }
            };
        } else {
            // Direct profile format
            updatedProfile = {
                ...existingProfile,
                ...profileData
            };

            // Process userPrompt if provided
            if (userPrompt) {
                try {
                    const analyzedInfo = await analyzeUserPrompt(userPrompt);
                    
                    // Initialize additional_info array if it doesn't exist
                    if (!updatedProfile.additional_info) {
                        updatedProfile.additional_info = [];
                    }

                    // Add new analysis to the array
                    updatedProfile.additional_info.push({
                        timestamp: new Date().toISOString(),
                        original_prompt: userPrompt,
                        analyzed_info: analyzedInfo
                    });
                } catch (error) {
                    if (error.message === 'NON_FOOD_RELATED_PROMPT') {
                        return {
                            statusCode: 400,
                            headers,
                            body: JSON.stringify({ 
                                error: 'NON_FOOD_RELATED_PROMPT',
                                message: '음식이나 요리와 관련된 내용을 입력해주세요.' 
                            })
                        };
                    }
                    throw error;
                }
            }
        }

        // Update session
        await dynamodb.send(new UpdateItemCommand({
            TableName: process.env.SESSIONS_TABLE_NAME,
            Key: { sessionId: { S: sessionId } },
            UpdateExpression: 'SET profile = :profile, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':profile': { S: JSON.stringify(updatedProfile) },
                ':updatedAt': { S: new Date().toISOString() }
            }
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                sessionId,
                status: getResult.Item.status.S,  // 기존 status 유지
                profile: updatedProfile,
                updatedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
