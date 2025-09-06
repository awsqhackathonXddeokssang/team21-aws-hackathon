import json
import boto3
import os
from datetime import datetime
import uuid

# AWS 클라이언트 초기화
dynamodb = boto3.resource('dynamodb')
sessions_table = dynamodb.Table(os.environ['SESSIONS_TABLE_NAME'])
stepfunctions = boto3.client('stepfunctions')

def handler(event, context):
    print('Process 요청:', json.dumps(event, ensure_ascii=False))
    
    # CORS preflight 처리
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': ''
        }
    
    try:
        # 요청 본문 파싱
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('sessionId')
        
        if not session_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'sessionId is required'}, ensure_ascii=False)
            }
        
        # 세션 상태를 processing으로 업데이트
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET #status = :status, lastActivity = :now',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'processing',
                ':now': datetime.utcnow().isoformat() + 'Z'
            }
        )
        
        # Step Functions 실행
        execution_name = f"execution-{session_id}-{str(uuid.uuid4())[:8]}"
        execution_input = {
            'sessionId': session_id,
            'input': body
        }
        
        response = stepfunctions.start_execution(
            stateMachineArn='arn:aws:states:us-east-1:491085385364:stateMachine:ai-chef-workflow-new',
            name=execution_name,
            input=json.dumps(execution_input)
        )
        
        print(f'Step Functions 실행 시작: {response["executionArn"]}')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Processing started',
                'sessionId': session_id,
                'status': 'processing',
                'executionArn': response['executionArn']
            }, ensure_ascii=False)
        }
        
    except Exception as error:
        print('Process 실패:', str(error))
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Processing failed: {str(error)}'}, ensure_ascii=False)
        }
