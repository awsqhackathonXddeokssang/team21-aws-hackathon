import json
import boto3
import uuid
from datetime import datetime, timedelta
import os

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['SESSIONS_TABLE_NAME'])

def handler(event, context):
    print('세션 생성 요청:', json.dumps(event, ensure_ascii=False))

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
        session_id = f"sess_{str(uuid.uuid4())}"
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=2)
        
        session_record = {
            'sessionId': session_id,
            'status': 'idle',
            'createdAt': now.isoformat() + 'Z',
            'expiresAt': expires_at.isoformat() + 'Z',
            'lastActivity': now.isoformat() + 'Z',
            'ttl': int(expires_at.timestamp()),
            'retryCount': 0,
            'maxRetries': 3
        }

        table.put_item(Item=session_record)

        print('세션 생성 완료:', session_id)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'sessionId': session_record['sessionId'],
                'createdAt': session_record['createdAt'],
                'expiresAt': session_record['expiresAt']
            }, ensure_ascii=False)
        }

    except Exception as error:
        print('세션 생성 실패:', str(error))
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': '세션 생성 중 오류가 발생했습니다'
            }, ensure_ascii=False)
        }
