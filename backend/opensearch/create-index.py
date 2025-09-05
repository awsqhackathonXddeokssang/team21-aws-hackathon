#!/usr/bin/env python3
"""
OpenSearch 클러스터에 영양소 인덱스를 생성하는 스크립트
"""

import json
import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection
from aws_requests_auth.aws_auth import AWSRequestsAuth
import os

def create_opensearch_client(endpoint, region='us-east-1'):
    """AWS 인증을 사용하여 OpenSearch 클라이언트 생성"""
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

def create_nutrition_index(client, index_name='ingredient-nutrition'):
    """영양소 정보를 위한 인덱스 생성"""
    
    index_mapping = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 100,
                "number_of_shards": 1,
                "number_of_replicas": 0
            },
            "analysis": {
                "analyzer": {
                    "korean": {
                        "type": "custom",
                        "tokenizer": "nori_tokenizer",
                        "filter": ["lowercase", "nori_part_of_speech"]
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                "ingredient_name": {
                    "type": "text",
                    "analyzer": "korean",
                    "fields": {
                        "keyword": {
                            "type": "keyword"
                        }
                    }
                },
                "ingredient_name_keyword": {
                    "type": "keyword"
                },
                "calories_per_100g": {
                    "type": "float"
                },
                "protein": {
                    "type": "float"
                },
                "fat": {
                    "type": "float"
                },
                "carbs": {
                    "type": "float"
                },
                "fiber": {
                    "type": "float"
                },
                "sodium": {
                    "type": "float"
                },
                "calcium": {
                    "type": "float"
                },
                "iron": {
                    "type": "float"
                },
                "category": {
                    "type": "keyword"
                },
                "embedding": {
                    "type": "knn_vector",
                    "dimension": 1536,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "nmslib",
                        "parameters": {
                            "ef_construction": 128,
                            "m": 24
                        }
                    }
                }
            }
        }
    }
    
    try:
        # 기존 인덱스가 있다면 삭제
        if client.indices.exists(index=index_name):
            print(f"Deleting existing index: {index_name}")
            client.indices.delete(index=index_name)
        
        # 새 인덱스 생성
        print(f"Creating index: {index_name}")
        response = client.indices.create(
            index=index_name,
            body=index_mapping
        )
        
        print(f"Index created successfully: {response}")
        return True
        
    except Exception as e:
        print(f"Error creating index: {str(e)}")
        return False

def create_search_templates(client):
    """검색 템플릿 생성"""
    
    # 정확한 재료명 검색 템플릿
    exact_search_template = {
        "script": {
            "lang": "mustache",
            "source": {
                "query": {
                    "term": {
                        "ingredient_name_keyword": "{{ingredient_name}}"
                    }
                }
            }
        }
    }
    
    # 유사도 검색 템플릿
    similarity_search_template = {
        "script": {
            "lang": "mustache",
            "source": {
                "query": {
                    "knn": {
                        "embedding": {
                            "vector": "{{query_vector}}",
                            "k": "{{k}}"
                        }
                    }
                }
            }
        }
    }
    
    try:
        # 템플릿 등록
        client.put_script(
            id="exact_ingredient_search",
            body=exact_search_template
        )
        
        client.put_script(
            id="similarity_ingredient_search", 
            body=similarity_search_template
        )
        
        print("Search templates created successfully")
        return True
        
    except Exception as e:
        print(f"Error creating search templates: {str(e)}")
        return False

def main():
    """메인 실행 함수"""
    
    # 환경변수에서 OpenSearch 엔드포인트 가져오기
    opensearch_endpoint = os.environ.get('OPENSEARCH_ENDPOINT')
    if not opensearch_endpoint:
        print("Error: OPENSEARCH_ENDPOINT environment variable not set")
        return False
    
    try:
        # OpenSearch 클라이언트 생성
        client = create_opensearch_client(opensearch_endpoint)
        
        # 클러스터 상태 확인
        health = client.cluster.health()
        print(f"Cluster health: {health['status']}")
        
        # 인덱스 생성
        if create_nutrition_index(client):
            print("✅ Nutrition index created successfully")
        else:
            print("❌ Failed to create nutrition index")
            return False
        
        # 검색 템플릿 생성
        if create_search_templates(client):
            print("✅ Search templates created successfully")
        else:
            print("❌ Failed to create search templates")
        
        return True
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
