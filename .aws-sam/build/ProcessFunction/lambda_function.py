import json
import boto3
from datetime import datetime
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS 클라이언트 초기화
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
stepfunctions = boto3.client('stepfunctions', region_name='us-east-1')

# DynamoDB 테이블
sessions_table = dynamodb.Table('ai-chef-sessions')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Session 처리 Lambda 핸들러"""
    try:
        # API Gateway 이벤트 파싱
        body = json.loads(event['body'])
        session_id = body.get('sessionId')
        user_profile = body.get('userProfile')
        
        if not session_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Session ID is required'})
            }
        
        logger.info(f"Processing session: {session_id}")
        
        # 1. 세션 상태 검증
        session = validate_session(session_id)
        if not session:
            return create_error_response(404, "SESSION_NOT_FOUND", "세션을 찾을 수 없습니다.")
        
        # 2. 프로필 유효성 검사
        validation_result = validate_user_profile(user_profile)
        if not validation_result['valid']:
            return create_error_response(400, "INVALID_PROFILE", 
                                       validation_result['message'], 
                                       validation_result.get('details'))
        
        # 3. 중복 처리 체크
        if session.get('status') == 'processing':
            return create_error_response(409, "ALREADY_PROCESSING", 
                                       "이미 처리 중인 세션입니다.")
        
        # 4. 프로필 데이터 저장 및 상태 업데이트
        update_session_with_profile(session_id, user_profile)
        
        # 5. Step Functions 워크플로우 시작
        execution_arn = start_workflow(session_id, user_profile)
        
        # 6. 실행 정보 저장
        save_execution_info(session_id, execution_arn)
        
        # 7. 예상 시간 계산
        estimated_time = calculate_estimated_time(user_profile.get('target'))
        
        return create_success_response(execution_arn, estimated_time)
        
    except Exception as e:
        logger.error(f"Session processing error: {str(e)}")
        return create_error_response(500, "INTERNAL_ERROR", 
                                   "서버 내부 오류가 발생했습니다.")

def validate_session(session_id: str) -> Optional[Dict[str, Any]]:
    """세션 유효성 검사"""
    try:
        response = sessions_table.get_item(Key={'sessionId': session_id})
        return response.get('Item')
    except Exception as e:
        logger.error(f"Session validation error: {e}")
        return None

def validate_user_profile(user_profile: Dict[str, Any]) -> Dict[str, Any]:
    """사용자 프로필 유효성 검사"""
    if not user_profile:
        return {
            'valid': False,
            'message': '사용자 프로필이 필요합니다.',
            'details': {'missingFields': ['userProfile']}
        }
    
    # 필수 필드 검사
    required_fields = ['target', 'responses']
    missing_fields = []
    
    for field in required_fields:
        if field not in user_profile:
            missing_fields.append(field)
    
    # 타겟별 필수 응답 검사
    responses = user_profile.get('responses', {})
    
    # 공통 필수 응답 (예산, 인분)
    if '100' not in responses:
        missing_fields.append('responses.100')
    if '101' not in responses:
        missing_fields.append('responses.101')
    
    if missing_fields:
        return {
            'valid': False,
            'message': '필수 프로필 정보가 누락되었습니다.',
            'details': {'missingFields': missing_fields}
        }
    
    return {'valid': True}

def update_session_with_profile(session_id: str, user_profile: Dict[str, Any]):
    """세션에 프로필 저장 및 상태 업데이트"""
    try:
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression="""
                SET #status = :status, 
                    #profile = :profile, 
                    #updatedAt = :updatedAt,
                    #phase = :phase,
                    #progress = :progress
            """,
            ExpressionAttributeNames={
                '#status': 'status',
                '#profile': 'profile',
                '#updatedAt': 'updatedAt',
                '#phase': 'phase',
                '#progress': 'progress'
            },
            ExpressionAttributeValues={
                ':status': 'processing',
                ':profile': user_profile,
                ':updatedAt': datetime.now().isoformat(),
                ':phase': 'workflow_starting',
                ':progress': 5
            }
        )
    except Exception as e:
        logger.error(f"Failed to update session: {e}")
        raise

def start_workflow(session_id: str, user_profile: Dict[str, Any]) -> str:
    """Step Functions 워크플로우 시작"""
    try:
        # 워크플로우 입력 데이터 구성
        workflow_input = {
            'sessionId': session_id,
            'profile': transform_profile_for_workflow(user_profile)
        }
        
        # Step Functions 실행
        response = stepfunctions.start_execution(
            stateMachineArn='arn:aws:states:us-east-1:491085385364:stateMachine:ai-chef-workflow',
            name=f'execution-{int(datetime.now().timestamp())}',
            input=json.dumps(workflow_input)
        )
        
        return response['executionArn']
        
    except Exception as e:
        logger.error(f"Failed to start workflow: {e}")
        raise

def transform_profile_for_workflow(user_profile: Dict[str, Any]) -> Dict[str, Any]:
    """사용자 프로필을 워크플로우 형식으로 변환"""
    responses = user_profile.get('responses', {})
    target = user_profile.get('target')
    
    # 기본 프로필 구조
    workflow_profile = {
        'target': target,
        'budget': int(responses.get('100', 20000)),
        'servings': int(responses.get('101', 2))
    }
    
    # 타겟별 프로필 변환
    if target == 'keto':
        workflow_profile.update({
            'healthConditions': [responses.get('1', '')] if responses.get('1') else [],
            'allergies': [responses.get('2', '')] if responses.get('2') else [],
            'cookingLevel': responses.get('3', 'beginner')
        })
    elif target == 'baby_food':
        workflow_profile.update({
            'babyAge': int(responses.get('1', 6)),
            'allergies': [responses.get('2', '')] if responses.get('2') else [],
            'currentFoods': responses.get('4', '').split(',') if responses.get('4') else []
        })
    elif target == 'diabetes':
        workflow_profile.update({
            'diabetesType': responses.get('1', 'type2'),
            'bloodSugar': responses.get('2', 'normal'),
            'medications': responses.get('5', '').split(',') if responses.get('5') else []
        })
    elif target == 'fridge':
        workflow_profile.update({
            'availableIngredients': responses.get('6', '').split(',') if responses.get('6') else [],
            'additionalBudget': int(responses.get('7', 10000))
        })
    
    return workflow_profile

def save_execution_info(session_id: str, execution_arn: str):
    """실행 정보 저장"""
    try:
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression="SET executionArn = :arn, startedAt = :startedAt",
            ExpressionAttributeValues={
                ':arn': execution_arn,
                ':startedAt': datetime.now().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Failed to save execution info: {e}")
        raise

def calculate_estimated_time(target: str) -> int:
    """타겟별 예상 처리 시간 계산 (초)"""
    target_times = {
        'keto': 25,
        'baby_food': 30,
        'diabetes': 35,
        'diet': 20,
        'fridge': 40
    }
    return target_times.get(target, 30)

def create_success_response(execution_arn: str, estimated_time: int) -> Dict[str, Any]:
    """성공 응답 생성"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': True,
            'executionId': execution_arn,
            'estimatedTime': estimated_time,
            'status': 'processing',
            'message': '레시피 생성이 시작되었습니다.'
        })
    }

def create_error_response(status_code: int, error_code: str, message: str, details: Dict = None) -> Dict[str, Any]:
    """에러 응답 생성"""
    error_body = {
        'success': False,
        'error': error_code,
        'message': message
    }
    
    if details:
        error_body['details'] = details
    
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(error_body)
    }
