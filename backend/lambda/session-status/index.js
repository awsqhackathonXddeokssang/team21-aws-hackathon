const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const sessionId = event.pathParameters.id;

        if (!sessionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Session ID is required' })
            };
        }

        // Get session from DynamoDB
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

        // Parse session data
        const session = {
            sessionId: getResult.Item.sessionId.S,
            status: getResult.Item.status.S,
            recipeStatus: getResult.Item.recipeStatus?.S || 'pending',
            nutritionStatus: getResult.Item.nutritionStatus?.S || 'pending',
            imageStatus: getResult.Item.imageStatus?.S || 'pending',
            priceStatus: getResult.Item.priceStatus?.S || 'pending',
            createdAt: getResult.Item.createdAt?.S,
            updatedAt: getResult.Item.updatedAt?.S,
            expiresAt: getResult.Item.expiresAt?.S
        };

        // Add profile if exists
        if (getResult.Item.profile) {
            session.profile = JSON.parse(getResult.Item.profile.S);
        }

        // Add results if exists
        if (getResult.Item.results) {
            session.results = JSON.parse(getResult.Item.results.S);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(session)
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
