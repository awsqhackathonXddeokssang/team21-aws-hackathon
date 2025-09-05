const { DynamoDBClient, UpdateItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

async function analyzeUserPrompt(userPrompt) {
    const prompt = `사용자의 다음 텍스트를 분석해서 식단 관련 정보를 JSON 형태로 추출해주세요:

"${userPrompt}"

다음 형태의 JSON으로 응답해주세요:
{
  "health_conditions": ["당뇨", "고혈압" 등 건강 상태],
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
            return JSON.parse(jsonMatch[0]);
        }
        
        return { other_notes: userPrompt };
    } catch (error) {
        console.error('Bedrock analysis error:', error);
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
        const sessionId = event.pathParameters.sessionId;
        const requestBody = JSON.parse(event.body);
        const { userPrompt, ...profileData } = requestBody;

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
            }
        }

        // Update session
        await dynamodb.send(new UpdateItemCommand({
            TableName: process.env.SESSIONS_TABLE_NAME,
            Key: { sessionId: { S: sessionId } },
            UpdateExpression: 'SET profile = :profile, #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':profile': { S: JSON.stringify(updatedProfile) },
                ':status': { S: 'additional_info_collected' },
                ':updatedAt': { S: new Date().toISOString() }
            }
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                sessionId,
                status: 'additional_info_collected',
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
