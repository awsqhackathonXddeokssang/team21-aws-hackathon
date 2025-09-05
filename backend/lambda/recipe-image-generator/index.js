const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const s3 = new S3Client({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

const S3_BUCKET = 'ai-chef-images'; // S3 버킷명

async function updateImageStatus(sessionId, status) {
    await dynamoClient.send(new UpdateItemCommand({
        TableName: 'ai-chef-sessions',
        Key: { sessionId: { S: sessionId } },
        UpdateExpression: 'SET imageStatus = :status',
        ExpressionAttributeValues: { ':status': { S: status } }
    }));
}

async function uploadImageToS3(base64Image, sessionId) {
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const key = `${sessionId}_image.png`;
    
    await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/png',
        ACL: 'public-read'
    }));
    
    return `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;
}

async function saveImageToResults(sessionId, imageUrl) {
    const timestamp = new Date().toISOString();
    const resultId = `${sessionId}_image`;
    
    await dynamoClient.send(new PutItemCommand({
        TableName: 'ai-chef-results',
        Item: {
            resultId: { S: resultId },
            sessionId: { S: sessionId },
            type: { S: 'image' },
            status: { S: 'completed' },
            imageUrl: { S: imageUrl },
            createdAt: { S: timestamp },
            ttl: { N: Math.floor(Date.now() / 1000 + 7 * 24 * 60 * 60).toString() }
        }
    }));
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

    let recipe = null;
    let sessionId = null;
    
    try {
        const requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event;
        const { sessionId: sid, recipe: recipeData } = requestBody;
        sessionId = sid;

        if (!sessionId || !recipeData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'sessionId and recipe are required' })
            };
        }

        // JSON 문자열 파싱 (Price Lambda와 동일한 로직)
        if (typeof recipeData === 'string') {
            const parsed = JSON.parse(recipeData);
            recipe = parsed.recipe || parsed;
        } else {
            recipe = recipeData.recipe || recipeData;
        }

        // Update imageStatus to processing
        await updateImageStatus(sessionId, 'processing');

        console.log('Generating image for recipe:', recipe.recipeName || recipe.name);

        // 레시피 정보로 프롬프트 생성
        const recipeName = recipe.recipeName || recipe.name || 'delicious dish';
        const ingredients = recipe.ingredients || [];
        
        const prompt = `A high-quality, appetizing food photograph of ${recipeName}. The dish contains ${ingredients.slice(0, 5).join(', ')}. Professional food photography, well-lit, beautifully plated, restaurant quality presentation, vibrant colors, appetizing appearance.`;

        console.log('Image generation prompt:', prompt);

        // Amazon Nova Canvas 호출
        const input = {
            modelId: "amazon.nova-canvas-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                taskType: "TEXT_IMAGE",
                textToImageParams: {
                    text: prompt,
                    negativeText: "blurry, low quality, distorted, unappetizing"
                },
                imageGenerationConfig: {
                    numberOfImages: 1,
                    height: 512,
                    width: 512,
                    cfgScale: 8.0,
                    seed: Math.floor(Math.random() * 1000000)
                }
            })
        };

        const command = new InvokeModelCommand(input);
        const response = await bedrock.send(command);
        
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const base64Image = responseBody.images[0];

        console.log('Image generated successfully');

        // S3에 업로드
        const imageUrl = await uploadImageToS3(base64Image, sessionId);
        console.log('Image uploaded to S3:', imageUrl);

        // DynamoDB에 결과 저장
        await saveImageToResults(sessionId, imageUrl);
        console.log('Image URL saved to DynamoDB');

        // Update imageStatus to completed
        await updateImageStatus(sessionId, 'completed');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                imageUrl: imageUrl,
                sessionId: sessionId,
                recipeName: recipeName,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error generating recipe image:', error);
        
        // 에러 시 폴백 이미지
        const fallbackImageUrl = `https://via.placeholder.com/512x512/4CAF50/white?text=${encodeURIComponent(recipe?.recipeName || 'Recipe')}`;
        
        try {
            await saveImageToResults(sessionId, fallbackImageUrl);
            await updateImageStatus(sessionId, 'failed');
        } catch (dbError) {
            console.error('Error saving fallback image:', dbError);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                imageUrl: fallbackImageUrl,
                sessionId: sessionId,
                error: 'Image generation failed, using fallback',
                timestamp: new Date().toISOString()
            })
        };
    }
};
