const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' });

// Nutrition cache for common ingredients
const nutritionCache = new Map();

async function getNutritionInfo(ingredients, opensearchClient) {
  const nutritionPromises = ingredients.map(async (ingredient) => {
    try {
      // Clean ingredient name
      const cleanName = ingredient.name.replace(/[0-9]+[가-힣]*\s*/g, '').trim();
      
      // Check cache first
      if (nutritionCache.has(cleanName)) {
        const cachedNutrition = nutritionCache.get(cleanName);
        return calculateNutritionByAmount(cachedNutrition, ingredient.amount, ingredient.unit);
      }
      
      // Get nutrition from OpenSearch
      const nutritionData = await searchNutritionInOpenSearch(cleanName, opensearchClient);
      
      if (nutritionData) {
        nutritionCache.set(cleanName, nutritionData);
        return calculateNutritionByAmount(nutritionData, ingredient.amount, ingredient.unit);
      }
      
      // Fallback to estimated nutrition
      return getEstimatedNutrition(cleanName, ingredient.amount, ingredient.unit);
      
    } catch (error) {
      console.warn(`Failed to get nutrition for ${ingredient.name}:`, error.message);
      return getEstimatedNutrition(ingredient.name, ingredient.amount, ingredient.unit);
    }
  });
  
  return Promise.all(nutritionPromises);
}

async function searchNutritionInOpenSearch(ingredientName, opensearchClient) {
  try {
    if (!opensearchClient || !process.env.OPENSEARCH_ENDPOINT) {
      console.warn('OpenSearch not configured, using estimated nutrition');
      return null;
    }
    
    // Get embedding for ingredient name
    const embedding = await getBedrockEmbedding(ingredientName);
    
    const searchResult = await opensearchClient.search({
      index: 'ingredient-nutrition',
      body: {
        query: {
          knn: {
            embedding: {
              vector: embedding,
              k: 1
            }
          }
        }
      }
    });
    
    if (searchResult.body.hits.hits.length > 0) {
      return searchResult.body.hits.hits[0]._source;
    }
    
    return null;
    
  } catch (error) {
    console.warn('OpenSearch query failed:', error.message);
    return null;
  }
}

async function getBedrockEmbedding(text) {
  try {
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v1',
      body: JSON.stringify({
        inputText: text
      })
    });
    
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return responseBody.embedding;
    
  } catch (error) {
    console.warn('Failed to get embedding:', error.message);
    // Return dummy embedding for fallback
    return new Array(1536).fill(0);
  }
}

function calculateNutritionByAmount(nutritionData, amount, unit) {
  const numericAmount = parseFloat(amount) || 1;
  const baseAmount = 100; // Most nutrition data is per 100g
  
  // Unit conversion factors
  const unitFactors = {
    'g': 1,
    'kg': 1000,
    '개': 150, // Average weight per piece
    '큰술': 15,
    '작은술': 5,
    '컵': 200,
    'ml': 1,
    'L': 1000
  };
  
  const factor = (unitFactors[unit] || 100) * numericAmount / baseAmount;
  
  return {
    ingredient: nutritionData.name || 'Unknown',
    amount: numericAmount,
    unit: unit,
    calories: (nutritionData.calories || 0) * factor,
    protein: (nutritionData.protein || 0) * factor,
    fat: (nutritionData.fat || 0) * factor,
    carbs: (nutritionData.carbs || 0) * factor,
    fiber: (nutritionData.fiber || 0) * factor,
    sodium: (nutritionData.sodium || 0) * factor
  };
}

function getEstimatedNutrition(ingredientName, amount, unit) {
  // Category-based nutrition estimation
  const categoryNutrition = {
    '채소류': { calories: 25, protein: 2, fat: 0.2, carbs: 5, fiber: 2, sodium: 10 },
    '과일류': { calories: 50, protein: 1, fat: 0.3, carbs: 12, fiber: 2, sodium: 2 },
    '육류': { calories: 200, protein: 20, fat: 15, carbs: 0, fiber: 0, sodium: 70 },
    '생선류': { calories: 150, protein: 22, fat: 6, carbs: 0, fiber: 0, sodium: 60 },
    '곡류': { calories: 350, protein: 8, fat: 2, carbs: 75, fiber: 3, sodium: 5 },
    '유제품': { calories: 60, protein: 3, fat: 3, carbs: 5, fiber: 0, sodium: 50 },
    '견과류': { calories: 600, protein: 20, fat: 50, carbs: 20, fiber: 8, sodium: 5 },
    '기름류': { calories: 900, protein: 0, fat: 100, carbs: 0, fiber: 0, sodium: 0 }
  };
  
  const category = classifyIngredient(ingredientName);
  const baseNutrition = categoryNutrition[category] || categoryNutrition['채소류'];
  
  return calculateNutritionByAmount(baseNutrition, amount, unit);
}

function classifyIngredient(ingredientName) {
  const name = ingredientName.toLowerCase();
  
  if (name.includes('고기') || name.includes('닭') || name.includes('돼지') || name.includes('소')) return '육류';
  if (name.includes('생선') || name.includes('연어') || name.includes('참치')) return '생선류';
  if (name.includes('쌀') || name.includes('밀') || name.includes('빵') || name.includes('면')) return '곡류';
  if (name.includes('우유') || name.includes('치즈') || name.includes('요거트')) return '유제품';
  if (name.includes('견과') || name.includes('아몬드') || name.includes('호두')) return '견과류';
  if (name.includes('기름') || name.includes('오일')) return '기름류';
  if (name.includes('사과') || name.includes('바나나') || name.includes('과일')) return '과일류';
  
  return '채소류';
}

function calculateNutrition(ingredientNutritions) {
  const total = ingredientNutritions.reduce((sum, nutrition) => ({
    calories: sum.calories + nutrition.calories,
    protein: sum.protein + nutrition.protein,
    fat: sum.fat + nutrition.fat,
    carbs: sum.carbs + nutrition.carbs,
    fiber: sum.fiber + nutrition.fiber,
    sodium: sum.sodium + nutrition.sodium
  }), {
    calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sodium: 0
  });
  
  // Calculate macro ratios
  const totalMacroCalories = (total.protein * 4) + (total.fat * 9) + (total.carbs * 4);
  const macroRatio = {
    protein: totalMacroCalories > 0 ? Math.round((total.protein * 4 / totalMacroCalories) * 100) : 0,
    fat: totalMacroCalories > 0 ? Math.round((total.fat * 9 / totalMacroCalories) * 100) : 0,
    carbs: totalMacroCalories > 0 ? Math.round((total.carbs * 4 / totalMacroCalories) * 100) : 0
  };
  
  // Assume 2 servings by default
  const servings = 2;
  const perServing = {
    calories: Math.round(total.calories / servings),
    protein: Math.round(total.protein / servings * 10) / 10,
    fat: Math.round(total.fat / servings * 10) / 10,
    carbs: Math.round(total.carbs / servings * 10) / 10,
    fiber: Math.round(total.fiber / servings * 10) / 10,
    sodium: Math.round(total.sodium / servings)
  };
  
  return {
    total: {
      calories: Math.round(total.calories),
      protein: Math.round(total.protein * 10) / 10,
      fat: Math.round(total.fat * 10) / 10,
      carbs: Math.round(total.carbs * 10) / 10,
      fiber: Math.round(total.fiber * 10) / 10,
      sodium: Math.round(total.sodium)
    },
    perServing,
    macroRatio,
    ingredientBreakdown: ingredientNutritions
  };
}

module.exports = {
  getNutritionInfo,
  calculateNutrition,
  getEstimatedNutrition,
  calculateNutritionByAmount
};
