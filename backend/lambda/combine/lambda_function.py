import json
import boto3
import logging
from datetime import datetime
from typing import Dict, Any

# 로깅 설정
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS 리소스 초기화
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
sessions_table = dynamodb.Table('ai-chef-sessions')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Combine Lambda handler - Recipe Lambda 스타일"""
    session_id = None
    try:
        logger.info("=== Combine Lambda 시작 ===")
        logger.info(f"입력 이벤트: {json.dumps(event, ensure_ascii=False, default=str)}")
        logger.info(f"입력 이벤트 타입: {type(event)}")
        logger.info(f"입력 이벤트 키들: {list(event.keys()) if isinstance(event, dict) else 'Not a dict'}")
        
        # Step Functions 형식 처리
        session_id = event.get('sessionId')
        recipe_result = event.get('recipeResult')
        pricing_result = event.get('pricingResult')
        profile = event.get('profile')
        
        # JSON 문자열 파싱
        if isinstance(recipe_result, str):
            logger.info("recipeResult가 문자열입니다. JSON 파싱 중...")
            recipe_result = json.loads(recipe_result)
        
        logger.info(f"세션 ID: {session_id}")
        logger.info(f"레시피 결과 타입: {type(recipe_result)}")
        logger.info(f"가격 결과 타입: {type(pricing_result)}")
        logger.info(f"프로필 타입: {type(profile)}")
        
        if recipe_result:
            logger.info(f"레시피 결과 키들: {list(recipe_result.keys()) if isinstance(recipe_result, dict) else 'Not a dict'}")
            if isinstance(recipe_result, dict) and 'recipe' in recipe_result:
                logger.info(f"레시피 데이터 타입: {type(recipe_result['recipe'])}")
                logger.info(f"레시피 데이터 길이: {len(str(recipe_result['recipe']))}")
                logger.info(f"레시피 데이터 시작 부분: {str(recipe_result['recipe'])[:200]}...")
        
        if pricing_result:
            logger.info(f"가격 결과 키들: {list(pricing_result.keys()) if isinstance(pricing_result, dict) else 'Not a dict'}")
        
        if not session_id or not recipe_result or not pricing_result:
            error_msg = f'필수 데이터 누락 - sessionId: {bool(session_id)}, recipeResult: {bool(recipe_result)}, pricingResult: {bool(pricing_result)}'
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # 세션 상태 업데이트
        logger.info("세션 상태를 'combining_results'로 업데이트 중...")
        update_session_status(session_id, 'processing', 'combining_results', 90)
        
        # 레시피와 가격 데이터 결합
        logger.info("레시피와 가격 데이터 결합 시작...")
        combined_result = combine_recipe_with_prices(
            recipe_result, pricing_result, session_id, profile
        )
        
        logger.info("데이터 결합 완료, 최종 결과 저장 중...")
        # 최종 결과 저장
        save_final_result(session_id, combined_result)
        
        # 세션 완료
        logger.info("세션을 'completed' 상태로 업데이트 중...")
        update_session_status(session_id, 'completed', 'all_completed', 100)
        
        logger.info("=== Combine Lambda 성공적으로 완료 ===")
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json; charset=utf-8'
            },
            'body': combined_result
        }
        
    except Exception as e:
        logger.error(f"=== Combine Lambda 에러 발생 ===")
        logger.error(f"에러 타입: {type(e).__name__}")
        logger.error(f"에러 메시지: {str(e)}")
        logger.error(f"세션 ID: {session_id}")
        logger.error(f"입력 이벤트: {json.dumps(event, ensure_ascii=False, default=str)}")
        
        import traceback
        logger.error(f"스택 트레이스: {traceback.format_exc()}")
        
        if session_id:
            logger.error(f"세션 상태를 'failed'로 변경: {session_id}")
            update_session_status(session_id, 'failed', 'combining_failed', 90, str(e))
        
        return {
            'statusCode': 500,
            'body': {
                'success': False,
                'error': str(e)
            }
        }

def combine_recipe_with_prices(recipe_result: Dict, pricing_result: Dict, 
                             session_id: str, profile: Dict = None) -> Dict:
    """레시피와 가격 데이터 결합"""
    
    logger.info("=== 데이터 결합 함수 시작 ===")
    
    try:
        # recipe_result가 문자열인 경우 JSON 파싱
        if isinstance(recipe_result, str):
            logger.info("recipe_result가 문자열입니다. JSON 파싱 중...")
            recipe_result = json.loads(recipe_result)
        
        # 레시피 데이터 파싱
        logger.info("레시피 데이터 파싱 시작...")
        recipe_data = recipe_result.get('recipe')
        logger.info(f"원본 레시피 데이터 타입: {type(recipe_data)}")
        
        if isinstance(recipe_data, str):
            logger.info("레시피 데이터가 문자열입니다. JSON 파싱 시도...")
            logger.info(f"파싱할 JSON 길이: {len(recipe_data)}")
            logger.info(f"JSON 시작 부분: {recipe_data[:100]}...")
            
            try:
                recipe = json.loads(recipe_data)
                logger.info("JSON 파싱 성공!")
                logger.info(f"파싱된 레시피 타입: {type(recipe)}")
                logger.info(f"파싱된 레시피 키들: {list(recipe.keys()) if isinstance(recipe, dict) else 'Not a dict'}")
            except json.JSONDecodeError as je:
                logger.error(f"JSON 파싱 실패: {je}")
                logger.error(f"파싱 실패한 데이터: {recipe_data}")
                raise
        elif isinstance(recipe_data, dict):
            logger.info("레시피 데이터가 이미 딕셔너리입니다.")
            recipe = recipe_data
        else:
            logger.error(f"예상하지 못한 레시피 데이터 타입: {type(recipe_data)}")
            recipe = {}
        
        # 중첩된 recipe 키 확인
        if 'recipe' in recipe:
            logger.info("중첩된 'recipe' 키 발견, 내부 데이터 사용")
            recipe = recipe['recipe']
            logger.info(f"내부 레시피 타입: {type(recipe)}")
            logger.info(f"내부 레시피 키들: {list(recipe.keys()) if isinstance(recipe, dict) else 'Not a dict'}")
        
        logger.info(f"최종 레시피 데이터: {recipe}")
        
        # 가격 데이터 확인
        logger.info("가격 데이터 확인...")
        logger.info(f"가격 데이터: {pricing_result}")
        pricing = pricing_result
        
        # 영양 정보 처리
        logger.info("영양 정보 처리 중...")
        nutrition_data = recipe.get('nutrition', {}) if isinstance(recipe, dict) else {}
        logger.info(f"영양 정보: {nutrition_data}")
        
        nutrition = {
            'total': nutrition_data,
            'byIngredient': [],
            'density': calculate_nutrition_density(nutrition_data),
            'targetCompliance': recipe.get('targetCompliance', {}) if isinstance(recipe, dict) else {}
        }
        
        # 쇼핑 정보 생성
        logger.info("쇼핑 정보 생성 중...")
        shopping_info = create_shopping_info(pricing)
        
        # 총 예상 비용 계산
        total_cost = pricing.get('recommendations', {}).get('totalEstimatedCost', 0) if isinstance(pricing, dict) else 0
        logger.info(f"총 예상 비용: {total_cost}")
        
        # 최종 결과 구성
        logger.info("최종 결과 구성 중...")
        result = {
            'success': True,
            'data': {
                'sessionId': session_id,
                'recipe': {
                    'name': recipe.get('name', recipe.get('recipeName', '')) if isinstance(recipe, dict) else '',
                    'ingredients': recipe.get('ingredients', []) if isinstance(recipe, dict) else [],
                    'instructions': recipe.get('instructions', []) if isinstance(recipe, dict) else [],
                    'cookingTime': recipe.get('cookingTime', recipe.get('cooking_time', '')) if isinstance(recipe, dict) else '',
                    'difficulty': recipe.get('difficulty', 'medium') if isinstance(recipe, dict) else 'medium',
                    'servings': recipe.get('servings', 2) if isinstance(recipe, dict) else 2,
                    'targetCompliance': recipe.get('targetCompliance', {}) if isinstance(recipe, dict) else {}
                },
                'nutrition': nutrition,
                'pricing': pricing,
                'shoppingInfo': shopping_info,
                'totalEstimatedCost': total_cost,
                'generatedAt': datetime.now().isoformat(),
                'recipeImage': None,  # Recipe Image Generator 연동 시 사용
                'profile': profile,
                'summary': create_summary(recipe, pricing, nutrition, profile)
            },
            'error': None,
            'metadata': {
                'source': 'CombineLambda',
                'timestamp': datetime.now().isoformat(),
                'recipeSuccess': True,
                'priceSuccess': True,
                'processingTime': 0,  # Step Functions에서 계산
                'version': '2.0'
            }
        }
        
        logger.info("=== 데이터 결합 함수 완료 ===")
        return result
        
    except Exception as e:
        logger.error(f"데이터 결합 중 에러: {e}")
        logger.error(f"에러 발생 지점에서의 recipe_result: {recipe_result}")
        logger.error(f"에러 발생 지점에서의 pricing_result: {pricing_result}")
        raise

def calculate_nutrition_density(nutrition: Dict) -> Dict:
    """영양소 밀도 계산"""
    logger.info(f"영양소 밀도 계산 - 입력: {nutrition}")
    
    if not isinstance(nutrition, dict):
        logger.warning(f"영양 정보가 딕셔너리가 아님: {type(nutrition)}")
        return {}
    
    calories = nutrition.get('calories', 0)
    if calories == 0:
        logger.info("칼로리가 0이므로 밀도 계산 생략")
        return {}
    
    density = {
        'proteinPerCalorie': nutrition.get('protein', 0) / calories if calories > 0 else 0,
        'fatPerCalorie': nutrition.get('fat', 0) / calories if calories > 0 else 0,
        'carbsPerCalorie': nutrition.get('carbs', 0) / calories if calories > 0 else None,
        'fiberPer100Cal': nutrition.get('fiber', 0) * 100 / calories if calories > 0 else None
    }
    
    logger.info(f"계산된 영양소 밀도: {density}")
    return density

def create_shopping_info(pricing: Dict) -> Dict:
    """쇼핑 정보 생성"""
    logger.info(f"쇼핑 정보 생성 - 입력: {pricing}")
    
    if not isinstance(pricing, dict):
        logger.warning(f"가격 정보가 딕셔너리가 아님: {type(pricing)}")
        return {'items': [], 'totalItems': 0, 'totalCost': 0, 'optimalVendors': []}
    
    items = []
    total_items = 0
    total_cost = 0
    
    ingredients = pricing.get('ingredients', {})
    logger.info(f"처리할 재료 수: {len(ingredients)}")
    
    for ingredient_name, products in ingredients.items():
        if products:
            # 최저가 상품 선택
            cheapest = products[0]
            items.append({
                'ingredient': ingredient_name,
                'product': cheapest
            })
            total_items += 1
            total_cost += cheapest.get('price', 0)
    
    shopping_info = {
        'items': items,
        'totalItems': total_items,
        'totalCost': total_cost,
        'optimalVendors': pricing.get('recommendations', {}).get('optimalVendors', [])
    }
    
    logger.info(f"생성된 쇼핑 정보: {shopping_info}")
    return shopping_info

def create_summary(recipe: Dict, pricing: Dict, nutrition: Dict, profile: Dict) -> Dict:
    """요약 정보 생성"""
    logger.info("요약 정보 생성 중...")
    
    pricing_summary = pricing.get('summary', {}) if isinstance(pricing, dict) else {}
    
    summary = {
        'recipeAvailable': bool(recipe.get('name') or recipe.get('recipeName')) if isinstance(recipe, dict) else False,
        'pricingAvailable': pricing_summary.get('foundIngredients', 0) > 0,
        'nutritionAvailable': bool(nutrition.get('total')),
        'imageAvailable': False,  # Recipe Image Generator 연동 시 True
        'profileAvailable': bool(profile),
        'ingredientsFound': pricing_summary.get('foundIngredients', 0),
        'totalIngredients': pricing_summary.get('totalIngredients', 0),
        'successRate': pricing_summary.get('successRate', 0),
        'targetCompliance': recipe.get('targetCompliance', {}) if isinstance(recipe, dict) else {}
    }
    
    logger.info(f"생성된 요약 정보: {summary}")
    return summary

def update_session_status(session_id: str, status: str, phase: str, progress: int, error: str = None):
    """세션 상태 업데이트 - Recipe Lambda 스타일"""
    try:
        logger.info(f"세션 상태 업데이트: {session_id} -> {status} ({phase}, {progress}%)")
        
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
            expression_values[':error'] = error[:1000]
            expression_names['#error'] = 'error'
            logger.error(f"에러와 함께 상태 업데이트: {error[:100]}...")
        
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values
        )
        
        logger.info("세션 상태 업데이트 완료")
        
    except Exception as e:
        logger.error(f"세션 상태 업데이트 실패: {e}")

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

def save_final_result(session_id: str, result: Dict):
    """최종 결과 저장 - Recipe Lambda 스타일"""
    try:
        logger.info(f"최종 결과 저장 시작: {session_id}")
        logger.info(f"저장할 결과 크기: {len(str(result))}")
        
        # Float를 Decimal로 변환
        converted_data = convert_floats_to_decimal(result['data'])
        
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression="SET #finalResult = :result, #completedAt = :completedAt",
            ExpressionAttributeNames={
                '#finalResult': 'finalResult',
                '#completedAt': 'completedAt'
            },
            ExpressionAttributeValues={
                ':result': converted_data,  # ← Decimal로 변환된 데이터
                ':completedAt': datetime.now().isoformat()
            }
        )
        
        logger.info("최종 결과 저장 완료")
        
    except Exception as e:
        logger.error(f"최종 결과 저장 실패: {e}")
