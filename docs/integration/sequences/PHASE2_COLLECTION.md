# Phase 2: 대화 정보 수집 시퀀스

## 개요
사용자와의 대화를 통해 프로필 정보를 수집하는 과정 (프로필 제출까지)

## 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant User
    participant Frontend

    Note over User, Frontend: Phase 2: 대화 정보 수집

    %% 세션 시작 후 4단계 질문
    Note over Frontend: 세션 생성 완료 후 시작
    
    %% 1단계: 타겟 선택
    Frontend->>User: "어떤 식단을 하고 계신가요?"
    User->>Frontend: 타겟 선택 (케톤/육아/당뇨/일반/냉장고)
    Frontend->>Frontend: selectedTarget 저장
    
    %% 2단계: 인분 선택
    Frontend->>User: "몇 인분이 필요하신가요?"
    User->>Frontend: 인분 선택 (1인분/2인분/3-4인분/5인분 이상)
    Frontend->>Frontend: 인분 정보 저장
    
    %% 3단계: 요리 시간
    Frontend->>User: "요리 시간은 얼마나 걸려도 괜찮으신가요?"
    User->>Frontend: 시간 선택 (10분 이내/30분 이내/1시간 이내/시간 상관없음)
    Frontend->>Frontend: 요리 시간 저장
    
    %% 4단계: 커스텀 질문
    Frontend->>User: "추가로 궁금한 점이나 특별한 요청사항이 있으신가요?"
    User->>Frontend: 텍스트 입력 또는 "아니요, 충분해요" 선택
    
    alt 추가 요청사항 있음
        Frontend->>Frontend: 커스텀 요청사항 저장
    else 충분해요 선택
        Note over Frontend: 프로필 수집 완료
    end
    
    Note over Frontend: Phase 2 완료 - Phase 3로 이동
```

## 상세 플로우

### 1. 타겟 선택
```javascript
// 타겟 옵션 (TargetSelector 컴포넌트)
const targetInfos = [
    { id: 'keto', name: '케톤 다이어트', icon: '🥑' },
    { id: 'baby', name: '육아/이유식', icon: '👶' },
    { id: 'diabetes', name: '당뇨 관리', icon: '💉' },
    { id: 'general', name: '일반 식단', icon: '🍽️' },
    { id: 'fridge', name: '냉장고 파먹기', icon: '🧊' }
];

// 타겟 선택 처리
function handleTargetSelection(target) {
    setSelectedTarget(target);
    // 타겟별 응답 메시지 표시
    const responseMessage = getTargetResponseMessage(target);
    // 다음 질문(인분)으로 진행
}
```

### 2. 인분 선택
```javascript
// 인분 질문 (ChatScreen에서 동적 생성)
const servingQuestion = {
    content: '몇 인분이 필요하신가요?',
    messageType: 'choice',
    options: ['1인분', '2인분', '3-4인분', '5인분 이상']
};

// 인분 선택 처리
function handleServingSelection(serving) {
    // 사용자 응답 저장
    // 다음 질문(요리 시간)으로 진행
    setCurrentStep(1);
}
```

### 3. 요리 시간
```javascript
// 요리 시간 질문 (getNextQuestion 함수)
const timeQuestion = {
    question: '요리 시간은 얼마나 걸려도 괜찮으신가요?',
    options: ['10분 이내', '30분 이내', '1시간 이내', '시간 상관없음']
};

// 요리 시간 선택 처리
function handleTimeSelection(time) {
    // 요리 시간 저장
    // 다음 질문(추가 요청사항)으로 진행
    setCurrentStep(2);
}
```

### 4. 추가 요청사항 (커스텀 질문)
```javascript
// 추가 요청사항 질문
const customQuestion = {
    question: '추가로 궁금한 점이나 특별한 요청사항이 있으신가요?',
    options: ['네, 질문이 있어요', '아니요, 충분해요']
};

// 처리 로직
function handleCustomQuestion(input) {
    if (input === "아니요, 충분해요") {
        // 추가 요청사항 없음
        setUserProfile(prev => ({ ...prev, customRequest: null }));
    } else {
        // 텍스트 입력 모드로 전환
        setShowTextInput(true);
    }
    // Phase 2 완료 - Phase 3로 이동
    proceedToPhase3();
}
```

## 수집된 프로필 데이터 구조

```typescript
interface UserProfile {
    // 4단계 질문 결과
    target: string;           // 타겟 선택 (필수)
    servings: string;         // 인분 (필수)
    cookingTime: string;      // 요리 시간 (필수)
    customRequest?: string;   // 추가 요청사항 (선택)
    timestamp: string;        // 수집 완료 시간
}
```

## 상태 전이

### 세션 상태 변화
- `idle` → `collecting` (첫 번째 질문 시작)
- `collecting` → `ready_to_process` (프로필 수집 완료)

## 성능 최적화

### 클라이언트 사이드 처리
- 4단계 질문-답변은 모두 프론트엔드에서 처리
- 서버 통신 없이 로컬 상태 관리
- 빠른 사용자 경험 제공

### 프로필 검증
```javascript
function validateProfile(profile) {
    const required = ['target', 'servings', 'cookingTime'];
    
    // 필수 필드 검증
    for (const field of required) {
        if (!profile[field]) return false;
    }
    
    return true;
}
```

## Phase 3 연결점

Phase 2 완료 후 수집된 프로필 데이터는 Phase 3 (PROCESSING)로 전달되어:
- `POST /session/{id}/process` API 호출
- Step Functions 워크플로우 시작
- 비동기 레시피 생성 처리
