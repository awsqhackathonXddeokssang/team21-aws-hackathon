import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')
results_table = dynamodb.Table(os.environ.get('RESULTS_TABLE_NAME', 'ai-chef-results'))

def handler(event, context):
    print('Result 요청:', json.dumps(event, ensure_ascii=False))
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    try:
        # Get sessionId from path parameters - handle both patterns
        path_params = event.get('pathParameters', {}) or {}
        session_id = path_params.get('sessionId') or path_params.get('id')
        
        print(f'Path parameters: {path_params}')
        print(f'Session ID: {session_id}')
        
        if not session_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Session ID is required'}, ensure_ascii=False)
            }

        # Get result from DynamoDB
        response = results_table.get_item(Key={'sessionId': session_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Result not found'}, ensure_ascii=False)
            }

        result = response['Item']
        
        # Return result
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(result, ensure_ascii=False, default=str)
        }

    except Exception as error:
        print('Result 조회 실패:', str(error))
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'Internal server error: {str(error)}'}, ensure_ascii=False)
        }
