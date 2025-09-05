# 엑셀 데이터 기반 RAG 시스템 AWS 아키텍처 (업데이트됨)

## 개요
133,569건의 가공식품 데이터와 3,309건의 국가표준식품성분표 엑셀 데이터를 활용한 RAG 시스템 설계
**Claude Opus 4.1 및 Python Lambda 기반 구현**

## 시스템 아키텍처 (업데이트됨)

```
[Excel Files] → [S3] → [Lambda/Glue] → [Bedrock Embeddings] → [OpenSearch] → [Claude Opus 4.1] → [Recipe Lambda]
```

## AWS 서비스 구성

### 1. 데이터 저장 (S3)
- **서비스**: Amazon S3
- **용도**: 원본 엑셀 파일 및 전처리된 데이터 저장
- **버킷 구조**:
  ```
  food-rag-bucket/
  ├── raw-data/
  │   ├── 가공식품DB_133569건.xlsx
  │   └── 국가표준식품성분표.xlsx
  ├── processed-data/
  │   ├── food-items.json
  │   └── nutrition-data.json
  └── embeddings/
      └── vectors/
  ```

### 2. AI 모델 (Bedrock - 업데이트됨)
- **모델**: Claude Opus 4.1 (`anthropic.claude-opus-4-1-20250805-v1:0`)
- **언어**: Python 3.11
- **용도**: 
  - 레시피 생성 (타겟별 맞춤 프롬프트)
  - 영양소 정보 해석
  - 식단 추천 및 검증
- **특징**:
  - 향상된 추론 능력
  - 더 정확한 JSON 파싱
  - 한국어 처리 개선

### 3. Recipe Lambda 통합 (신규)
```python
# Recipe Lambda에서 RAG 시스템 활용
def get_nutrition_info(ingredients: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """RAG 시스템을 통한 영양소 조회"""
    nutrition_data = []
    
    for ingredient in ingredients:
        # 1. 재료명 정규화
        clean_name = clean_ingredient_name(ingredient['name'])
        
        # 2. OpenSearch 임베딩 검색
        nutrition = search_nutrition_database(clean_name)
        
        # 3. 양에 따른 영양소 계산
        calculated_nutrition = calculate_nutrition_by_amount(
            nutrition, 
            float(ingredient.get('amount', 1)), 
            ingredient.get('unit', '개')
        )
        
        nutrition_data.append({
            'ingredient': ingredient['name'],
            'nutrition': calculated_nutrition
        })
    
    return nutrition_data

def search_nutrition_database(ingredient_name: str) -> Dict[str, float]:
    """OpenSearch를 통한 영양소 데이터 검색"""
    # Mock 구현 - 실제로는 OpenSearch 쿼리
    nutrition_db = {
        '아보카도': {'calories': 160, 'protein': 2, 'fat': 15, 'carbs': 9, 'fiber': 7},
        '올리브오일': {'calories': 884, 'protein': 0, 'fat': 100, 'carbs': 0, 'fiber': 0},
        '닭가슴살': {'calories': 165, 'protein': 31, 'fat': 3.6, 'carbs': 0, 'fiber': 0},
        '브로콜리': {'calories': 34, 'protein': 2.8, 'fat': 0.4, 'carbs': 7, 'fiber': 2.6}
    }
    
    return nutrition_db.get(ingredient_name, {
        'calories': 50, 'protein': 2, 'fat': 1, 'carbs': 10, 'fiber': 1
    })
```

### 4. 데이터 전처리 (Lambda + Glue)
- **서비스**: AWS Lambda, AWS Glue
- **Lambda 함수**: `excel-processor`
  - 엑셀 파일 파싱 및 JSON 변환
  - 데이터 정제 및 구조화
- **Glue Job**: `data-transformation`
  - 대용량 데이터 ETL 처리
  - 중복 제거 및 데이터 품질 검증

### 3. 벡터 임베딩 (Bedrock)
- **서비스**: Amazon Bedrock
- **모델**: Titan Text Embeddings v2 (amazon.titan-embed-g1-text-02)
- **처리 방식**:
  - 음식명, 영양성분, 제조사 정보를 텍스트로 결합
  - 1024차원 벡터로 임베딩 생성
  - 배치 처리로 성능 최적화

### 4. 벡터 저장소 (OpenSearch)
- **서비스**: Amazon OpenSearch Service
- **인덱스 구조**:
  ```json
  {
    "mappings": {
      "properties": {
        "food_id": {"type": "keyword"},
        "food_name": {"type": "text"},
        "nutrition_info": {"type": "text"},
        "manufacturer": {"type": "keyword"},
        "category": {"type": "keyword"},
        "embedding": {
          "type": "knn_vector",
          "dimension": 1024
        }
      }
    }
  }
  ```

### 5. RAG 구현 (Bedrock LLM)
- **서비스**: Amazon Bedrock
- **모델**: Claude Opus 4.1 (anthropic.claude-opus-4-1-20250805-v1:0)
- **프롬프트 템플릿**:
  ```
  다음 음식 정보를 바탕으로 사용자 질문에 답변하세요:
  
  검색된 음식 정보:
  {retrieved_context}
  
  사용자 질문: {user_query}
  
  답변:
  ```

### 6. API 서비스 (API Gateway + Lambda)
- **서비스**: Amazon API Gateway, AWS Lambda
- **엔드포인트**:
  - `POST /search` - 음식 검색
  - `POST /recommend` - 맞춤 추천
  - `POST /chat` - AI 상담

## 데이터 플로우

1. **데이터 수집**: S3에 엑셀 파일 업로드
2. **전처리**: Lambda가 엑셀 파싱 후 JSON 변환
3. **임베딩**: Bedrock으로 텍스트 벡터화
4. **저장**: OpenSearch에 벡터 인덱싱
5. **검색**: 사용자 쿼리를 벡터로 변환 후 유사도 검색
6. **생성**: 검색 결과를 컨텍스트로 LLM 응답 생성

## 비용 최적화

- **Bedrock**: Claude Opus 4.1 - 최고 성능 모델 사용
- **OpenSearch**: t3.small.search 인스턴스로 시작
- **Lambda**: 1GB 메모리, 30초 타임아웃
- **S3**: Standard-IA 스토리지 클래스 활용

## 보안 설정

- **IAM 역할**: 최소 권한 원칙 적용
- **VPC**: OpenSearch를 프라이빗 서브넷에 배치
- **암호화**: S3, OpenSearch 저장 시 암호화 활성화
- **API Gateway**: API 키 기반 인증

## 모니터링

- **CloudWatch**: 각 서비스 메트릭 모니터링
- **X-Ray**: 분산 추적으로 성능 분석
- **CloudTrail**: API 호출 로깅
