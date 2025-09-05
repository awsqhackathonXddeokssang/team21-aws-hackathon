import json
import boto3
from datetime import datetime

def lambda_handler(event, context):
    try:
        recipe_name = event.get('recipeName', 'Default Recipe')
        
        # 기본 이미지 생성 로직 (실제 구현 필요)
        result = {
            'success': True,
            'data': {
                'imageUrl': f'https://example.com/recipe-images/{recipe_name.replace(" ", "-").lower()}.jpg',
                'recipeName': recipe_name,
                'generatedAt': datetime.now().isoformat()
            }
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json; charset=utf-8'},
            'body': result
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': {'success': False, 'error': str(e)}
        }
