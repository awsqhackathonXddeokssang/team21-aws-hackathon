const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

exports.handler = async (event) => {
    try {
        const { sessionId, profile } = event;
        
        // Generate recipe using Claude Opus 4.1
        const prompt = buildPrompt(profile);
        
        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-opus-4-1-20250805-v1:0',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 4000,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        
        const response = await bedrock.send(command);
        const result = JSON.parse(new TextDecoder().decode(response.body));
        
        const recipeText = result.content[0].text;
        const recipe = JSON.parse(recipeText);
        
        return {
            statusCode: 200,
            body: {
                recipe: recipe,
                generatedAt: new Date().toISOString()
            }
        };
        
    } catch (error) {
        console.error('Recipe generation error:', error);
        return {
            statusCode: 500,
            body: {
                error: error.message,
                recipe: getDefaultRecipe(event.profile?.target || 'general')
            }
        };
    }
};

function buildPrompt(profile) {
    const { target, healthConditions, allergies, cookingLevel, budget } = profile;
    
    const basePrompt = `당신은 전문 영양사입니다. 다음 조건에 맞는 레시피를 JSON 형식으로 생성해주세요:

사용자 프로필:
- 타겟: ${target}
- 건강 상태: ${healthConditions?.join(', ') || '없음'}
- 알레르기: ${allergies?.join(', ') || '없음'}
- 요리 실력: ${cookingLevel || '초급'}
- 예산: ${budget || 20000}원

응답 형식:
{
  "recipeName": "레시피명",
  "description": "레시피 설명",
  "cookingTime": 30,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {"name": "재료명", "amount": "1", "unit": "개"}
  ],
  "instructions": [
    "1. 조리 단계"
  ],
  "nutrition": {
    "calories": 400,
    "protein": 25,
    "fat": 15,
    "carbs": 30
  }
}`;

    return basePrompt;
}

function getDefaultRecipe(target) {
    return {
        recipeName: `기본 ${target} 레시피`,
        description: '기본 레시피입니다',
        cookingTime: 20,
        difficulty: 'easy',
        servings: 2,
        ingredients: [
            { name: '기본 재료', amount: '1', unit: '개' }
        ],
        instructions: ['1. 기본 조리법'],
        nutrition: { calories: 300, protein: 20, fat: 10, carbs: 25 }
    };
}
