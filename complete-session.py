import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
sessions_table = dynamodb.Table('ai-chef-sessions')
results_table = dynamodb.Table('ai-chef-results')

def handler(event, context):
    print('Complete session 요청:', json.dumps(event, ensure_ascii=False))
    
    try:
        session_id = event.get('sessionId')
        
        if not session_id:
            raise Exception('sessionId is required')
        
        # 세션 상태를 completed로 업데이트
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET #status = :status, lastActivity = :now',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'completed',
                ':now': datetime.utcnow().isoformat() + 'Z'
            }
        )
        
        # 더미 결과 생성
        result_data = {
            'sessionId': session_id,
            'recipe': {
                'title': '다이어트 샐러드',
                'ingredients': ['양상추', '토마토', '닭가슴살', '올리브오일'],
                'instructions': ['재료를 씻는다', '적당한 크기로 자른다', '드레싱과 함께 버무린다']
            },
            'nutrition': {
                'calories': 250,
                'protein': 25,
                'carbs': 10,
                'fat': 12
            },
            'price': {
                'total': 8500,
                'items': [
                    {'name': '양상추', 'price': 2000},
                    {'name': '토마토', 'price': 3000},
                    {'name': '닭가슴살', 'price': 3500}
                ]
            },
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }
        
        # 결과 저장
        results_table.put_item(Item=result_data)
        
        return {
            'statusCode': 200,
            'sessionId': session_id,
            'status': 'completed',
            'result': result_data
        }
        
    except Exception as error:
        print('Complete session 실패:', str(error))
        raise error
