# 고급 대화 플로우 구현 현황

## 개요
PHASE2_COLLECTION.md 기반 AI 대화 시스템 구현 상태

## 플로우 구조

### 1. 기본 정보 수집 (1-3단계)
```
타겟 선택 → 서버 즉시 저장
인분 선택 → 서버 누적 저장  
요리시간 선택 → 서버 누적 저장
```

### 2. 추가 질문 분기점 (4단계)
```
"추가로 궁금한 점이나 특별한 요청사항이 있으신가요?"
├── "네, 질문이 있어요" → AI 대화 루프 시작
└── "아니요, 충분해요" → 바로 레시피 생성
```

### 3. AI 대화 루프 (고급 대화)
```javascript
while (!profileComplete) {
  userInput → ApiService.updateProfile(sessionId, profile, userPrompt)
  → Bedrock 분석 (allergies, preferences 추출)
  → 서버 저장 (additional_info 배열에 추가)
  → "또 다른 질문이 있으신가요?"
}
```

## 구현 상태

### ✅ 완료된 기능
- 기본 3단계 서버 동기화
- AI 대화 텍스트 입력 UI
- Bedrock 연동 (session-update-profile Lambda)
- 사용자 입력 분석 및 정보 추출
- NON_FOOD_RELATED_PROMPT 에러 처리

### 📊 데이터 구조
```json
{
  "target": "keto",
  "servings": "2인분", 
  "cookingTime": "30분 이내",
  "additional_info": [
    {
      "timestamp": "2025-09-05T14:05:28Z",
      "original_prompt": "매운거 좋아하고 견과류 알러지 있어요",
      "analyzed_info": {
        "allergies": ["견과류"],
        "preferences": {"spicy": true}
      }
    }
  ]
}
```

## 기술 스택
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: AWS Lambda, DynamoDB
- **AI**: AWS Bedrock (Claude Opus 4.1)
- **API**: 네이버 쇼핑 API 연동 예정

## 사용자 경험
- 자연스러운 대화형 인터페이스
- 실시간 상태 업데이트
- 에러 상황에서도 대화 흐름 유지
