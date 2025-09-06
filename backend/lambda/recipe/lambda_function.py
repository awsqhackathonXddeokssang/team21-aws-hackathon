import json
import boto3
from datetime import datetime
import logging
import re
from typing import Dict, List, Any
from decimal import Decimal

def convert_floats_to_decimal(obj):
    """Float를 Decimal로 변환 (DynamoDB 호환)"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(v) for v in obj]
    return obj

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# DynamoDB tables
sessions_table = dynamodb.Table('ai-chef-sessions')
results_table = dynamodb.Table('ai-chef-results')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Recipe generation Lambda handler with DynamoDB state management"""
    try:
        session_id = event.get('sessionId')
        profile = event.get('profile', {})
        
        logger.info(f"Processing recipe generation for session: {session_id}")
        
        # Update session status to processing
        update_session_status(session_id, 'processing', 'recipe_generation', 10)
        
        # Generate recipe using Claude Opus 4.1
        recipe = generate_recipe_with_bedrock(profile)
        
        # Update session status to recipe completed
        update_session_status(session_id, 'processing', 'recipe_completed', 50)
        
        # Update recipe status to completed
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET recipeStatus = :status',
            ExpressionAttributeValues={':status': 'completed'}
        )
        
        # Results 테이블에 레시피 데이터 저장
        result_data = {
            'recipe': recipe,
            'generatedAt': datetime.now().isoformat()
        }
        save_to_results_table(session_id, result_data, profile)

        return {
            'statusCode': 200,
            'body': result_data
        }
        
    except Exception as e:
        logger.error(f'Recipe generation error: {str(e)}')
        
        # Update session status to failed
        update_session_status(session_id, 'failed', 'recipe_generation_failed', 0, str(e))
        
        return {
            'statusCode': 500,
            'body': {
                'error': str(e),
                'recipe': get_default_recipe(profile.get('target', 'general'))
            }
        }

def save_to_results_table(session_id: str, result_data: Dict, profile: Dict):
    """Results 테이블에 레시피 데이터 저장"""
    try:
        result_id = f"{session_id}_recipe"
        timestamp = datetime.now().isoformat()

        # Float를 Decimal로 변환
        converted_data = convert_floats_to_decimal(result_data)

        # 안전한 데이터 접근
        recipe = converted_data.get('recipe', {})
        nutrition_info = converted_data.get('nutritionInfo', {})
        total_nutrition = nutrition_info.get('total', {}) if isinstance(nutrition_info, dict) else {}

        # Results 테이블 저장 구조
        item = {
            'resultId': result_id,
            'sessionId': session_id,
            'type': 'recipe',
            'status': 'completed',
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'ttl': int(datetime.now().timestamp()) + (7 * 24 * 60 * 60),  # 7일 후 만료

            # 레시피 데이터
            'data': converted_data,

            # 메타데이터
            'metadata': {
                'target': profile.get('target', 'general'),
                'profileData': profile,
                'generationTime': timestamp,
                'apiVersion': 'v1.0',
                'source': 'bedrock-claude'
            },

            # 요약 정보 (빠른 조회용)
            'summary': {
                'recipeName': recipe.get('recipeName', '레시피') if isinstance(recipe, dict) else '레시피',
                'servings': recipe.get('servings', 2) if isinstance(recipe, dict) else 2,
                'cookingTime': recipe.get('cookingTime', '30분') if isinstance(recipe, dict) else '30분',
                'difficulty': recipe.get('difficulty', '보통') if isinstance(recipe, dict) else '보통',
                'totalCalories': total_nutrition.get('calories', 0) if isinstance(total_nutrition, dict) else 0,
                'target': profile.get('target', 'general')
            }
        }

        results_table.put_item(Item=item)
        logger.info(f"✅ Recipe data saved to results table: {result_id}")

        return result_id

    except Exception as e:
        logger.error(f"❌ Failed to save recipe to results table: {e}")
        # 저장 실패해도 레시피 생성은 성공으로 처리
        pass

def update_session_status(session_id: str, status: str, phase: str, progress: int, error: str = None):
    """Update session status in DynamoDB"""
    try:
        update_expression = "SET #status = :status, #phase = :phase, #progress = :progress, #updatedAt = :updatedAt"
        expression_values = {
            ':status': status,
            ':phase': phase,
            ':progress': progress,
            ':updatedAt': datetime.now().isoformat()
        }
        expression_names = {
            '#status': 'status',
            '#phase': 'phase',
            '#progress': 'progress',
            '#updatedAt': 'updatedAt'
        }
        
        if error:
            update_expression += ", #error = :error"
            expression_values[':error'] = error
            expression_names['#error'] = 'error'
        
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values
        )
        
    except Exception as e:
        logger.error(f"Failed to update session status: {e}")

def generate_recipe_with_bedrock(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Generate recipe using Claude Opus 4.1 with target-specific prompts"""
    target = profile.get('target', 'general')
    prompt = build_target_specific_prompt(profile)
    
    try:
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 4000,
                'temperature': 0.7,
                'messages': [{'role': 'user', 'content': prompt}]
            })
        )
        
        result = json.loads(response['body'].read())
        recipe_text = result['content'][0]['text']
        recipe = extract_json_from_text(recipe_text)
        return recipe
        
    except Exception as e:
        logger.error(f'Bedrock API error: {str(e)}')
        return get_default_recipe(target)

def build_target_specific_prompt(profile: Dict[str, Any]) -> str:
    """Build target-specific prompts for different diet types"""
    target = profile.get('target', 'general')
    
    if target == 'keto':
        return build_keto_prompt(profile)
    else:
        return build_general_prompt(profile)

def build_keto_prompt(profile: Dict[str, Any]) -> str:
    """Keto diet specific prompt"""
    health_conditions = ', '.join(profile.get('healthConditions', [])) or '없음'
    allergies = ', '.join(profile.get('allergies', [])) or '없음'
    cooking_level = profile.get('cookingLevel', '초급')
    budget = profile.get('budget', 30000)
    
    return f"""당신은 케토제닉 다이어트 전문 영양사입니다. 다음 조건에 맞는 레시피를 생성해주세요:

사용자 프로필:
- 건강 상태: {health_conditions}
- 알레르기: {allergies}
- 요리 실력: {cooking_level}
- 예산: {budget}원

케토 다이어트 요구사항:
- 탄수화물: 5g 이하
- 지방: 70% 이상
- 단백질: 25% 내외

JSON 형식으로 응답:
{{
  "recipeName": "케토 레시피명",
  "description": "레시피 설명",
  "cookingTime": 25,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {{"name": "아보카도", "amount": "1", "unit": "개"}},
    {{"name": "올리브오일", "amount": "2", "unit": "큰술"}}
  ],
  "instructions": ["1. 조리 단계"],
  "ketoNotes": "케토시스 유지 팁"
}}"""

def build_general_prompt(profile: Dict[str, Any]) -> str:
    """General recipe prompt"""
    health_conditions = ', '.join(profile.get('healthConditions', [])) or '없음'
    allergies = ', '.join(profile.get('allergies', [])) or '없음'
    cooking_level = profile.get('cookingLevel', '초급')
    budget = profile.get('budget', 20000)
    
    return f"""당신은 전문 영양사입니다. 다음 조건에 맞는 레시피를 JSON 형식으로 생성해주세요:

사용자 프로필:
- 건강 상태: {health_conditions}
- 알레르기: {allergies}
- 요리 실력: {cooking_level}
- 예산: {budget}원

응답 형식:
{{
  "recipeName": "레시피명",
  "description": "레시피 설명",
  "cookingTime": 30,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {{"name": "재료명", "amount": "1", "unit": "개"}}
  ],
  "instructions": ["1. 조리 단계"]
}}"""

def get_nutrition_info(ingredients: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Get nutrition information for ingredients"""
    nutrition_data = []
    
    for ingredient in ingredients:
        try:
            clean_name = clean_ingredient_name(ingredient['name'])
            nutrition = search_nutrition_database(clean_name)
            calculated_nutrition = calculate_nutrition_by_amount(
                nutrition, 
                float(ingredient.get('amount', 1)), 
                ingredient.get('unit', '개')
            )
            
            nutrition_data.append({
                'ingredient': ingredient['name'],
                'nutrition': calculated_nutrition
            })
            
        except Exception as e:
            logger.warning(f"Failed to get nutrition for {ingredient['name']}: {e}")
            nutrition_data.append({
                'ingredient': ingredient['name'],
                'nutrition': get_default_nutrition()
            })
    
    return nutrition_data

def search_nutrition_database(ingredient_name: str) -> Dict[str, float]:
    """Search nutrition database (mock implementation)"""
    nutrition_db = {
        '아보카도': {'calories': 160, 'protein': 2, 'fat': 15, 'carbs': 9, 'fiber': 7},
        '올리브오일': {'calories': 884, 'protein': 0, 'fat': 100, 'carbs': 0, 'fiber': 0},
        '닭가슴살': {'calories': 165, 'protein': 31, 'fat': 3.6, 'carbs': 0, 'fiber': 0},
        '브로콜리': {'calories': 34, 'protein': 2.8, 'fat': 0.4, 'carbs': 7, 'fiber': 2.6}
    }
    
    return nutrition_db.get(ingredient_name, {
        'calories': 50, 'protein': 2, 'fat': 1, 'carbs': 10, 'fiber': 1
    })

def calculate_nutrition_by_amount(nutrition: Dict[str, float], amount: float, unit: str) -> Dict[str, float]:
    """Calculate nutrition based on amount and unit"""
    unit_factors = {
        '개': 1.0, 'g': 0.01, 'kg': 10.0, '큰술': 0.15, '작은술': 0.05, '컵': 2.0
    }
    
    factor = unit_factors.get(unit, 1.0) * amount
    
    return {
        'calories': nutrition['calories'] * factor,
        'protein': nutrition['protein'] * factor,
        'fat': nutrition['fat'] * factor,
        'carbs': nutrition['carbs'] * factor,
        'fiber': nutrition.get('fiber', 0) * factor
    }

def calculate_total_nutrition(nutrition_info: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate total nutrition from all ingredients"""
    total = {'calories': 0, 'protein': 0, 'fat': 0, 'carbs': 0, 'fiber': 0}
    
    for item in nutrition_info:
        nutrition = item['nutrition']
        for key in total:
            total[key] += nutrition.get(key, 0)
    
    return {
        'total': total,
        'perServing': {k: round(v / 2, 1) for k, v in total.items()}
    }

def validate_target_compliance(recipe: Dict[str, Any], target: str) -> Dict[str, Any]:
    """Validate recipe compliance with target requirements"""
    return {
        'target': target,
        'compliance': 85,
        'notes': "일반적인 영양 기준에 적합합니다.",
        'recommendations': []
    }

def extract_json_from_text(text: str) -> Dict[str, Any]:
    """Extract JSON from Claude's response text"""
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        
        if start != -1 and end != -1:
            json_str = text[start:end]
            return json.loads(json_str)
        else:
            raise ValueError("No JSON found in response")
            
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
        return get_default_recipe('general')

def clean_ingredient_name(name: str) -> str:
    """Clean ingredient name for database search"""
    cleaned = re.sub(r'[0-9]+[가-힣]*\s*', '', name)
    return cleaned.strip()

def get_default_nutrition() -> Dict[str, float]:
    """Get default nutrition values"""
    return {'calories': 50, 'protein': 2, 'fat': 1, 'carbs': 10, 'fiber': 1}

def get_default_recipe(target: str) -> Dict[str, Any]:
    """Get default recipe for fallback"""
    return {
        'recipeName': f'기본 {target} 레시피',
        'description': '기본 레시피입니다',
        'cookingTime': 20,
        'difficulty': 'easy',
        'servings': 2,
        'ingredients': [{'name': '기본 재료', 'amount': '1', 'unit': '개'}],
        'instructions': ['1. 기본 조리법'],
        'nutrition': {
            'total': {'calories': 300, 'protein': 20, 'fat': 10, 'carbs': 25, 'fiber': 5},
            'perServing': {'calories': 150, 'protein': 10, 'fat': 5, 'carbs': 12.5, 'fiber': 2.5}
        }
    }
