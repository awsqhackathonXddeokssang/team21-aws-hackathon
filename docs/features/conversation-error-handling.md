# 대화 에러 처리 개선

## 문제 상황
음식과 관련없는 질문 시 대화가 중단되는 문제

### 기존 동작
```
사용자: "오늘 날씨 어때?"
→ 서버: {"error":"NON_FOOD_RELATED_PROMPT","message":"음식이나 요리와 관련된 내용을 입력해주세요."}
→ 클라이언트: "죄송해요, 일시적인 오류가 발생했어요. 다시 시도해주세요."
→ 대화 중단 ❌
```

## 개선 사항

### 1. ApiService 수정 (api.ts)
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  if (errorData.error === 'NON_FOOD_RELATED_PROMPT') {
    throw new Error('NON_FOOD_RELATED_PROMPT');
  }
  throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
}
```

### 2. ChatScreen 수정 (ChatScreen.tsx)
```typescript
catch (error) {
  if (error instanceof Error && error.message.includes('NON_FOOD_RELATED_PROMPT')) {
    const guidanceMessage: ChatMessage = {
      content: '음식이나 요리와 관련된 내용을 입력해주세요! 예를 들어 알레르기, 선호하는 맛, 싫어하는 음식, 건강 상태 등을 알려주시면 더 맞춤형 레시피를 추천해드릴 수 있어요. 😊'
    };
    setMessages(prev => [...prev, guidanceMessage]);
    setShowTextInput(true); // 대화 계속
  }
}
```

## 개선된 동작
```
사용자: "오늘 날씨 어때?"
→ AI: "음식이나 요리와 관련된 내용을 입력해주세요! 예를 들어 알레르기, 선호하는 맛, 싫어하는 음식, 건강 상태 등을 알려주시면 더 맞춤형 레시피를 추천해드릴 수 있어요. 😊"
→ 텍스트 입력창 유지 → 대화 계속 ✅
```

## 효과
- 사용자 경험 개선: 대화 중단 없음
- 자연스러운 안내: 적절한 예시 제공
- 플로우 유지: 고급 대화 루프 지속
