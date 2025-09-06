import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['SESSIONS_TABLE_NAME'])

def handler(event, context):
    print('Status 요청:', json.dumps(event, ensure_ascii=False))
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    try:
        # Get sessionId from path parameters
        session_id = event.get('pathParameters', {}).get('sessionId')
        
        if not session_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Session ID is required'}, ensure_ascii=False)
            }

        # Get session from DynamoDB
        response = table.get_item(Key={'sessionId': session_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Session not found'}, ensure_ascii=False)
            }

        session = response['Item']
        
        # Return session status
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'sessionId': session['sessionId'],
                'status': session.get('status', 'idle'),
                'createdAt': session.get('createdAt'),
                'expiresAt': session.get('expiresAt'),
                'lastActivity': session.get('lastActivity')
            }, ensure_ascii=False)
        }

    except Exception as error:
        print('Status 조회 실패:', str(error))
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'}, ensure_ascii=False)
        }
