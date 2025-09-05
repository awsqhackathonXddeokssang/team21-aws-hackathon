import json
import urllib.request
import urllib.parse
import boto3
import os
from datetime import datetime
from typing import Dict, List, Any

# AWS 리소스 초기화
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
sessions_table = dynamodb.Table('ai-chef-sessions')

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Price Lambda handler - Recipe Lambda 스타일"""
    try:
        session_id = event.get('sessionId')
        ingredients = event.get('ingredients', [])
        
        if not ingredients or not session_id:
            raise ValueError('ingredients and sessionId required')
        
        # 세션 상태 업데이트
        update_session_status(session_id, 'processing', 'price_lookup', 60)
        
        # 재료별 가격 조회
        price_results = {}
        for ingredient in ingredients:
            ingredient_name = ingredient if isinstance(ingredient, str) else ingredient.get('name', ingredient)
            price_results[ingredient_name] = get_ingredient_prices(ingredient_name)
        
        # 응답 데이터 구성
        result = format_pricing_result(price_results, session_id)
        
        # DynamoDB 저장
        save_price_data(session_id, result)
        
        # 세션 상태 완료
        update_session_status(session_id, 'processing', 'price_completed', 80)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json; charset=utf-8'
            },
            'body': result
        }
        
    except Exception as e:
        update_session_status(session_id, 'failed', 'price_lookup_failed', 60, str(e))
        return {
            'statusCode': 500,
            'body': {
                'error': str(e),
                'success': False
            }
        }

def get_naver_credentials():
    """AWS Secrets Manager에서 네이버 API 키 가져오기"""
    import boto3
    import json
    
    secret_name = os.environ.get('NAVER_API_SECRET_NAME')
    if not secret_name:
        # Fallback to environment variables
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
        # Fallback to environment variables
        return {
            'client_id': os.environ.get('NAVER_CLIENT_ID', '5A_tDnltTaEiCEsXbHH7'),
            'client_secret': os.environ.get('NAVER_CLIENT_SECRET', 'ygjYjr9oqc')
        }

def get_ingredient_prices(ingredient_name: str) -> List[Dict]:
    """네이버 쇼핑 API로 가격 조회 - Secrets Manager 사용"""
    credentials = get_naver_credentials()
    client_id = credentials['client_id']
    client_secret = credentials['client_secret']
    
    # 한글 인코딩 수정
    query = urllib.parse.quote(ingredient_name)
    url = f"https://openapi.naver.com/v1/search/shop.json?query={query}&display=20&sort=asc"
    
    request = urllib.request.Request(url)
    request.add_header("X-Naver-Client-Id", client_id)
    request.add_header("X-Naver-Client-Secret", client_secret)
    
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            # UTF-8 디코딩 명시
            data = json.loads(response.read().decode('utf-8'))
        
        prices = []
        for item in data.get('items', []):
            # 한글 제목 정리
            title = item.get('title', '').replace('<b>', '').replace('</b>', '')
            price = int(item.get('lprice', 0))
            
            # 0원 상품만 필터링
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
        
        # 가격순 정렬 후 상위 10개만 반환
        sorted_prices = sorted(prices, key=lambda x: x['price'])
        return sorted_prices[:10]
        
    except Exception as e:
        print(f'재료 {ingredient_name} 조회 실패: {e}')
        return []

def format_pricing_result(price_results: Dict[str, List], session_id: str) -> Dict:
    """가격 결과 포맷팅"""
    found_ingredients = [k for k, v in price_results.items() if v]
    total_cost = sum(items[0]['price'] for items in price_results.values() if items)
    
    return {
        'success': True,
        'data': {
            'summary': {
                'totalIngredients': len(price_results),
                'foundIngredients': len(found_ingredients),
                'successRate': len(found_ingredients) / len(price_results) if price_results else 0
            },
            'ingredients': price_results,
            'recommendations': {
                'totalEstimatedCost': total_cost,
                'optimalVendors': calculate_optimal_vendors(price_results)
            }
        },
        'metadata': {
            'timestamp': datetime.now().isoformat(),
            'sessionId': session_id
        }
    }

def calculate_optimal_vendors(price_results: Dict[str, List]) -> List[Dict]:
    """최적 판매처 계산"""
    vendor_groups = {}
    
    for ingredient, items in price_results.items():
        if not items:
            continue
            
        cheapest = items[0]
        vendor = cheapest['vendor']
        
        if vendor not in vendor_groups:
            vendor_groups[vendor] = {'items': [], 'totalPrice': 0, 'itemCount': 0}
        
        vendor_groups[vendor]['items'].append({'ingredient': ingredient, **cheapest})
        vendor_groups[vendor]['totalPrice'] += cheapest['price']
        vendor_groups[vendor]['itemCount'] += 1
    
    return [{'vendor': vendor, **data} for vendor, data in vendor_groups.items()]

def update_session_status(session_id: str, status: str, phase: str, progress: int, error: str = None):
    """세션 상태 업데이트 - Recipe Lambda 스타일"""
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
            expression_values[':error'] = error[:1000]
            expression_names['#error'] = 'error'
        
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values
        )
        
    except Exception as e:
        print(f"Failed to update session status: {e}")

def save_price_data(session_id: str, result_data: Dict):
    """가격 데이터 저장 - Recipe Lambda 스타일"""
    try:
        # 데이터 크기 제한
        data_str = json.dumps(result_data['data'])
        if len(data_str) > 350000:  # 350KB 제한
            # 재료당 5개만 저장
            truncated_ingredients = {
                k: v[:5] for k, v in result_data['data']['ingredients'].items()
            }
            result_data['data']['ingredients'] = truncated_ingredients
        
        sessions_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression="SET #priceData = :priceData, #priceUpdatedAt = :updatedAt",
            ExpressionAttributeNames={
                '#priceData': 'priceData',
                '#priceUpdatedAt': 'priceUpdatedAt'
            },
            ExpressionAttributeValues={
                ':priceData': result_data['data'],
                ':updatedAt': datetime.now().isoformat()
            }
        )
        
    except Exception as e:
        print(f"Failed to save price data: {e}")
