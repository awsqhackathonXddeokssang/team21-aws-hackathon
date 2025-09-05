const { fetchIngredientPrices } = require('./utils/naver-client');
const { formatPricingResult, formatStandardResponse } = require('./utils/formatter');
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const SESSIONS_TABLE = process.env.SESSIONS_TABLE_NAME || 'ai-chef-sessions';

exports.handler = async (event) => {
    const startTime = Date.now();
    
    try {
        console.log('Price Lambda 시작:', JSON.stringify(event));
        
        // 입력 검증
        const { ingredients, sessionId } = event;
        if (!ingredients || !Array.isArray(ingredients) || !sessionId) {
            throw new Error('Invalid input: ingredients array and sessionId required');
        }

        // 세션 상태 업데이트: 가격 조회 시작
        await updateSessionStatus(sessionId, 'processing', 'price_lookup', 60);

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

        // DynamoDB에 가격 데이터 저장
        await savePriceDataToSession(sessionId, result.data);
        
        // 세션 상태 업데이트: 가격 조회 완료
        await updateSessionStatus(sessionId, 'processing', 'price_completed', 80);

        console.log('Price Lambda 완료:', JSON.stringify(result));
        return result;

    } catch (error) {
        console.error('Price Lambda 오류:', error);
        
        // 세션 상태 업데이트: 가격 조회 실패
        await updateSessionStatus(sessionId, 'failed', 'price_lookup_failed', 60, error.message);
        
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

// DynamoDB 세션 상태 업데이트 함수 (실제 구현에 맞춤)
async function updateSessionStatus(sessionId, status, phase, progress, error = null) {
    try {
        const now = new Date().toISOString();
        let updateExpression = "SET #status = :status, #phase = :phase, #progress = :progress, #lastActivity = :lastActivity";
        const expressionValues = {
            ':status': status,
            ':phase': phase,
            ':progress': progress,
            ':lastActivity': now
        };
        const expressionNames = {
            '#status': 'status',
            '#phase': 'phase',
            '#progress': 'progress',
            '#lastActivity': 'lastActivity'
        };
        
        if (error) {
            updateExpression += ", #error = :error";
            expressionValues[':error'] = error;
            expressionNames['#error'] = 'error';
        }
        
        await dynamodb.update({
            TableName: SESSIONS_TABLE,
            Key: { sessionId: sessionId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionNames,
            ExpressionAttributeValues: expressionValues
        }).promise();
        
        console.log(`세션 상태 업데이트: ${sessionId} - ${phase} (${progress}%)`);
        
    } catch (err) {
        console.error('세션 상태 업데이트 실패:', err);
    }
}

// DynamoDB에 가격 데이터 저장 함수 (실제 구조에 맞춤)
async function savePriceDataToSession(sessionId, priceData) {
    try {
        const now = new Date().toISOString();
        await dynamodb.update({
            TableName: SESSIONS_TABLE,
            Key: { sessionId: sessionId },
            UpdateExpression: "SET #priceData = :priceData, #priceUpdatedAt = :updatedAt, #lastActivity = :lastActivity",
            ExpressionAttributeNames: {
                '#priceData': 'priceData',
                '#priceUpdatedAt': 'priceUpdatedAt',
                '#lastActivity': 'lastActivity'
            },
            ExpressionAttributeValues: {
                ':priceData': priceData,
                ':updatedAt': now,
                ':lastActivity': now
            }
        }).promise();
        
        console.log(`가격 데이터 저장 완료: ${sessionId}`);
        
    } catch (err) {
        console.error('가격 데이터 저장 실패:', err);
        // 저장 실패해도 Lambda 실행은 계속 진행
    }
}
