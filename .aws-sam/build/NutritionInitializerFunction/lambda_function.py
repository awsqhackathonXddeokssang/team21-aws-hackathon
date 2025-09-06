import json
import boto3
import pandas as pd
from io import BytesIO
import os

s3 = boto3.client('s3')
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
opensearch = boto3.client('opensearchserverless')

def lambda_handler(event, context):
    """엑셀 데이터를 OpenSearch에 초기화하는 Lambda 함수"""
    
    bucket_name = os.environ['S3_BUCKET']
    opensearch_endpoint = os.environ['OPENSEARCH_ENDPOINT']
    
    try:
        # 1. S3에서 엑셀 파일 읽기
        processed_foods = process_excel_file(bucket_name, '가공식품DB_133569건.xlsx')
        standard_foods = process_excel_file(bucket_name, '국가표준식품성분표.xlsx')
        
        # 2. 데이터 통합 및 정제
        nutrition_data = merge_nutrition_data(processed_foods, standard_foods)
        
        # 3. 임베딩 생성 및 OpenSearch 인덱싱
        indexed_count = index_to_opensearch(nutrition_data, opensearch_endpoint)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully indexed {indexed_count} nutrition items',
                'processed_foods': len(processed_foods),
                'standard_foods': len(standard_foods)
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def process_excel_file(bucket_name, file_key):
    """S3에서 엑셀 파일을 읽어 DataFrame으로 변환"""
    response = s3.get_object(Bucket=bucket_name, Key=file_key)
    excel_data = response['Body'].read()
    
    df = pd.read_excel(BytesIO(excel_data))
    
    # 컬럼명 정규화
    df.columns = df.columns.str.strip().str.lower()
    
    return df.to_dict('records')

def merge_nutrition_data(processed_foods, standard_foods):
    """두 데이터셋을 통합하여 영양소 정보 구조화"""
    nutrition_items = []
    
    # 가공식품 데이터 처리
    for item in processed_foods:
        nutrition_item = {
            'ingredient_name': item.get('식품명', ''),
            'ingredient_name_keyword': item.get('식품명', '').strip(),
            'calories_per_100g': float(item.get('에너지(kcal)', 0) or 0),
            'protein': float(item.get('단백질(g)', 0) or 0),
            'fat': float(item.get('지방(g)', 0) or 0),
            'carbs': float(item.get('탄수화물(g)', 0) or 0),
            'fiber': float(item.get('식이섬유(g)', 0) or 0),
            'sodium': float(item.get('나트륨(mg)', 0) or 0),
            'category': '가공식품'
        }
        nutrition_items.append(nutrition_item)
    
    # 국가표준식품 데이터 처리
    for item in standard_foods:
        nutrition_item = {
            'ingredient_name': item.get('식품명', ''),
            'ingredient_name_keyword': item.get('식품명', '').strip(),
            'calories_per_100g': float(item.get('에너지(kcal)', 0) or 0),
            'protein': float(item.get('단백질(g)', 0) or 0),
            'fat': float(item.get('지방(g)', 0) or 0),
            'carbs': float(item.get('탄수화물(g)', 0) or 0),
            'fiber': float(item.get('식이섬유(g)', 0) or 0),
            'sodium': float(item.get('나트륨(mg)', 0) or 0),
            'category': '표준식품'
        }
        nutrition_items.append(nutrition_item)
    
    return nutrition_items

def get_bedrock_embedding(text):
    """Bedrock Titan을 사용하여 텍스트 임베딩 생성"""
    body = json.dumps({
        "inputText": text,
        "dimensions": 1024,
        "normalize": True
    })
    
    response = bedrock.invoke_model(
        modelId='amazon.titan-embed-g1-text-02',
        body=body,
        contentType='application/json'
    )
    
    response_body = json.loads(response['body'].read())
    return response_body['embedding']

def index_to_opensearch(nutrition_data, endpoint):
    """영양소 데이터를 OpenSearch에 인덱싱"""
    from opensearchpy import OpenSearch
    
    client = OpenSearch(
        hosts=[endpoint],
        use_ssl=True,
        verify_certs=True
    )
    
    indexed_count = 0
    batch_size = 100
    
    for i in range(0, len(nutrition_data), batch_size):
        batch = nutrition_data[i:i + batch_size]
        bulk_body = []
        
        for item in batch:
            # 임베딩 생성
            embedding_text = f"{item['ingredient_name']} {item['category']}"
            embedding = get_bedrock_embedding(embedding_text)
            item['embedding'] = embedding
            
            # 벌크 인덱싱 준비
            bulk_body.append({
                "index": {
                    "_index": "ingredient-nutrition",
                    "_id": f"{item['ingredient_name_keyword']}_{item['category']}"
                }
            })
            bulk_body.append(item)
        
        # 벌크 인덱싱 실행
        response = client.bulk(body=bulk_body)
        indexed_count += len(batch)
        
        print(f"Indexed batch {i//batch_size + 1}, total: {indexed_count}")
    
    return indexed_count
