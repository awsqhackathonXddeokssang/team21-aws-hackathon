import json
import boto3
import os
import re
from typing import Dict, List, Any, Optional

# AWS 클라이언트 초기화
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
dynamodb = boto3.client('dynamodb', region_name='us-east-1')

def update_session_status(session_id: str, progress: int, status: str = 'processing'):
    """세션 상태 업데이트"""
    try:
        dynamodb.update_item(
            TableName='ai-chef-sessions',
            Key={'sessionId': {'S': session_id}},
            UpdateExpression='SET progress = :progress, #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':progress': {'N': str(progress)},
                ':status': {'S': status}
            }
        )
    except Exception as error:
        print(f'Failed to update session status: {error}')

def calculate_nutrition_with_ai(recipe: Dict, profile: Dict) -> Dict:
    """AI를 사용한 영양소 계산"""
    ingredients = recipe.get('ingredients', [])
    
    # 안전장치: ingredients 배열 확인
    if not isinstance(ingredients, list):
        print(f'❌ Invalid ingredients format: {ingredients}')
        raise ValueError('Invalid ingredients format')
    
    ingredients_list = ', '.join([
        ing if isinstance(ing, str) else ing.get('name', 'Unknown ingredient')
        for ing in ingredients
    ]) if ingredients else 'No ingredients available'
        
    prompt = f"""다음 레시피의 정확한 영양소를 계산해주세요:

레시피: {recipe.get('recipeName', 'Unknown Recipe')}
재료: {ingredients_list}
인분: {profile.get('servings', 2)}인분

사용자 프로필:
- 목표: {profile.get('target', '일반')}
- 탄수화물 제한: {profile.get('carbLimit', 50)}g

다음 JSON 형식으로만 응답해주세요:
{{
  "nutrition": {{
    "calories": 숫자,
    "carbs": 숫자,
    "protein": 숫자,
    "fat": 숫자,
    "fiber": 숫자,
    "sodium": 숫자
  }},
  "nutritionPerServing": {{
    "calories": 숫자,
    "carbs": 숫자,
    "protein": 숫자,
    "fat": 숫자
  }}
}}"""

    try:
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 1000,
                'messages': [{
                    'role': 'user',
                    'content': prompt
                }]
            }),
            contentType='application/json'
        )

        response_body = json.loads(response['body'].read())
        
        # 안전장치: content 배열 확인
        if not response_body.get('content') or not isinstance(response_body['content'], list) or len(response_body['content']) == 0:
            print(f'❌ Invalid AI response structure: {response_body}')
            raise ValueError('Invalid AI response structure')
        
        nutrition_text = response_body['content'][0]['text']
        
        print(f'🔍 AI Response: {nutrition_text}')
        
        # JSON 추출 시도 (여러 패턴)
        json_match = re.search(r'\{[\s\S]*\}', nutrition_text)
        if not json_match:
            # 코드 블록 내 JSON 찾기
            code_match = re.search(r'```json\s*(\{[\s\S]*?\})\s*```', nutrition_text)
            if code_match:
                json_match = code_match.group(1)
            else:
                json_match = None
        else:
            json_match = json_match.group(0)
        
        if json_match:
            try:
                if not json_match:
                    print('❌ Empty JSON match result')
                    raise ValueError('Empty JSON match result')
                
                parsed = json.loads(json_match)
                print(f'✅ Parsed nutrition: {parsed}')
                return parsed
            except json.JSONDecodeError as parse_error:
                print(f'JSON parse error: {parse_error}')
                print(f'Raw JSON: {json_match}')
        
        # JSON을 찾지 못한 경우 에러 발생
        print('❌ No valid JSON found in AI response')
        raise ValueError('No valid JSON found in AI response')
    except Exception as error:
        print(f'AI nutrition calculation failed: {error}')
        raise error

def convert_to_attribute_value(obj):
    """Python 객체를 DynamoDB AttributeValue로 변환"""
    if isinstance(obj, str):
        return {'S': obj}
    elif isinstance(obj, (int, float)):
        return {'N': str(obj)}
    elif isinstance(obj, bool):
        return {'BOOL': obj}
    elif isinstance(obj, list):
        return {'L': [convert_to_attribute_value(item) for item in obj]}
    elif isinstance(obj, dict):
        return {'M': {key: convert_to_attribute_value(value) for key, value in obj.items()}}
    else:
        return {'NULL': True}

def update_recipe_nutrition(session_id: str, nutrition: Dict) -> Optional[str]:
    """레시피에 영양 정보 업데이트"""
    try:
        # sessionId로 기존 recipe 레코드 찾기 (스캔 사용)
        scan_params = {
            'TableName': 'ai-chef-results',
            'FilterExpression': 'sessionId = :sessionId AND #type = :type',
            'ExpressionAttributeNames': {'#type': 'type'},
            'ExpressionAttributeValues': {
                ':sessionId': {'S': session_id},
                ':type': {'S': 'recipe'}
            }
        }

        result = dynamodb.scan(**scan_params)
        
        # 안전장치: Items 배열 확인
        if not result.get('Items') or len(result['Items']) == 0:
            print(f'⚠️ No recipe record found for sessionId: {session_id}')
            return None
        
        recipe_item = result['Items'][0]
        
        # 안전장치: resultId 확인
        if not recipe_item.get('resultId') or not recipe_item['resultId'].get('S'):
            print(f'❌ Invalid recipe item structure: {recipe_item}')
            return None
        
        result_id = recipe_item['resultId']['S']
            
        # 기존 레코드의 nutrition 정보 업데이트
        update_params = {
            'TableName': 'ai-chef-results',
            'Key': {'resultId': {'S': result_id}},
            'UpdateExpression': 'SET #data.#nutrition = :nutrition, #updatedAt = :updatedAt',
            'ExpressionAttributeNames': {
                '#data': 'data',
                '#nutrition': 'nutrition',
                '#updatedAt': 'updatedAt'
            },
            'ExpressionAttributeValues': {
                ':nutrition': convert_to_attribute_value(nutrition),
                ':updatedAt': {'S': json.dumps(nutrition, default=str)}
            }
        }

        dynamodb.update_item(**update_params)
        print('✅ Recipe nutrition updated successfully')
        return result_id
    except Exception as error:
        print(f'❌ Failed to update recipe nutrition: {error}')
        raise error

def lambda_handler(event, context):
    """Lambda 핸들러"""
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers}

    try:
        # 요청 본문 파싱
        if isinstance(event.get('body'), str):
            request_body = json.loads(event['body'])
        else:
            request_body = event

        session_id = request_body.get('sessionId')
        recipe_data = request_body.get('recipe') or request_body.get('recipeData')
        profile = request_body.get('profile', {})

        if not session_id or not recipe_data:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'sessionId and recipe are required'})
            }

        # JSON 문자열 파싱 (다른 Lambda와 동일한 로직)
        if isinstance(recipe_data, str):
            parsed = json.loads(recipe_data)
            recipe_obj = parsed.get('recipe', parsed)
        else:
            recipe_obj = recipe_data.get('recipe', recipe_data)

        print(f'🧮 Starting nutrition calculation for: {recipe_obj.get("recipeName")}')
        
        # 세션 상태 업데이트 (85% 진행률)
        update_session_status(session_id, 85)
        
        # nutritionStatus를 processing으로 업데이트
        dynamodb.update_item(
            TableName='ai-chef-sessions',
            Key={'sessionId': {'S': session_id}},
            UpdateExpression='SET nutritionStatus = :status',
            ExpressionAttributeValues={':status': {'S': 'processing'}}
        )

        print('🤖 Using AI nutrition estimation')
        
        # AI 기반 영양소 추정
        final_nutrition = calculate_nutrition_with_ai(recipe_obj, profile)

        # 기존 recipe 레코드에 영양 정보 업데이트
        update_recipe_nutrition(session_id, final_nutrition)

        # 세션 상태 업데이트 (90% 진행률)
        update_session_status(session_id, 90)
        
        # nutritionStatus를 completed로 업데이트
        dynamodb.update_item(
            TableName='ai-chef-sessions',
            Key={'sessionId': {'S': session_id}},
            UpdateExpression='SET nutritionStatus = :status',
            ExpressionAttributeValues={':status': {'S': 'completed'}}
        )

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'nutrition': final_nutrition,
                'sessionId': session_id,
                'status': 'completed'
            })
        }
    except Exception as error:
        print(f'❌ Nutrition calculation error: {error}')
        
        try:
            update_session_status(session_id, 85, 'failed')
            # nutritionStatus를 failed로 업데이트
            dynamodb.update_item(
                TableName='ai-chef-sessions',
                Key={'sessionId': {'S': session_id}},
                UpdateExpression='SET nutritionStatus = :status',
                ExpressionAttributeValues={':status': {'S': 'failed'}}
            )
        except Exception as db_error:
            print(f'Error updating failed status: {db_error}')
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Nutrition calculation failed',
                'details': str(error)
            })
        }
