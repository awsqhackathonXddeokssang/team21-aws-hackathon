const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });

const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: process.env.AWS_REGION || 'us-east-1',
    service: 'es'
  }),
  node: process.env.OPENSEARCH_ENDPOINT
});

const PROMPTS = require('./prompts');
const { calculateNutrition, getNutritionInfo } = require('./nutrition');

exports.handler = async (event) => {
  try {
    console.log('Recipe Lambda input:', JSON.stringify(event, null, 2));
    
    const { profile, constraints = {} } = event;
    
    if (!profile || !profile.target) {
      throw new Error('Profile with target is required');
    }

    // Generate recipe using Bedrock
    const recipe = await generateRecipe(profile, constraints);
    
    // Get nutrition information
    const nutrition = await calculateRecipeNutrition(recipe.ingredients);
    
    // Calculate target compliance
    const targetCompliance = calculateTargetCompliance(profile.target, nutrition, profile);
    
    const result = {
      recipe,
      nutrition,
      targetCompliance,
      generatedAt: new Date().toISOString()
    };
    
    console.log('Recipe Lambda output:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error('Recipe Lambda error:', error);
    
    // Return fallback recipe
    return {
      recipe: getFallbackRecipe(event.profile?.target || 'general'),
      nutrition: { total: {}, perServing: {}, macroRatio: {} },
      targetCompliance: { target: event.profile?.target || 'general', compliance: 0, notes: 'Error occurred, using fallback recipe' },
      generatedAt: new Date().toISOString(),
      error: error.message
    };
  }
};

async function generateRecipe(profile, constraints, retryCount = 0) {
  try {
    const prompt = PROMPTS.getPrompt(profile.target, profile, constraints);
    
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract JSON from Claude's response
    const content = responseBody.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }
    
    return JSON.parse(jsonMatch[0]);
    
  } catch (error) {
    if (error.name === 'ThrottlingException' && retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return generateRecipe(profile, constraints, retryCount + 1);
    }
    throw error;
  }
}

async function calculateRecipeNutrition(ingredients) {
  const nutritionData = await getNutritionInfo(ingredients, opensearchClient);
  return calculateNutrition(nutritionData);
}

function calculateTargetCompliance(target, nutrition, profile) {
  const { macroRatio } = nutrition;
  
  switch (target) {
    case 'keto':
      const ketoCompliance = (macroRatio.fat >= 70 && macroRatio.carbs <= 10) ? 95 : 60;
      return {
        target: 'keto',
        compliance: ketoCompliance,
        notes: ketoCompliance > 90 ? '완벽한 케토 매크로 비율입니다.' : '케토 비율 조정이 필요합니다.',
        recommendations: ketoCompliance > 90 ? ['MCT 오일 추가로 케토시스 촉진 가능'] : ['지방 비율을 높이고 탄수화물을 줄이세요']
      };
      
    case 'diabetes':
      const diabetesCompliance = (macroRatio.carbs <= 45 && nutrition.total.fiber >= 25) ? 90 : 70;
      return {
        target: 'diabetes',
        compliance: diabetesCompliance,
        notes: '혈당 관리에 적합한 레시피입니다.',
        recommendations: ['식후 혈당 모니터링 권장', '천천히 드세요']
      };
      
    default:
      return {
        target,
        compliance: 85,
        notes: '균형잡힌 영양 구성입니다.',
        recommendations: ['적절한 운동과 함께 드세요']
      };
  }
}

function getFallbackRecipe(target) {
  const fallbacks = {
    keto: {
      recipeName: '간단 아보카도 샐러드',
      description: '케토 다이어트용 고지방 저탄수화물 샐러드',
      cookingTime: 10,
      difficulty: 'easy',
      servings: 1,
      ingredients: [
        { name: '아보카도', amount: '1', unit: '개' },
        { name: '올리브오일', amount: '1', unit: '큰술' }
      ],
      instructions: ['아보카도를 썰어 올리브오일을 뿌립니다.']
    },
    general: {
      recipeName: '간단 계란볶음',
      description: '누구나 쉽게 만들 수 있는 계란볶음',
      cookingTime: 5,
      difficulty: 'easy',
      servings: 1,
      ingredients: [
        { name: '계란', amount: '2', unit: '개' },
        { name: '식용유', amount: '1', unit: '큰술' }
      ],
      instructions: ['팬에 기름을 두르고 계란을 볶습니다.']
    }
  };
  
  return fallbacks[target] || fallbacks.general;
}
