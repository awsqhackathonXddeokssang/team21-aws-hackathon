const { fetchIngredientPrices } = require('./utils/naver-client');
const { formatPricingResult, formatStandardResponse } = require('./utils/formatter');

exports.handler = async (event) => {
    const startTime = Date.now();
    
    try {
        console.log('Price Lambda 시작:', JSON.stringify(event));
        
        // 입력 검증
        const { ingredients, sessionId } = event;
        if (!ingredients || !Array.isArray(ingredients) || !sessionId) {
            throw new Error('Invalid input: ingredients array and sessionId required');
        }

        // 재료명 추출 (문자열 배열 또는 객체 배열 모두 지원)
        const ingredientNames = ingredients.map(ing => 
            typeof ing === 'string' ? ing : ing.name
        );
        console.log('검색할 재료들:', ingredientNames);

        // 네이버 쇼핑 API로 가격 조회 (Secrets Manager에서 API 키 자동 조회)
        const priceData = await fetchIngredientPrices(ingredientNames);

        // 표준 응답 형식으로 반환
        const result = formatPricingResult(priceData, {
            timestamp: new Date().toISOString(),
            requestId: generateRequestId(),
            processingTime: Date.now() - startTime,
            sessionId: sessionId
        });

        console.log('Price Lambda 완료:', JSON.stringify(result));
        return result;

    } catch (error) {
        console.error('Price Lambda 오류:', error);
        
        return formatStandardResponse(false, null, {
            code: 'PRICE_LOOKUP_FAILED',
            message: error.message
        }, {
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        });
    }
};

function generateRequestId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}
