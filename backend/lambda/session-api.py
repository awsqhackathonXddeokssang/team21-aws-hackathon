import json
import boto3
from datetime import datetime
import logging
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
stepfunctions = boto3.client('stepfunctions', region_name='us-east-1')
sessions_table = dynamodb.Table('ai-chef-sessions')

def lambda_handler(event, context):
    try:
        http_method = event['httpMethod']
        
        if http_method == 'POST' and event['resource'] == '/sessions':
            # 새 세션 생성
            return create_session(event, context)
        elif http_method == 'GET' and event['resource'] == '/sessions':
            # 세션 목록 조회
            return list_sessions(event, context)
        elif http_method == 'POST' and '/session/' in event['resource']:
            # 세션 처리
            return process_session(event, context)
        else:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Not Found'})
            }
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Internal Server Error'})
        }

def create_session(event, context):
    # 새 세션 생성
    session_id = f"sess_{str(uuid.uuid4())}"
    created_at = datetime.now().isoformat()
    expires_at = datetime.fromtimestamp(datetime.now().timestamp() + 7200).isoformat()  # 2시간 후
    
    sessions_table.put_item(Item={
        'sessionId': session_id,
        'status': 'idle',
        'createdAt': created_at,
        'expiresAt': expires_at,
        'TTL': int(datetime.now().timestamp() + 7200)
    })
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'sessionId': session_id,
            'createdAt': created_at,
            'expiresAt': expires_at
        })
    }

def list_sessions(event, context):
    # 세션 목록 조회 (간단한 구현)
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'sessions': []})
    }

def process_session(event, context):
    # 기존 세션 처리 로직
    session_id = event['pathParameters']['id']
    body = json.loads(event['body'])
    user_profile = body.get('userProfile')
    
    logger.info(f"Processing session: {session_id}")
    
    if not user_profile or 'target' not in user_profile:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': 'INVALID_PROFILE', 'message': '프로필이 필요합니다.'})
        }
    
    sessions_table.update_item(
        Key={'sessionId': session_id},
        UpdateExpression="SET #status = :status, #profile = :profile, #updatedAt = :updatedAt",
        ExpressionAttributeNames={'#status': 'status', '#profile': 'profile', '#updatedAt': 'updatedAt'},
        ExpressionAttributeValues={
            ':status': 'processing',
            ':profile': user_profile,
            ':updatedAt': datetime.now().isoformat()
        }
    )
    
    workflow_input = {
        'sessionId': session_id,
        'profile': {
            'target': user_profile.get('target'),
            'budget': int(user_profile.get('responses', {}).get('100', 20000)),
            'servings': int(user_profile.get('responses', {}).get('101', 2))
        }
    }
    
    response = stepfunctions.start_execution(
        stateMachineArn='arn:aws:states:us-east-1:491085385364:stateMachine:ai-chef-workflow',
        name=f'execution-{int(datetime.now().timestamp())}',
        input=json.dumps(workflow_input)
    )
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'success': True,
            'executionId': response['executionArn'],
            'estimatedTime': 30,
            'status': 'processing',
            'message': '레시피 생성이 시작되었습니다.'
        })
    }
