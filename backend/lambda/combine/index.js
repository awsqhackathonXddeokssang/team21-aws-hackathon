exports.handler = async (event) => {
    try {
        console.log('Combine Lambda input:', JSON.stringify(event, null, 2));
        
        // Step Functions에서 오는 경우와 직접 호출 경우 모두 처리
        let recipeResult, priceResult;
        
        if (Array.isArray(event)) {
            // 배열 형식 (레거시)
            [recipeResult, priceResult] = event;
        } else if (event.priceResult && event.nutritionResult) {
            // 직접 호출 형식
            recipeResult = event.nutritionResult;
            priceResult = event.priceResult;
        } else if (event.sessionId && event.recipeResult && event.pricingResult) {
            // Step Functions 형식 (정확한 매칭)
            recipeResult = { 
                success: true, 
                data: { 
                    recipe: event.recipeResult,
                    nutrition: event.recipeResult.nutrition || null,
                    nutritionInfo: event.recipeResult.nutritionInfo || null
                },
                sessionId: event.sessionId,  // sessionId 전달
                profile: event.profile || null  // profile 전달
            };
            priceResult = { 
                success: true, 
                data: event.pricingResult 
            };
        } else {
            throw new Error('Invalid event format: expected Step Functions format {sessionId, recipeResult, pricingResult} or legacy formats');
        }
        
        // 표준 형식 응답 파싱
        const recipeData = parseStandardResponse(recipeResult, 'recipe');
        const priceData = parseStandardResponse(priceResult, 'price');
        
        // 성공 여부 확인
        const overallSuccess = recipeData.success && priceData.success;
        
        // 가격 정보 처리 (최신 Price Lambda 형식 지원)
        const pricingInfo = processPricingData(priceData);
        
        // 영양소 정보 처리 (Recipe Lambda 형식 지원)
        const nutritionInfo = processNutritionData(recipeData);
        
        // 통합 데이터 생성
        const combinedData = {
            sessionId: extractSessionId(recipeData, priceData),
            recipe: recipeData.success ? extractRecipeInfo(recipeData.data) : null,
            nutrition: nutritionInfo,
            pricing: pricingInfo,
            shoppingInfo: extractShoppingInfo(priceData),
            totalEstimatedCost: pricingInfo?.recommendations?.totalEstimatedCost || 0,
            
            // Recipe Lambda 새 정보들
            generatedAt: extractGeneratedAt(recipeData),
            recipeImage: extractRecipeImage(recipeData),
            profile: extractProfile(recipeData),
            
            summary: {
                recipeAvailable: !!recipeData.success,
                pricingAvailable: !!priceData.success,
                nutritionAvailable: !!nutritionInfo,
                imageAvailable: !!extractRecipeImage(recipeData),
                profileAvailable: !!extractProfile(recipeData),
                ingredientsFound: pricingInfo?.summary?.foundIngredients || 0,
                totalIngredients: pricingInfo?.summary?.totalIngredients || 0,
                successRate: pricingInfo?.summary?.successRate || 0,
                targetCompliance: recipeData.data?.recipe?.targetCompliance || null
            }
        };
        
        // 에러 정보 수집
        const errors = [];
        if (!recipeData.success) errors.push(recipeData.error);
        if (!priceData.success) errors.push(priceData.error);
        
        return {
            success: overallSuccess,
            data: combinedData,
            error: errors.length > 0 ? {
                code: "PARTIAL_FAILURE",
                message: "Some operations failed",
                details: errors
            } : null,
            metadata: {
                source: "CombineLambda",
                timestamp: new Date().toISOString(),
                recipeSuccess: recipeData.success,
                priceSuccess: priceData.success,
                processingTime: Date.now(),
                version: "2.1"
            }
        };
        
    } catch (error) {
        console.error('Combine Lambda error:', error);
        return {
            success: false,
            data: null,
            error: {
                code: "COMBINE_ERROR",
                message: error.message
            },
            metadata: {
                source: "CombineLambda",
                timestamp: new Date().toISOString(),
                version: "2.1"
            }
        };
    }
};

function extractRecipeInfo(recipeData) {
    if (!recipeData) return null;
    
    // Recipe Lambda의 body 구조 처리
    const recipe = recipeData.body?.recipe || recipeData.recipe || recipeData;
    
    if (!recipe) return null;
    
    return {
        name: recipe.name || recipe.recipeName,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || recipe.steps || [],
        cookingTime: recipe.cookingTime || recipe.prepTime,
        difficulty: recipe.difficulty || recipe.cookingLevel,
        servings: recipe.servings || recipe.portions,
        description: recipe.description,
        tips: recipe.tips || recipe.cookingTips,
        targetCompliance: recipe.targetCompliance
    };
}

function processNutritionData(recipeData) {
    if (!recipeData.success || !recipeData.data) {
        return null;
    }
    
    const data = recipeData.data;
    const recipe = data.body?.recipe || data.recipe;
    const nutritionInfo = data.body?.nutritionInfo || data.nutritionInfo;
    
    // 영양소 정보 추출 (여러 경로 시도)
    const totalNutrition = recipe?.nutrition || 
                          data.nutrition || 
                          data.body?.nutrition || {
                            calories: 0,
                            protein: 0,
                            fat: 0,
                            carbs: 0,
                            fiber: 0
                          };
    
    return {
        // 총 영양소 정보
        total: totalNutrition,
        
        // 재료별 영양소 정보
        byIngredient: nutritionInfo || [],
        
        // 영양소 밀도 계산
        density: calculateNutritionDensity(totalNutrition),
        
        // 타겟 다이어트 준수 여부
        targetCompliance: recipe?.targetCompliance
    };
}

function calculateNutritionDensity(nutrition) {
    if (!nutrition || !nutrition.calories || nutrition.calories === 0) {
        return null;
    }
    
    return {
        proteinPerCalorie: (nutrition.protein * 4) / nutrition.calories, // 단백질 칼로리 비율
        fatPerCalorie: (nutrition.fat * 9) / nutrition.calories, // 지방 칼로리 비율
        carbsPerCalorie: (nutrition.carbs * 4) / nutrition.calories, // 탄수화물 칼로리 비율
        fiberPer100Cal: (nutrition.fiber / nutrition.calories) * 100 // 100칼로리당 섬유질
    };
}

function processPricingData(priceData) {
    if (!priceData.success || !priceData.data) {
        return null;
    }
    
    return {
        summary: priceData.data.summary,
        ingredients: priceData.data.ingredients,
        recommendations: priceData.data.recommendations
    };
}

function extractShoppingInfo(priceData) {
    if (!priceData.success || !priceData.data?.ingredients) {
        return null;
    }
    
    const shoppingList = [];
    
    // 각 재료별 최저가 상품 추출
    Object.entries(priceData.data.ingredients).forEach(([ingredient, products]) => {
        if (products && products.length > 0) {
            const cheapest = products[0]; // 이미 가격순 정렬됨
            shoppingList.push({
                ingredient,
                product: {
                    name: cheapest.name,
                    price: cheapest.price,
                    vendor: cheapest.vendor,
                    link: cheapest.link,
                    image: cheapest.image,
                    availability: cheapest.availability,
                    brand: cheapest.brand,
                    category: cheapest.category
                }
            });
        }
    });
    
    return {
        items: shoppingList,
        totalItems: shoppingList.length,
        totalCost: shoppingList.reduce((sum, item) => sum + item.product.price, 0),
        optimalVendors: priceData.data.recommendations?.optimalVendors || []
    };
}

function parseStandardResponse(result, source) {
    try {
        // 이미 표준 형식인 경우
        if (result.success !== undefined) {
            return result;
        }
        
        // body가 문자열인 경우 파싱
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        
        // 표준 형식 확인
        if (body && body.success !== undefined) {
            return body;
        }
        
        // Recipe Lambda 형식 처리 (statusCode 200이면 성공)
        if (result.statusCode === 200 && body) {
            return {
                success: true,
                data: { body: body },
                error: null,
                metadata: {
                    source: source,
                    timestamp: new Date().toISOString()
                }
            };
        }
        
        // 레거시 형식 변환
        return {
            success: result.statusCode === 200,
            data: body,
            error: result.statusCode !== 200 ? {
                code: "LEGACY_ERROR",
                message: "Legacy format error"
            } : null,
            metadata: {
                source: source,
                timestamp: new Date().toISOString()
            }
        };
        
    } catch (error) {
        return {
            success: false,
            data: null,
            error: {
                code: "PARSE_ERROR",
                message: `Failed to parse ${source} response: ${error.message}`
            },
            metadata: {
                source: source,
                timestamp: new Date().toISOString()
            }
        };
    }
}

function extractSessionId(recipeData, priceData) {
    // Recipe Lambda에서 sessionId 추출 (event에서 전달받은 것)
    return recipeData.sessionId ||  // Step Functions에서 전달
           priceData.data?.metadata?.sessionId ||
           priceData.data?.sessionId || 
           `combined_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractGeneratedAt(recipeData) {
    if (!recipeData.success || !recipeData.data) {
        return null;
    }
    
    return recipeData.data.body?.generatedAt || 
           recipeData.data.generatedAt || 
           new Date().toISOString();
}

function extractRecipeImage(recipeData) {
    // Recipe Lambda는 현재 이미지 정보 없음, 향후 Recipe Image Generator 연동 시 사용
    return null;
}

function extractProfile(recipeData) {
    // Recipe Lambda에서 profile 정보 추출 (event에서 전달받은 것)
    return recipeData.profile || null;
}
