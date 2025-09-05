const { DynamoDBClient, UpdateItemCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

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
        const { additionalInfo } = JSON.parse(event.body);

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

        // Merge with additional info
        const updatedProfile = {
            ...existingProfile,
            hasAdditionalQuestions: additionalInfo.hasAdditionalQuestions || false,
            additionalInfo: {
                ...existingProfile.additionalInfo,
                ...additionalInfo
            }
        };

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
