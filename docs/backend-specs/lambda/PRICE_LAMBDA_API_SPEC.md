# Price Lambda API 명세서

**최종 업데이트**: 2025-09-05  
**버전**: v2.0 (간소화 완료)  
**상태**: ✅ 프로덕션 배포 완료

## 📥 입력 (Input)

### 요청 형식
```json
{
  "ingredients": ["재료1", "재료2", "재료3"],
  "sessionId": "세션ID"
}
```

### 파라미터 설명
| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `ingredients` | Array<String> | ✅ | 가격 조회할 재료 목록 | `["beef", "onion", "garlic"]` |
| `sessionId` | String | ✅ | 세션 추적용 ID | `"test-session-123"` |

### 입력 예시
```json
{
  "ingredients": ["tomato", "garlic", "rice"],
  "sessionId": "recipe-session-456"
}
```

## 📤 출력 (Output)

### 성공 응답 형식
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIngredients": 3,
      "foundIngredients": 3,
      "successRate": 1
    },
    "ingredients": {
      "재료명": [
        {
          "name": "상품명",
          "price": 가격(숫자),
          "vendor": "판매처명",
          "link": "직접구매링크",
          "image": "상품이미지URL",
          "category": "카테고리",
          "productId": "상품ID",
          "brand": "브랜드명",
          "availability": "available",
          "maker": "제조사",
          "hprice": 최고가
        }
      ]
    },
    "recommendations": {
      "optimalVendors": [
        {
          "vendor": "판매처명",
          "items": [...],
          "totalPrice": 총가격,
          "itemCount": 상품수
        }
      ],
      "totalEstimatedCost": 전체예상비용
    }
  },
  "error": null,
  "metadata": {
    "timestamp": "2025-09-05T09:29:21.811Z",
    "requestId": "고유요청ID",
    "processingTime": 1394,
    "sessionId": "입력받은세션ID"
  }
}
```

### 실제 응답 예시
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalIngredients": 1,
      "foundIngredients": 1,
      "successRate": 1
    },
    "ingredients": {
      "tomato": [
        {
          "name": "완숙 찰 토마토 5kg 10kg 2kg 방울토마토",
          "price": 15900,
          "vendor": "가락시장 목포상회 과일",
          "link": "https://smartstore.naver.com/main/products/4951366308",
          "image": "https://shopping-phinf.pstatic.net/main_8249588/82495886407.19.jpg",
          "category": "식품",
          "productId": "82495886407",
          "brand": null,
          "availability": "available",
          "maker": null,
          "hprice": null
        }
      ]
    },
    "recommendations": {
      "optimalVendors": [
        {
          "vendor": "가락시장 목포상회 과일",
          "items": [...],
          "totalPrice": 15900,
          "itemCount": 1
        }
      ],
      "totalEstimatedCost": 15900
    }
  },
  "error": null,
  "metadata": {
    "timestamp": "2025-09-05T09:29:21.811Z",
    "requestId": "abc123def456",
    "processingTime": 1200,
    "sessionId": "recipe-session-456"
  }
}
```

## 🔑 핵심 필드 설명

### 상품 정보 (`ingredients.재료명[n]`)
| 필드 | 타입 | 설명 | 활용 방법 |
|------|------|------|----------|
| `name` | String | 상품명 | 사용자에게 표시 |
| `price` | Number | 최저가 (원) | 가격 비교, 정렬 |
| `vendor` | String | 판매처 | 신뢰도 표시 |
| **`link`** | String | **직접 구매 링크** | **바로 구매 버튼** |
| **`image`** | String | **상품 이미지 URL** | **상품 썸네일 표시** |
| `availability` | String | 구매 가능 상태 | 항상 "available" |
| `category` | String | 상품 카테고리 | 필터링 용도 |
| `brand` | String | 브랜드명 | 브랜드 표시 |

### 요약 정보 (`summary`)
| 필드 | 설명 |
|------|------|
| `totalIngredients` | 요청한 재료 총 개수 |
| `foundIngredients` | 검색 성공한 재료 개수 |
| `successRate` | 성공률 (0~1) |

### 추천 정보 (`recommendations`)
| 필드 | 설명 |
|------|------|
| `optimalVendors` | 판매처별 최적 상품 조합 |
| `totalEstimatedCost` | 전체 예상 구매 비용 |

## 🚨 에러 응답

### 실패 응답 형식
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "에러코드",
    "message": "에러메시지"
  },
  "metadata": {
    "timestamp": "2025-09-05T09:29:21.811Z",
    "processingTime": 500
  }
}
```

### 에러 코드
| 코드 | 설명 |
|------|------|
| `INVALID_INPUT` | 입력 파라미터 오류 |
| `NAVER_API_ERROR` | 네이버 API 호출 실패 |
| `RATE_LIMIT` | API 호출 한도 초과 |
| `PRICE_LOOKUP_FAILED` | 가격 조회 실패 |

## 💡 프론트엔드 활용 예시

### React 컴포넌트
```jsx
function ProductCard({ product }) {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p className="price">{product.price.toLocaleString()}원</p>
      <p className="vendor">{product.vendor}</p>
      <button 
        onClick={() => window.open(product.link, '_blank')}
        className="buy-button"
      >
        🛒 바로 구매하기
      </button>
    </div>
  );
}
```

### API 호출
```javascript
const response = await fetch('/api/price', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ingredients: ['beef', 'onion', 'garlic'],
    sessionId: 'user-session-123'
  })
});

const result = await response.json();
if (result.success) {
  // 상품 목록 표시
  result.data.ingredients.beef.forEach(product => {
    console.log(`${product.name}: ${product.price}원`);
  });
}
```

## 🔄 변경 이력

### v2.0 (2025-09-05)
- ✅ 불필요한 `searchLink`, `directLink` 제거
- ✅ 강화된 상품 필터링 (품절, 가격 범위, URL 검증)
- ✅ 간소화된 응답 구조
- ✅ 네이버 API 직접 링크만 사용

### v1.0 (2025-09-05)
- ✅ 기본 가격 조회 기능
- ✅ 이미지 및 상품 정보 추가
- ✅ 다중 링크 제공 (현재 제거됨)
