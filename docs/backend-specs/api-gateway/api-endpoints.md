# AI Chef API 엔드포인트 문서

## API 개요
- **Session API Base URL**: `https://tlg1j21vgf.execute-api.us-east-1.amazonaws.com/dev`
- **Nutrition API Base URL**: `https://4zba2babx7.execute-api.us-east-1.amazonaws.com`
- **Content-Type**: `application/json`
- **Authentication**: None (현재 버전)

## 세션 관리 엔드포인트

### 1. 세션 생성
**POST** `/sessions`

새로운 사용자 세션을 생성합니다.

**Request:**
```http
POST /sessions
Content-Type: application/json

{}
```

**Response:**
```json
{
  "sessionId": "sess_abc123def456",
  "status": "idle",
  "createdAt": "2025-09-05T14:30:00Z",
  "expiresAt": "2025-09-05T16:30:00Z"
}
```

### 2. 세션 조회
**GET** `/sessions/{sessionId}`

세션 정보를 조회합니다.

**Request:**
```http
GET /sessions/{sessionId}
```

**Response:**
```json
{
  "sessionId": "sess_abc123def456",
  "status": "processing",
  "profile": {
    "target": "keto",
    "budget": 30000,
    "servings": 2,
    "carbLimit": 20,
    "allergies": ["nuts"],
    "cookingTime": 30
  },
  "createdAt": "2025-09-05T14:30:00Z"
}
```

### 3. 세션 프로필 업데이트
**PUT** `/sessions/{sessionId}/profile`

사용자의 추가 선호도 정보를 업데이트합니다.

**Request:**
```javascript
const additionalPreferences = {
  preferences: {
    allergies: ["nuts", "shellfish"],
    dislikes: ["spicy"],
    tasteLevel: "mild",
    cookingTime: 45,
    nutritionist: {
      hasConsulted: true,
      recommendations: ["low sodium", "high fiber"]
    }
  }
};

const response = await fetch(`/sessions/${sessionId}/profile`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(additionalPreferences)
});
```

**Response:**
```json
{
  "sessionId": "sess_abc123def456",
  "updated": true,
  "profile": {
    "target": "keto",
    "budget": 30000,
    "servings": 2,
    "carbLimit": 20,
    "allergies": ["nuts", "shellfish"],
    "cookingTime": 45,
    "preferences": {
      "dislikes": ["spicy"],
      "tasteLevel": "mild",
      "nutritionist": {
        "hasConsulted": true,
        "recommendations": ["low sodium", "high fiber"]
      }
    }
  }
}
```

### 4. 레시피 이미지 생성
**POST** `/recipe-image`

레시피 정보를 기반으로 AI가 생성한 음식 이미지를 반환합니다.

**Request:**
```javascript
const recipeData = {
  recipe: {
    name: "다이어트 도시락",
    ingredients: [
      "닭가슴살 200g",
      "브로콜리 100g",
      "현미밥 150g"
    ]
  }
};

const response = await fetch('/recipe-image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(recipeData)
});
```

**Response:**
```json
{
  "recipe": "다이어트 도시락",
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "ingredients": [
    "닭가슴살 200g",
    "브로콜리 100g", 
    "현미밥 150g"
  ]
}
```

## 영양소 정보 엔드포인트

### 1. 영양소 정보 조회

#### POST /v1/recipes/{recipeId}/nutrition
레시피의 영양소 정보를 계산하여 반환

**Request:**
```http
POST /v1/recipes/123/nutrition
Content-Type: application/json

{
  "ingredients": [
    "닭가슴살 200g",
    "브로콜리 100g",
    "현미밥 150g"
  ],
  "servings": 1,
  "include_analysis": true
}
```

**Response:**
```json
{
  "recipe_id": "123",
  "servings": 1,
  "total_nutrition": {
    "calories": 445.0,
    "protein": 45.2,
    "fat": 8.1,
    "carbs": 35.7,
    "fiber": 5.2,
    "sodium": 320.5
  },
  "ingredient_details": [
    {
      "ingredient": "닭가슴살 200g",
      "calories": 330.0,
      "protein": 62.0,
      "fat": 7.2,
      "carbs": 0.0,
      "fiber": 0.0,
      "sodium": 148.0
    }
  ],
  "ai_analysis": "이 레시피는 고단백, 저지방 식단으로..."
}
```

### 2. 재료별 영양소 조회

#### GET /v1/ingredients/{ingredientName}/nutrition
특정 재료의 영양소 정보 조회

**Request:**
```http
GET /v1/ingredients/닭가슴살/nutrition?amount=200&unit=g
```

**Response:**
```json
{
  "ingredient_name": "닭가슴살",
  "amount": 200,
  "unit": "g",
  "nutrition_per_100g": {
    "calories": 165,
    "protein": 31.0,
    "fat": 3.6,
    "carbs": 0.0,
    "fiber": 0.0,
    "sodium": 74
  },
  "calculated_nutrition": {
    "calories": 330.0,
    "protein": 62.0,
    "fat": 7.2,
    "carbs": 0.0,
    "fiber": 0.0,
    "sodium": 148.0
  }
}
```

### 3. 재료 검색

#### GET /v1/ingredients?search={query}
재료명으로 검색

**Request:**
```http
GET /v1/ingredients?search=닭&limit=10
```

**Response:**
```json
{
  "query": "닭",
  "results": [
    {
      "ingredient_name": "닭가슴살",
      "category": "육류",
      "calories_per_100g": 165
    },
    {
      "ingredient_name": "닭다리살",
      "category": "육류", 
      "calories_per_100g": 250
    }
  ],
  "total_count": 15
}
```

### 4. 레시피 영양소 분석

#### POST /v1/recipes/analyze
레시피 전체 영양소 분석 및 건강 조언

**Request:**
```http
POST /v1/recipes/analyze
Content-Type: application/json

{
  "recipe": {
    "name": "다이어트 도시락",
    "ingredients": [
      "닭가슴살 200g",
      "브로콜리 100g",
      "현미밥 150g"
    ]
  },
  "user_profile": {
    "goal": "체중 감량",
    "restrictions": ["글루텐 프리"],
    "daily_calorie_target": 1500
  }
}
```

**Response:**
```json
{
  "recipe_analysis": {
    "total_nutrition": { /* 영양소 정보 */ },
    "health_score": 85,
    "diet_compatibility": {
      "keto": false,
      "low_carb": true,
      "high_protein": true
    }
  },
  "recommendations": {
    "improvements": [
      "식이섬유 증가를 위해 채소 추가 권장",
      "오메가-3 지방산 보충을 위해 견과류 추가"
    ],
    "alternatives": [
      {
        "ingredient": "현미밥 150g",
        "alternative": "퀴노아 100g",
        "reason": "더 높은 단백질 함량"
      }
    ]
  },
  "ai_analysis": "전문 영양사 분석 결과..."
}
```

### 5. 헬스 체크

#### GET /v1/health
API 서버 상태 확인

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-05T13:17:00Z",
  "version": "1.0.0",
  "services": {
    "opensearch": "connected",
    "bedrock": "available"
  }
}
```

## HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (필수 파라미터 누락 등) |
| 404 | 리소스를 찾을 수 없음 |
| 429 | 요청 한도 초과 |
| 500 | 서버 내부 오류 |

## 에러 응답 형식

```json
{
  "error": {
    "code": "INGREDIENT_NOT_FOUND",
    "message": "해당 재료의 영양소 정보를 찾을 수 없습니다",
    "details": {
      "ingredient": "알 수 없는 재료명",
      "suggestions": ["유사한 재료1", "유사한 재료2"]
    }
  }
}
```

## 요청 제한

- **Rate Limit**: 100 requests/minute per IP
- **Payload Size**: 최대 1MB
- **Timeout**: 30초

## 사용 예시

### cURL 예시
```bash
# 레시피 영양소 조회
curl -X POST "https://4zba2babx7.execute-api.us-east-1.amazonaws.com/v1/recipes/123/nutrition" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": ["닭가슴살 200g", "브로콜리 100g"],
    "include_analysis": true
  }'

# 재료 검색
curl "https://4zba2babx7.execute-api.us-east-1.amazonaws.com/v1/ingredients?search=닭&limit=5"
```

### JavaScript 예시
```javascript
// 레시피 영양소 조회
const response = await fetch('/v1/recipes/123/nutrition', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ingredients: ['닭가슴살 200g', '브로콜리 100g'],
    include_analysis: true
  })
});

const nutritionData = await response.json();
```

## 버전 관리

- **현재 버전**: v1
- **API 버전**: URL 경로에 포함 (`/v1/`)
- **하위 호환성**: 메이저 버전 내에서 보장
