exports.handler = async (event) => {
    try {
        console.log('Combine Lambda input:', JSON.stringify(event, null, 2));
        
        // Step Functions에서 오는 경우와 직접 호출 경우 모두 처리
        let recipeResult, priceResult;
        
        if (Array.isArray(event)) {
            [recipeResult, priceResult] = event;
        } else if (event.priceResult && event.nutritionResult) {
            recipeResult = event.nutritionResult;
            priceResult = event.priceResult;
        } else {
            throw new Error('Invalid event format: expected array or {priceResult, nutritionResult}');
        }
        
        // 표준 형식 응답 파싱
        const recipeData = parseStandardResponse(recipeResult, 'recipe');
        const priceData = parseStandardResponse(priceResult, 'price');
        
        // 성공 여부 확인
        const overallSuccess = recipeData.success && priceData.success;
        
        // 통합 데이터 생성
        const combinedData = {
            sessionId: extractSessionId(recipeData, priceData),
            recipe: recipeData.success ? recipeData.data?.recipe : null,
            nutrition: recipeData.success ? recipeData.data?.nutrition : null,
            pricing: priceData.success ? priceData.data : null,
            totalEstimatedCost: priceData.success ? priceData.data?.recommendations?.totalEstimatedCost : 0
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
                processingTime: Date.now()
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
                timestamp: new Date().toISOString()
            }
        };
    }
};

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
    return recipeData.data?.sessionId || 
           priceData.data?.sessionId || 
           `combined_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
