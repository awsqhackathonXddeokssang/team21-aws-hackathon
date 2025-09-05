const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const client = new BedrockRuntimeClient({ region: "us-east-1" });

exports.handler = async (event) => {
    try {
        console.log('Event:', JSON.stringify(event, null, 2));
        
        let body;
        if (typeof event.body === 'string') {
            body = JSON.parse(event.body);
        } else {
            body = event.body || event;
        }
        
        const { recipe } = body;
        
        if (!recipe || !recipe.name || !recipe.ingredients) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: "Recipe name and ingredients are required" })
            };
        }

        const prompt = `Create a high-quality, appetizing food photograph of "${recipe.name}" containing ${recipe.ingredients.join(', ')}. The image should be well-lit, professionally styled, and make the food look delicious and appealing.`;

        const input = {
            modelId: "stability.stable-diffusion-xl-v1",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                text_prompts: [
                    {
                        text: prompt,
                        weight: 1
                    }
                ],
                cfg_scale: 10,
                seed: Math.floor(Math.random() * 1000000),
                steps: 30,
                width: 512,
                height: 512
            })
        };

        const command = new InvokeModelCommand(input);
        const response = await client.send(command);
        
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const base64Image = responseBody.artifacts[0].base64;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                recipe: recipe.name,
                image: `data:image/png;base64,${base64Image}`,
                ingredients: recipe.ingredients
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
