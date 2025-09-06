import json
import urllib.request
import urllib.parse
import boto3
import os
from datetime import datetime
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

# AWS 리소스 초기화
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
sessions_table = dynamodb.Table('ai-chef-sessions')
results_table = dynamodb.Table('ai-chef-results')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Price Lambda handler - Results 테이블 저장"""
    try:
        print(f"🔍 Price Lambda 입력 데이터: {json.dumps(event, ensure_ascii=False)}")
        
        session_id = event.get('sessionId')
        
        # Recipe 결과에서 ingredients 추출
        ingredients = []
        
        # 직접 ingredients가 있는 경우
        if 'ingredients' in event:
            ingredients = event['ingredients']
            print(f"✅ 직접 ingredients 발견: {ingredients}")
        
        # recipeResult에서 추출하는 경우
        elif 'recipeResult' in event:
            print("🔍 recipeResult에서 추출 시도")
            recipe_result = event['recipeResult']
            if 'recipe' in recipe_result:
                recipe_data = recipe_result['recipe']
                print(f"🔍 recipe_data 타입: {type(recipe_data)}")
                
                # JSON 문자열인 경우 파싱
                if isinstance(recipe_data, str):
                    print("🔍 JSON 문자열 파싱 시도")
                    recipe_obj = json.loads(recipe_data)
                    print(f"🔍 파싱된 객체: {recipe_obj}")
                    ingredients = recipe_obj.get('recipe', {}).get('ingredients', [])
                    print(f"✅ 추출된 ingredients: {ingredients}")
                else:
                    ingredients = recipe_data.get('ingredients', [])
        
        # body.recipe에서 추출하는 경우
        elif 'body' in event and 'recipe' in event['body']:
            print("🔍 body.recipe에서 추출 시도")
            recipe = event['body']['recipe']
            ingredients = recipe.get('ingredients', [])
        
        # ingredients가 객체 배열인 경우 name만 추출
        if ingredients and isinstance(ingredients[0], dict):
            print("🔍 객체 배열에서 name 추출")
            ingredients = [ing.get('name', str(ing)) for ing in ingredients]
        
        print(f"🎯 최종 ingredients: {ingredients}")
        print(f"🎯 sessionId: {session_id}")
        
        if not session_id or not ingredients:
            return {
                'statusCode': 400,
                'body': {'error': 'ingredients and sessionId required', 'success': False}
            }
        
        # 세션 상태 업데이트 (진행률 50%)
        update_session_status(session_id, 'price_processing', 50)
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET priceStatus = :status',
            ExpressionAttributeValues={':status': 'processing'}
        )
        
        # 재료별 가격 조회
        price_results = {}
        for ingredient in ingredients:
            ingredient_name = ingredient if isinstance(ingredient, str) else ingredient.get('name', ingredient)
            price_results[ingredient_name] = get_ingredient_prices(ingredient_name)
        
        # 응답 데이터 구성
        result = format_pricing_result(price_results, session_id)
        
        # Results 테이블에 저장
        save_to_results_table(session_id, result, ingredients)
        
        # 세션 상태 완료 (진행률 80%)
        update_session_status(session_id, 'price_completed', 80)
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET priceStatus = :status',
            ExpressionAttributeValues={':status': 'completed'}
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json; charset=utf-8'},
            'body': result
        }
        
    except Exception as e:
        print(f'Price Lambda error: {e}')
        update_session_status(session_id, 'price_failed', 50, str(e))
        if session_id:
            sessions_table.update_item(
                Key={'sessionId': session_id},
                UpdateExpression='SET priceStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
        return {
            'statusCode': 500,
            'body': {'error': str(e), 'success': False}
        }

def save_to_results_table(session_id: str, result_data: Dict, ingredients: List):
    """Results 테이블에 가격 데이터 저장"""
    try:
        result_id = f"{session_id}_price"
        timestamp = datetime.now().isoformat()
        
        # Float를 Decimal로 변환
        converted_data = convert_floats_to_decimal(result_data['data'])
        
        # Results 테이블 저장 구조
        item = {
            'resultId': result_id,
            'sessionId': session_id,
            'type': 'price',
            'status': 'completed',
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'ttl': int(datetime.now().timestamp()) + (7 * 24 * 60 * 60),  # 7일 후 만료
            
            # 가격 데이터
            'data': converted_data,
            
            # 메타데이터
            'metadata': {
                'ingredientCount': len(ingredients),
                'requestedIngredients': ingredients,
                'processingTime': result_data.get('metadata', {}).get('timestamp', timestamp),
                'apiVersion': 'v1.0',
                'source': 'naver-shopping-api'
            },
            
            # 요약 정보 (빠른 조회용)
            'summary': {
                'totalIngredients': converted_data['summary']['totalIngredients'],
                'foundIngredients': converted_data['summary']['foundIngredients'], 
                'successRate': converted_data['summary']['successRate'],
                'totalEstimatedCost': converted_data['recommendations']['totalEstimatedCost'],
                'cheapestVendor': converted_data['recommendations']['optimalVendors'][0]['vendor'] if converted_data['recommendations']['optimalVendors'] else None
            }
        }
        
        results_table.put_item(Item=item)
        print(f"✅ Price data saved to results table: {result_id}")
        
        return result_id
        
    except Exception as e:
        print(f"❌ Failed to save to results table: {e}")
        raise e

def get_naver_credentials():
    """AWS Secrets Manager에서 네이버 API 키 가져오기"""
    secret_name = os.environ.get('NAVER_API_SECRET_NAME')
    if not secret_name:
        return {
            'client_id': os.environ.get('NAVER_CLIENT_ID', '5A_tDnltTaEiCEsXbHH7'),
            'client_secret': os.environ.get('NAVER_CLIENT_SECRET', 'ygjYjr9oqc')
        }
    
    try:
        secrets_client = boto3.client('secretsmanager', region_name='us-east-1')
        response = secrets_client.get_secret_value(SecretId=secret_name)
        secret_data = json.loads(response['SecretString'])
        return {
            'client_id': secret_data['client_id'],
            'client_secret': secret_data['client_secret']
        }
    except Exception as e:
        print(f"Failed to get secrets: {e}")
        return {
            'client_id': os.environ.get('NAVER_CLIENT_ID', '5A_tDnltTaEiCEsXbHH7'),
            'client_secret': os.environ.get('NAVER_CLIENT_SECRET', 'ygjYjr9oqc')
        }

def get_ingredient_prices(ingredient_name: str) -> List[Dict]:
    """네이버 쇼핑 API로 가격 조회 - 최저가 5개 반환"""
    credentials = get_naver_credentials()
    client_id = credentials['client_id']
    client_secret = credentials['client_secret']
    
    # 유사도순으로 100개 검색
    query = urllib.parse.quote(ingredient_name)
    url = f"https://openapi.naver.com/v1/search/shop.json?query={query}&display=100&sort=sim"
    
    request = urllib.request.Request(url)
    request.add_header("X-Naver-Client-Id", client_id)
    request.add_header("X-Naver-Client-Secret", client_secret)
    
    try:
        response = urllib.request.urlopen(request)
        data = json.loads(response.read().decode('utf-8'))
        
        prices = []
        for item in data.get('items', []):
            title = item.get('title', '').replace('<b>', '').replace('</b>', '')
            price = int(item.get('lprice', 0))
            
            # 0원만 필터링
            if price <= 0:
                continue
            
            prices.append({
                'name': title,
                'price': price,
                'vendor': item.get('mallName', ''),
                'link': item.get('link', ''),
                'image': item.get('image', ''),
                'category': item.get('category1', ''),
                'productId': item.get('productId', ''),
                'brand': item.get('brand', ''),
                'availability': 'available'
            })
        
        # 가격순 정렬 후 최저가 5개 반환
        sorted_prices = sorted(prices, key=lambda x: x['price'])
        return sorted_prices[:5] if sorted_prices else []
        
    except Exception as e:
        print(f'재료 {ingredient_name} 조회 실패: {e}')
        return []

def format_pricing_result(price_results: Dict[str, List], session_id: str) -> Dict:
    """가격 결과 포맷팅"""
    found_ingredients = [k for k, v in price_results.items() if v]
    
    # recommendations: 각 재료별 최저가 1개씩
    recommendations = {}
    total_cost = 0
    for ingredient, items in price_results.items():
        if items:
            cheapest = items[0]  # 최저가 1개
            recommendations[ingredient] = cheapest
            total_cost += cheapest['price']
    
    return {
        'success': True,
        'data': {
            'summary': {
                'totalIngredients': len(price_results),
                'foundIngredients': len(found_ingredients),
                'successRate': len(found_ingredients) / len(price_results) if price_results else 0
            },
            'ingredients': price_results,  # 재료별 5개씩
            'recommendations': {
                'items': recommendations,  # 재료별 최저가 1개씩
                'totalEstimatedCost': total_cost,
                'optimalVendors': calculate_optimal_vendors(recommendations)
            }
        },
        'metadata': {
            'timestamp': datetime.now().isoformat(),
            'sessionId': session_id
        }
    }

def calculate_optimal_vendors(recommendations: Dict[str, Dict]) -> List[Dict]:
    """최적 판매처 계산 - recommendations 기반"""
    vendor_groups = {}
    
    for ingredient, item in recommendations.items():
        vendor = item['vendor']
        
        if vendor not in vendor_groups:
            vendor_groups[vendor] = {
                'vendor': vendor,
                'items': [],
                'totalPrice': 0,
                'itemCount': 0
            }
        
        vendor_groups[vendor]['items'].append({
            'ingredient': ingredient,
            **item
        })
        vendor_groups[vendor]['totalPrice'] += item['price']
        vendor_groups[vendor]['itemCount'] += 1
    
    return sorted(vendor_groups.values(), key=lambda x: x['totalPrice'])

def update_session_status(session_id: str, phase: str, progress: int, error_message: str = None):
    """세션 상태 업데이트"""
    try:
        update_expression = "SET #phase = :phase, #progress = :progress, #updatedAt = :updatedAt"
        expression_values = {
            ':phase': phase,
            ':progress': progress,
            ':updatedAt': datetime.now().isoformat()
        }
        
        if error_message:
            update_expression += ", #errorMessage = :errorMessage"
            expression_values[':errorMessage'] = error_message
        
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames={
                '#phase': 'phase',
                '#progress': 'progress',
                '#updatedAt': 'updatedAt',
                '#errorMessage': 'errorMessage'
            },
            ExpressionAttributeValues=expression_values
        )
        
    except Exception as e:
        print(f"Failed to update session status: {e}")
