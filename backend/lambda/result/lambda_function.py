import json
import boto3
from boto3.dynamodb.conditions import Attr
from datetime import datetime
import logging
from typing import Dict, Any, Optional
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def decimal_default(obj):
    """JSON serializer for Decimal objects"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

# AWS 클라이언트 초기화
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# DynamoDB 테이블
sessions_table = dynamodb.Table('ai-chef-sessions')
results_table = dynamodb.Table('ai-chef-results')

def decimal_default(obj):
    """JSON 직렬화를 위한 Decimal 변환"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Result Lambda - 세션 결과 조회"""
    try:
        session_id = event['pathParameters']['id']
        
        logger.info(f"Getting result for session: {session_id}")
        
        # 1. 세션 상태 확인
        session = get_session_status(session_id)
        if not session:
            return create_error_response(404, "SESSION_NOT_FOUND", "세션을 찾을 수 없습니다.")
        
        session_status = session.get('status')
        
        # 2. 상태별 응답
        if session_status == 'completed':
            # 완료된 경우 최종 결과 반환
            result = get_final_result(session_id)
            if result:
                return create_success_response(result, session)
            else:
                return create_error_response(500, "RESULT_NOT_FOUND", "결과를 찾을 수 없습니다.")
                
        elif session_status == 'processing':
            # 처리 중인 경우 진행 상태 반환
            return create_progress_response(session)
            
        elif session_status == 'failed':
            # 실패한 경우 에러 정보 반환
            return create_error_response(500, "PROCESSING_FAILED", 
                                       session.get('error', '처리 중 오류가 발생했습니다.'))
        else:
            # 기타 상태
            return create_error_response(400, "INVALID_STATUS", f"잘못된 세션 상태: {session_status}")
            
    except Exception as e:
        logger.error(f"Result retrieval error: {str(e)}")
        return create_error_response(500, "INTERNAL_ERROR", "서버 내부 오류가 발생했습니다.")

def get_session_status(session_id: str) -> Optional[Dict[str, Any]]:
    """세션 상태 조회"""
    try:
        response = sessions_table.get_item(Key={'sessionId': session_id})
        return response.get('Item')
    except Exception as e:
        logger.error(f"Session status retrieval error: {e}")
        return None

def get_final_result(session_id: str) -> Optional[Dict[str, Any]]:
    """최종 결과 조회"""
    try:
        # sessionId로 scan하여 모든 결과 조회
        response = results_table.scan(
            FilterExpression=Attr('sessionId').eq(session_id)
        )
        
        items = response.get('Items', [])
        if not items:
            logger.info(f"No results found for session: {session_id}")
            return None
            
        # 결과를 타입별로 정리
        result = {}
        for item in items:
            item_type = item.get('type')
            if item_type == 'recipe':
                result['recipe'] = json.loads(item.get('recipe', '{}'))
            elif item_type == 'price':
                result['price'] = item.get('data', {})
            elif item_type == 'image':
                result['image'] = {
                    'imageUrl': item.get('imageUrl'),
                    'status': item.get('status'),
                    'createdAt': item.get('createdAt')
                }
                
        logger.info(f"Found {len(items)} result items for session: {session_id}")
        return result if result else None
    except Exception as e:
        logger.error(f"Final result retrieval error: {e}")
        return None

def create_success_response(result: Dict[str, Any], session: Dict[str, Any]) -> Dict[str, Any]:
    """성공 응답 생성"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': True,
            'status': 'completed',
            'sessionId': session['sessionId'],
            'result': result,
            'completedAt': session.get('updatedAt'),
            'processingTime': calculate_processing_time(session)
        }, default=decimal_default)
    }

def create_progress_response(session: Dict[str, Any]) -> Dict[str, Any]:
    """진행 상태 응답 생성"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': True,
            'status': 'processing',
            'sessionId': session['sessionId'],
            'progress': {
                'percentage': session.get('progress', 0),
                'phase': session.get('phase', 'unknown'),
                'message': get_phase_message(session.get('phase', 'unknown'))
            },
            'startedAt': session.get('createdAt'),
            'updatedAt': session.get('updatedAt')
        }, default=decimal_default)
    }

def create_error_response(status_code: int, error_code: str, message: str) -> Dict[str, Any]:
    """에러 응답 생성"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': False,
            'error': error_code,
            'message': message
        }, default=decimal_default)
    }

def get_phase_message(phase: str) -> str:
    """단계별 메시지"""
    messages = {
        'workflow_starting': '워크플로우를 시작하고 있습니다...',
        'recipe_generation': '레시피를 생성하고 있습니다...',
        'recipe_completed': '레시피 생성이 완료되었습니다.',
        'price_lookup': '재료 가격을 조회하고 있습니다...',
        'image_generation': '레시피 이미지를 생성하고 있습니다...',
        'price_completed': '가격 조회가 완료되었습니다.',
        'image_completed': '이미지 생성이 완료되었습니다.',
        'combining_results': '결과를 합성하고 있습니다...',
        'finished': '모든 처리가 완료되었습니다.'
    }
    return messages.get(phase, '처리 중입니다...')

def calculate_processing_time(session: Dict[str, Any]) -> Optional[int]:
    """처리 시간 계산 (초)"""
    try:
        if 'createdAt' in session and 'updatedAt' in session:
            start = datetime.fromisoformat(session['createdAt'].replace('Z', '+00:00'))
            end = datetime.fromisoformat(session['updatedAt'].replace('Z', '+00:00'))
            return int((end - start).total_seconds())
    except Exception as e:
        logger.error(f"Processing time calculation error: {e}")
    return None
