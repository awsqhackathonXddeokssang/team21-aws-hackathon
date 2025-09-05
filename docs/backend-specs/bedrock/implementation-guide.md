# 레시피 재료 영양소 RAG 구현 가이드

## 개요
레시피 추천 시 각 재료의 영양소 성분 정보를 실시간으로 제공하는 RAG 시스템 (Claude Opus 4.1 + Titan Text Embeddings v2 사용)

## 1. 데이터 초기화 (일회성)

### 엑셀 데이터 처리 Lambda
- **함수명**: `nutrition-data-initializer`
- **실행**: 수동 트리거 (일회성)
- **처리 데이터**:
  - 가공식품DB_133569건.xlsx
  - 국가표준식품성분표.xlsx

```python
def initialize_nutrition_data():
    # 1. S3에서 엑셀 파일 읽기
    # 2. 재료명을 키로 영양소 정보 구조화
    # 3. Bedrock으로 재료명 임베딩 생성
    # 4. OpenSearch에 인덱싱
    
    nutrition_doc = {
        "ingredient_name": "닭가슴살",
        "calories_per_100g": 165,
        "protein": 31.0,
        "fat": 3.6,
        "carbs": 0.0,
        "fiber": 0.0,
        "sodium": 74,
        "embedding": embedding_vector
    }
```

## 2. OpenSearch 인덱스 구조

```json
PUT /ingredient-nutrition
{
  "mappings": {
    "properties": {
      "ingredient_name": {"type": "text", "analyzer": "korean"},
      "ingredient_name_keyword": {"type": "keyword"},
      "calories_per_100g": {"type": "float"},
      "protein": {"type": "float"},
      "fat": {"type": "float"},
      "carbs": {"type": "float"},
      "fiber": {"type": "float"},
      "sodium": {"type": "float"},
      "calcium": {"type": "float"},
      "iron": {"type": "float"},
      "category": {"type": "keyword"},
      "embedding": {
        "type": "knn_vector",
        "dimension": 1024,
        "method": {"name": "hnsw", "space_type": "cosinesimil"}
      }
    }
  }
}
```

## 3. 레시피 재료 영양소 조회 API

### Lambda 함수: `recipe-nutrition-lookup`

```python
def lambda_handler(event, context):
    recipe_ingredients = event['ingredients']  # ["닭가슴살 200g", "브로콜리 100g"]
    
    nutrition_info = []
    for ingredient in recipe_ingredients:
        # 1. 재료명 파싱 (양 제거)
        ingredient_name, amount = parse_ingredient(ingredient)
        
        # 2. OpenSearch에서 영양소 정보 검색
        nutrition_data = search_nutrition(ingredient_name)
        
        # 3. 양에 따른 영양소 계산
        calculated_nutrition = calculate_nutrition(nutrition_data, amount)
        nutrition_info.append(calculated_nutrition)
    
    return {
        'total_nutrition': sum_nutrition(nutrition_info),
        'ingredient_details': nutrition_info
    }
```

### 재료명 매칭 로직

```python
def search_nutrition(ingredient_name):
    # 1. 정확한 매칭 시도
    exact_match = opensearch.search(
        body={"query": {"term": {"ingredient_name_keyword": ingredient_name}}}
    )
    
    if exact_match['hits']['total']['value'] > 0:
        return exact_match['hits']['hits'][0]['_source']
    
    # 2. 유사도 검색 (임베딩 기반)
    ingredient_embedding = get_bedrock_embedding(ingredient_name)
    
    similar_match = opensearch.search(
        body={
            "query": {
                "knn": {
                    "embedding": {
                        "vector": ingredient_embedding,
                        "k": 1
                    }
                }
            }
        }
    )
    
    return similar_match['hits']['hits'][0]['_source']
```

## 4. API 엔드포인트

### POST /recipe/nutrition
```json
{
  "ingredients": [
    "닭가슴살 200g",
    "브로콜리 100g", 
    "현미밥 150g"
  ]
}
```

### 응답 예시
```json
{
  "total_nutrition": {
    "total_calories": 445,
    "total_protein": 45.2,
    "total_fat": 8.1,
    "total_carbs": 35.7
  },
  "ingredient_details": [
    {
      "ingredient": "닭가슴살 200g",
      "calories": 330,
      "protein": 62.0,
      "fat": 7.2,
      "carbs": 0.0
    }
  ]
}
```

## 5. Bedrock 프롬프트 (영양소 설명용)

```python
NUTRITION_EXPLANATION_PROMPT = """
다음 레시피의 영양소 정보를 분석하여 건강상 이점과 주의사항을 설명해주세요:

레시피 재료별 영양소:
{ingredient_nutrition_details}

총 영양소:
- 칼로리: {total_calories}kcal
- 단백질: {total_protein}g
- 지방: {total_fat}g  
- 탄수화물: {total_carbs}g

사용자 프로필:
- 목표: {user_goal}
- 제한사항: {dietary_restrictions}

다음 형식으로 답변해주세요:
1. 영양소 균형 평가
2. 건강상 이점
3. 주의사항 (있다면)
4. 개선 제안 (있다면)
"""
```

## 6. 배치 처리 최적화

### 재료 그룹 검색
```python
def batch_nutrition_lookup(ingredients_list):
    # 여러 재료를 한번에 검색하여 API 호출 최적화
    embeddings = get_batch_embeddings(ingredients_list)
    
    search_body = {
        "query": {
            "bool": {
                "should": [
                    {"knn": {"embedding": {"vector": emb, "k": 1}}}
                    for emb in embeddings
                ]
            }
        }
    }
    
    return opensearch.search(body=search_body)
```

## 7. 캐싱 전략

- **Lambda 메모리 캐싱**: 자주 조회되는 재료 영양소 정보
- **API Gateway 캐싱**: 동일한 레시피 조합 결과
- **TTL**: 24시간 (영양소 정보는 변경 빈도 낮음)

## 8. 에러 처리

```python
def handle_missing_ingredient(ingredient_name):
    # 1. 유사한 재료명 제안
    suggestions = find_similar_ingredients(ingredient_name)
    
    # 2. 기본 영양소 정보 제공 (카테고리 기반)
    category_nutrition = get_category_average_nutrition(ingredient_name)
    
    return {
        "status": "approximated",
        "suggestions": suggestions,
        "nutrition": category_nutrition
    }
```
