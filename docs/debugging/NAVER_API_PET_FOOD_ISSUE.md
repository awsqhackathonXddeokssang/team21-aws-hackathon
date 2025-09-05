# Naver Shopping API 펫푸드 이슈 해결 과정

## 📋 문서 개요
- **작성일**: 2025-09-05
- **문제**: Naver Shopping API로 식재료 검색 시 펫푸드가 검색되는 문제
- **영향 범위**: Price Lambda (`backend/lambda/price/lambda_function.py`)
- **해결 상태**: ✅ 해결 완료

## 🔍 문제 상황

### 발견 경위
AI Chef 서비스에서 레시피 재료의 최저가를 검색하는 기능 구현 중, "닭가슴살"을 검색했을 때 **강아지/고양이 사료**가 상위에 표시되는 문제 발견.

### 기존 구현
```python
# backend/lambda/price/lambda_function.py (line 191-192)
query = urllib.parse.quote(ingredient_name)  
url = f"https://openapi.naver.com/v1/search/shop.json?query={query}&display=20&sort=asc"
```
- `sort=asc`: 가격 오름차순 정렬 사용

### 문제 증상
- "닭가슴살 150g" 검색 결과:
  - 맛살, 떡볶이 소스 등 관련 없는 상품
  - 이나바 강아지 사료 등 펫푸드 포함
- "닭가슴살" 검색 결과:
  - 상위 5개 중 2개가 펫 간식 (40%)
  - 100원대 이벤트 펫푸드가 상위 랭킹 차지

## 🧪 테스트 및 분석

### 테스트 환경
- Naver API Credentials: `O47Kw9QPGE1H6J6HVn9A` / `njiAxiprCN`
- 테스트 쿼리: "닭가슴살", "닭가슴살 150g", "요리용 닭가슴살", "식품 닭가슴살"

### 정렬 방식별 결과 분석

#### 1. 가격순 정렬 (sort=asc) - 기존 방식
```
상위 15개 결과:
- 펫푸드: 6개 (40%)
  - #1 나나 고양이 간식 (50원)
  - #4 고양이간식 닭가슴 (100원)
  - #7 제로랩스 강아지/고양이 간식 (100원)
  - #9 묘묘 고양이 간식 (100원)
  - #12 네츄럴코어 강아지 간식 (150원)
  - #14, #15 테비토퍼 고양이 간식 (180원, 190원)
- 식품: 9개 (60%)
```

#### 2. 관련도순 정렬 (sort=sim) - 개선 방식
```
상위 15개 결과:
- 펫푸드: 0개 (0%)
- 식품: 15개 (100%)
  - 모두 "식품/축산물/닭고기/닭가슴살" 카테고리
  - 하림, 허닭, 미트리, 잇메이트 등 유명 브랜드
```

### 100개 샘플 대규모 분석
```
관련도순 100개 분석:
- 식품 카테고리: 100개 (100%)
- 펫푸드/간식: 0개 (0%)
- 가격 분포:
  - 최저가: 760원 (사조대림)
  - 최고가: 67,500원 (열두닭 50팩)
  - 평균가: 19,514원
```

## 💡 해결 방안 검토

### 1. ❌ 검색어 수정 방식
- "요리용 닭가슴살", "식품 닭가슴살" 등으로 검색
- **결과**: 효과 없음. 여전히 펫푸드 검색됨

### 2. ❌ 수량 제거
- "닭가슴살 150g" → "닭가슴살"로 변경
- **결과**: 큰 차이 없음. 오히려 더 많은 펫푸드 검색됨

### 3. ✅ 정렬 방식 변경 (채택)
- `sort=asc` (가격순) → `sort=sim` (관련도순)
- **결과**: 펫푸드 완전 제거 성공

### 4. 🤔 추가 고려사항들

#### 가격 범위 문제
- 관련도순 사용 시 고가 상품도 포함되는 이슈
- 해결 아이디어:
  ```python
  # 1. 관련도순으로 다량 조회 후 필터링
  results = search(sort='sim', display=100)
  filtered = [r for r in results if 500 <= r['price'] <= 30000]
  return sorted(filtered, key=lambda x: x['price'])[:10]
  ```

#### 성능 최적화
- 현재 Recipe 생성 9초 + 재료별 API 호출로 총 20초+ 소요
- 배치 처리, 캐싱, 메인 재료만 검색 등 최적화 방안 검토
- **결론**: MVP 단계에서는 단순 정렬 변경으로 해결

## 🎯 최종 결정 사항

### MVP 수준 해결책 (즉시 적용)
```python
# backend/lambda/price/lambda_function.py
def get_ingredient_prices(ingredient_name: str) -> List[Dict]:
    """네이버 쇼핑 API로 가격 조회"""
    # 기존: sort=asc (가격순)
    # 변경: sort=sim (관련도순)
    query = urllib.parse.quote(ingredient_name)
    url = f"https://openapi.naver.com/v1/search/shop.json?query={query}&display=20&sort=sim"
    
    # ... 나머지 코드 동일
```

### 결정 근거
1. **시간 제약**: 현재 Recipe 9초 + Price API 호출로 총 20초+ 소요
2. **해커톤 특성**: MVP 우선, 복잡한 구현보다 빠른 해결
3. **효과성**: 단 한 줄 변경으로 펫푸드 문제 100% 해결
4. **즉시 적용 가능**: 추가 개발 시간 불필요

## 📊 결과 및 효과

### Before (가격순)
- 펫푸드 비율: 40%
- 관련 없는 상품 다수
- 사용자 혼란 유발

### After (관련도순)
- 펫푸드 비율: 0%
- 모두 식품 카테고리
- 적절한 검색 결과

## 🚀 향후 개선 사항

### Phase 1 - 즉시 개선 (Post-MVP)
1. **관련도순 다량 조회 후 필터링**
   ```python
   # 관련도순 100-200개 조회
   results = search(sort='sim', display=100)
   # 가격/카테고리 필터링 후 재정렬
   filtered = filter_and_sort(results)
   ```

2. **카테고리 및 키워드 필터링**
   - "식품" 카테고리만 선택
   - 펫푸드 키워드 제외 로직

### Phase 2 - 성능 최적화 (병렬 처리 확대)
1. **Step Functions 병렬화 개선**
   ```yaml
   # 현재 구조:
   # Recipe (9초) → Price + Image 병렬 (10초)
   # 총 19초+
   
   # 개선안:
   RecipeGeneration:  # 기본 레시피만 생성 (영양소 제외)
     Next: ParallelProcessing
   
   ParallelProcessing:
     Branches:
       - NutritionCalculation  # 영양소 계산 분리
       - PriceSearch           # 가격 검색
       - ImageGeneration       # 이미지 생성
   
   # 예상: Recipe (5초) → 병렬 처리 (10초) = 총 15초
   ```

2. **Recipe Lambda 최적화**
   - 레시피 생성 시 영양소 계산 제외
   - 영양소는 별도 Lambda에서 병렬 계산
   - Bedrock 호출 시 영양소 부분 제거로 속도 향상

3. **가격 검색 최적화**
   - 메인 재료 3-5개만 실시간 검색
   - 양념류는 캐싱된 평균값 사용
   - 배치 쿼리로 API 호출 횟수 감소

### Phase 3 - 장기 개선
1. **재료 가격 DB 구축**
   - DynamoDB에 일별 가격 캐싱
   - TTL 설정으로 자동 갱신
   - 자주 검색되는 재료 우선 캐싱

2. **스마트 캐싱 전략**
   ```python
   # 재료 타입별 캐싱 기간
   CACHE_TTL = {
       '양념류': 30일,  # 가격 변동 적음
       '채소류': 3일,   # 가격 변동 많음
       '육류': 7일
   }
   ```

3. **지능형 검색 개선**
   - 재료명 정규화 시스템
   - 유사 재료 그룹핑
   - ML 기반 상품-재료 매칭

## 📝 교훈 및 시사점

1. **API 파라미터의 중요성**: 단순한 정렬 옵션 하나가 결과를 완전히 바꿀 수 있음
2. **실제 데이터 테스트의 필요성**: 이론적 추측보다 실제 API 호출 테스트가 중요
3. **MVP 우선순위**: 복잡한 솔루션보다 간단하고 효과적인 해결책 우선 적용
4. **도메인 특성 이해**: "닭가슴살"이 펫 시장에서도 인기 키워드라는 점 발견

## 🔗 관련 파일
- `/backend/lambda/price/lambda_function.py`
- `/backend/infrastructure/price-lambda.yaml`
- `/backend/infrastructure/step-functions.yaml`

---

*이 문서는 AWS Hackathon 2025 Team 21의 디버깅 과정에서 작성되었습니다.*