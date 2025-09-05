import json
import boto3
import os
from opensearchpy import OpenSearch, RequestsHttpConnection
from aws_requests_auth.aws_auth import AWSRequestsAuth
import sys
sys.path.append('/opt/python')
from rag_utils import BedrockRAGSystem

def lambda_handler(event, context):
    """레시피 재료들의 영양소 정보를 조회하는 Lambda 함수"""
    
    try:
        # 요청 데이터 파싱
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        ingredients = body.get('ingredients', [])
        user_profile = body.get('user_profile', {})
        
        if not ingredients:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'ingredients 필드가 필요합니다'})
            }
        
        # OpenSearch 클라이언트 초기화
        opensearch_client = create_opensearch_client()
        
        # Bedrock RAG 시스템 초기화
        rag_system = BedrockRAGSystem()
        
        # 각 재료의 영양소 정보 조회
        nutrition_info = []
        for ingredient in ingredients:
            ingredient_name, amount = rag_system.parse_ingredient(ingredient)
            
            # OpenSearch에서 영양소 정보 검색
            nutrition_data = search_nutrition(opensearch_client, rag_system, ingredient_name)
            
            if nutrition_data:
                # 양에 따른 영양소 계산
                calculated_nutrition = rag_system.calculate_nutrition(nutrition_data, amount)
                nutrition_info.append(calculated_nutrition)
            else:
                # 재료를 찾을 수 없는 경우
                nutrition_info.append({
                    'ingredient': ingredient,
                    'error': '영양소 정보를 찾을 수 없습니다',
                    'calories': 0,
                    'protein': 0,
                    'fat': 0,
                    'carbs': 0,
                    'fiber': 0,
                    'sodium': 0
                })
        
        # 총 영양소 계산
        total_nutrition = rag_system.sum_nutrition(nutrition_info)
        
        # 결과 구성
        result = {
            'total_nutrition': total_nutrition,
            'ingredient_details': nutrition_info
        }
        
        # AI 분석 생성 (선택적)
        if body.get('include_analysis', False):
            analysis = rag_system.generate_nutrition_analysis(result, user_profile)
            result['ai_analysis'] = analysis
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps(result, ensure_ascii=False)
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'서버 오류: {str(e)}'})
        }

def create_opensearch_client():
    """OpenSearch 클라이언트 생성"""
    endpoint = os.environ['OPENSEARCH_ENDPOINT']
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    host = endpoint.replace('https://', '').replace('http://', '')
    
    awsauth = AWSRequestsAuth(
        aws_access_key=boto3.Session().get_credentials().access_key,
        aws_secret_access_key=boto3.Session().get_credentials().secret_key,
        aws_token=boto3.Session().get_credentials().token,
        aws_host=host,
        aws_region=region,
        aws_service='es'
    )
    
    client = OpenSearch(
        hosts=[{'host': host, 'port': 443}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )
    
    return client

def search_nutrition(opensearch_client, rag_system, ingredient_name):
    """OpenSearch에서 영양소 정보 검색"""
    
    try:
        # 1. 정확한 매칭 시도
        exact_search = {
            "query": {
                "term": {
                    "ingredient_name_keyword": ingredient_name
                }
            }
        }
        
        response = opensearch_client.search(
            index="ingredient-nutrition",
            body=exact_search
        )
        
        if response['hits']['total']['value'] > 0:
            return response['hits']['hits'][0]['_source']
        
        # 2. 유사도 검색 (임베딩 기반)
        ingredient_embedding = rag_system.get_embedding(ingredient_name)
        
        if ingredient_embedding:
            similarity_search = {
                "query": {
                    "knn": {
                        "embedding": {
                            "vector": ingredient_embedding,
                            "k": 1
                        }
                    }
                }
            }
            
            response = opensearch_client.search(
                index="ingredient-nutrition",
                body=similarity_search
            )
            
            if response['hits']['total']['value'] > 0:
                hit = response['hits']['hits'][0]
                # 유사도 점수가 너무 낮으면 제외
                if hit['_score'] > 0.7:
                    return hit['_source']
        
        # 3. 부분 매칭 시도
        partial_search = {
            "query": {
                "match": {
                    "ingredient_name": {
                        "query": ingredient_name,
                        "fuzziness": "AUTO"
                    }
                }
            }
        }
        
        response = opensearch_client.search(
            index="ingredient-nutrition",
            body=partial_search
        )
        
        if response['hits']['total']['value'] > 0:
            return response['hits']['hits'][0]['_source']
        
        return None
        
    except Exception as e:
        print(f"Error searching nutrition data: {str(e)}")
        return None
