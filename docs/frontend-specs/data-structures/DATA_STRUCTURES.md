# AI 셰프 프로젝트 데이터 구조

## 세션 관련 타입

### SessionStatus
```typescript
type SessionStatus = 'idle' | 'collecting' | 'processing' | 'completed' | 'failed' | 'expired';
```

### ProcessingStatus
```typescript
type ProcessingStatus = 'idle' | 'submitting' | 'processing' | 'completed' | 'failed' | 'timeout';
```

### Session 인터페이스
```typescript
interface Session {
  sessionId: string;
  status: SessionStatus;
  createdAt: string;
  expiresAt: string;
  profile?: UserProfile;
  executionId?: string;
  result?: ProcessingResult;
  error?: string;
}
```

### ProcessingResult
```typescript
interface ProcessingResult {
  recipe: RecipeResult;
  pricing: PricingResult;
  generatedAt: string;
}
```

### PricingResult
```typescript
interface PricingResult {
  total: number;
  optimal: {
    vendor: string;
    items: Array<{
      name: string;
      price: number;
      quantity: string;
    }>;
  };
  alternatives: Array<{
    vendor: string;
    total: number;
    items: Array<{
      name: string;
      price: number;
      quantity: string;
    }>;
  }>;
}
```

## UI 관련 인터페이스

### Message
```typescript
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  options?: string[];
  type?: string;
}
```

### UserProfile
```typescript
interface UserProfile {
  target: string;
  budget?: number;
  servings?: number;
  phase?: string;
  carbLimit?: number;
  months?: number;
  allergies?: string[];
  bloodSugar?: number;
  medication?: string[];
  ingredients?: string[];
  cookingTime?: number;
}
```

### 타겟별 특화 정보 인터페이스

#### KetoInfo
```typescript
interface KetoInfo {
  netCarbs: number;
  ketoScore: '완벽' | '우수' | '양호' | '주의';
  tip: string;
}
```

#### BabyInfo
```typescript
interface BabyInfo {
  stage: string;
  texture: string;
  allergens: string[];
  tip: string;
}
```

#### DiabetesInfo
```typescript
interface DiabetesInfo {
  glycemicIndex: number;
  estimatedGlucoseRise: number;
  insulinUnits: number;
  tip: string;
}
```

#### FridgeInfo
```typescript
interface FridgeInfo {
  matchScore: number;
  usedIngredients: string[];
  missingIngredients: string[];
  co2Saved: string;
  ecoPoints: number;
  alternativeRecipes: Array<{
    name: string;
    matchScore: number;
  }>;
}
```

### RecipeResult
```typescript
interface RecipeResult {
  name: string;
  image: string;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
  }>;
  steps: string[];
  targetSpecificInfo?: {
    ketoInfo?: KetoInfo;
    babyInfo?: BabyInfo;
    diabetesInfo?: DiabetesInfo;
    fridgeInfo?: FridgeInfo;
  };
}
```

## 상수 정의

### ERROR_CODES
```typescript
const ERROR_CODES = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  PROFILE_INVALID: 'PROFILE_INVALID',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
} as const;
```

### POLLING_CONFIG
```typescript
## Mock 데이터 예제

### 케톤 다이어트 레시피 예제
```typescript
const mockKetoRecipe: ProcessingResult = {
  recipe: {
    name: "버터 새우 아보카도 샐러드",
    image: "https://example.com/butter-shrimp-avocado-salad.jpg",
    nutrition: {
      calories: 420,
      protein: 25,
      carbs: 8,
      fat: 35
    },
    ingredients: [
      { name: "새우", amount: "200", unit: "g" },
      { name: "아보카도", amount: "1", unit: "개" },
      { name: "버터", amount: "2", unit: "큰술" },
      { name: "올리브오일", amount: "1", unit: "큰술" },
      { name: "레몬즙", amount: "1", unit: "큰술" },
      { name: "마늘", amount: "2", unit: "쪽" },
      { name: "소금", amount: "1/2", unit: "작은술" },
      { name: "후추", amount: "약간", unit: "" }
    ],
    steps: [
      "새우는 껍질을 벗기고 내장을 제거한 후 소금, 후추로 밑간한다.",
      "팬에 버터를 녹이고 마늘을 볶아 향을 낸다.",
      "새우를 넣고 양면이 분홍색이 될 때까지 볶는다.",
      "아보카도는 반으로 갈라 씨를 제거하고 한입 크기로 자른다.",
      "볼에 아보카도, 새우를 담고 올리브오일, 레몬즙을 넣어 버무린다.",
      "소금, 후추로 간을 맞춰 완성한다."
    ],
    targetSpecificInfo: {
      ketoInfo: {
        netCarbs: 5,
        ketoScore: "완벽",
        tip: "적응기에는 전해질 보충이 중요해요!"
      }
    }
  },
  pricing: {
    total: 18300,
    optimal: {
      vendor: "쿠팡",
      items: [
        { name: "냉동새우 500g", price: 8900, quantity: "1팩" },
        { name: "아보카도", price: 2500, quantity: "2개" },
        { name: "무염버터 200g", price: 3200, quantity: "1개" },
        { name: "올리브오일 500ml", price: 3700, quantity: "1병" }
      ]
    },
    alternatives: [
      {
        vendor: "이마트몰",
        total: 19500,
        items: [
          { name: "냉동새우 500g", price: 9500, quantity: "1팩" },
          { name: "아보카도", price: 2800, quantity: "2개" },
          { name: "무염버터 200g", price: 3400, quantity: "1개" },
          { name: "올리브오일 500ml", price: 3800, quantity: "1병" }
        ]
      }
    ]
  },
  generatedAt: "2024-09-05T11:30:00Z"
};
```
