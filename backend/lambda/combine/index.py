import json
import boto3
import os
from datetime import datetime

# AWS 리소스 초기화
dynamodb = boto3.resource('dynamodb')
sessions_table = dynamodb.Table(os.environ.get('SESSIONS_TABLE_NAME', 'ai-chef-sessions'))
results_table = dynamodb.Table(os.environ.get('RESULTS_TABLE_NAME', 'ai-chef-results'))

def handler(event, context):
    """Combine results and update session status"""
    print('Combine 요청:', json.dumps(event, ensure_ascii=False))
    
    try:
        session_id = event.get('sessionId')
        
        if not session_id:
            raise Exception('sessionId is required')
        
        # 더미 결과 생성 (실제로는 Step Functions에서 전달받은 결과들을 조합)
        combined_result = {
            'sessionId': session_id,
            'recipe': {
                'title': '건강한 다이어트 샐러드',
                'ingredients': [
                    '양상추 100g',
                    '방울토마토 10개',
                    '닭가슴살 150g',
                    '올리브오일 1큰술',
                    '발사믹 식초 1작은술'
                ],
                'instructions': [
                    '1. 양상추를 깨끗이 씻어 적당한 크기로 자릅니다.',
                    '2. 방울토마토를 반으로 자릅니다.',
                    '3. 닭가슴살을 구워서 한입 크기로 자릅니다.',
                    '4. 모든 재료를 볼에 담고 올리브오일과 발사믹 식초를 넣어 버무립니다.',
                    '5. 접시에 예쁘게 담아 완성합니다.'
                ],
                'cookingTime': '15분',
                'servings': 1
            },
            'nutrition': {
                'calories': 285,
                'protein': 28,
                'carbs': 12,
                'fat': 15,
                'fiber': 4,
                'sugar': 8
            },
            'price': {
                'total': 12500,
                'items': [
                    {'name': '양상추', 'price': 2500, 'quantity': '1포'},
                    {'name': '방울토마토', 'price': 3500, 'quantity': '1팩'},
                    {'name': '닭가슴살', 'price': 4500, 'quantity': '200g'},
                    {'name': '올리브오일', 'price': 1500, 'quantity': '1병'},
                    {'name': '발사믹 식초', 'price': 500, 'quantity': '1병'}
                ]
            },
            'image': {
                'url': 'https://example.com/recipe-image.jpg',
                'description': '신선한 다이어트 샐러드'
            },
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            'completedAt': datetime.utcnow().isoformat() + 'Z'
        }
        
        # 결과를 results 테이블에 저장
        results_table.put_item(Item=combined_result)
        
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
        
        print(f'결과 조합 완료: {session_id}')
        
        return {
            'statusCode': 200,
            'sessionId': session_id,
            'status': 'completed',
            'result': combined_result
        }
        
    except Exception as error:
        print('Combine 실패:', str(error))
        
        # 실패 시 세션 상태를 failed로 업데이트
        if session_id:
            try:
                sessions_table.update_item(
                    Key={'sessionId': session_id},
                    UpdateExpression='SET #status = :status, lastActivity = :now',
                    ExpressionAttributeNames={'#status': 'status'},
                    ExpressionAttributeValues={
                        ':status': 'failed',
                        ':now': datetime.utcnow().isoformat() + 'Z'
                    }
                )
            except:
                pass
        
        raise error
