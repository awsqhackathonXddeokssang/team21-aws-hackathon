# Phase 3: 백엔드 연동 및 실시간 처리 구현 로드맵

## 개요
현재 Mock API로 구현된 시스템을 실제 AWS 백엔드와 연동하여 완전한 AI 셰프 서비스를 완성하는 단계

## 남은 작업 목록

### 1. MockApiService → 실제 API Gateway 연결

#### 1.1 세션 시작 API 연동
```typescript
// 현재 (Mock)
static async startSession(): Promise<SessionResponse> {
  // Mock 구현
}

// 변경 후 (실제 API)
static async startSession(): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE_URL}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return await response.json();
}
```

#### 1.2 추가 질문 처리 API 연동
```typescript
// 현재 (Mock Bedrock)
static async processAdditionalQuestion(question: string, sessionId: string, profile?: any)

// 변경 후 (실제 Bedrock)
static async processAdditionalQuestion(question: string, sessionId: string, profile?: any) {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, profile })
  });
  return await response.json();
}
```

#### 1.3 프로필 제출 API 연동
```typescript
// 현재 (주석 처리)
// const response = await fetch('/api/process', { ... });

// 변경 후 (활성화)
const response = await fetch(`${API_BASE_URL}/session/${sessionId}/process`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ profile: profileData })
});
const { executionId } = await response.json();
```

### 2. 폴링 주석 코드 활성화

#### 2.1 현재 주석 처리된 폴링 코드
```typescript
// // 폴링 시작 (3초마다 상태 확인)
// const pollInterval = setInterval(async () => {
//   const statusResponse = await fetch(`/api/status/${executionId}`);
//   const { status, result } = await statusResponse.json();
//   
//   if (status === 'completed') {
//     clearInterval(pollInterval);
//     setCurrentRecipe(result.recipe);
//     setShowResult(true);
//     setIsLoading(false);
//   }
// }, 3000);
```

#### 2.2 활성화 후 구현
```typescript
const startPolling = (executionId: string) => {
  const pollInterval = setInterval(async () => {
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/execution/${executionId}/status`);
      const { status, progress, result, error } = await statusResponse.json();
      
      // 진행률 업데이트
      setProgress(progress);
      
      if (status === 'completed') {
        clearInterval(pollInterval);
        setCurrentRecipe(result.recipe);
        setIsLoading(false);
      } else if (status === 'failed') {
        clearInterval(pollInterval);
        setError(error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('폴링 오류:', error);
    }
  }, 2000); // 2초마다 상태 확인
};
```

### 3. Step Functions executionId로 상태 추적

#### 3.1 백엔드 응답 구조
```json
{
  "executionId": "arn:aws:states:region:account:execution:stateMachine:execution-id",
  "status": "running",
  "startTime": "2024-09-05T15:00:00Z"
}
```

#### 3.2 상태 조회 API 응답
```json
{
  "executionId": "arn:aws:states:...",
  "status": "running" | "completed" | "failed",
  "progress": {
    "currentStep": "recipe_generation",
    "percentage": 50,
    "message": "레시피 생성 중..."
  },
  "result": {
    "recipe": { ... },
    "prices": { ... }
  },
  "error": "오류 메시지 (실패 시)"
}
```

### 4. 진행률 표시 (25% → 50% → 75% → 100%)

#### 4.1 진행 단계 정의
```typescript
interface ProgressStep {
  percentage: number;
  step: string;
  message: string;
}

const PROGRESS_STEPS: ProgressStep[] = [
  { percentage: 25, step: 'profile_processing', message: '프로필 분석 중...' },
  { percentage: 50, step: 'recipe_generation', message: '맞춤 레시피 생성 중...' },
  { percentage: 75, step: 'price_checking', message: '최저가 정보 수집 중...' },
  { percentage: 100, step: 'completed', message: '완료!' }
];
```

#### 4.2 진행률 UI 컴포넌트
```tsx
// 현재 로딩 화면에 추가
{showResult && isLoading && (
  <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
    <div className="text-center">
      {/* 기존 스피너 */}
      
      {/* 진행률 바 추가 */}
      <div className="w-64 bg-gray-200 rounded-full h-2 mb-4">
        <div 
          className="bg-orange-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <h2 className="text-xl font-semibold text-gray-800 mb-2">{progressMessage}</h2>
      <p className="text-gray-600">{progress}% 완료</p>
    </div>
  </div>
)}
```

#### 4.3 상태 관리 추가
```typescript
// ChatScreen.tsx에 추가할 상태
const [progress, setProgress] = useState(0);
const [progressMessage, setProgressMessage] = useState('시작 중...');
```

## 구현 순서

### Step 1: API 연동 준비
1. 환경변수 설정 (`API_BASE_URL`)
2. API 클라이언트 유틸리티 함수 생성
3. 에러 처리 및 재시도 로직 구현

### Step 2: MockApiService 교체
1. `startSession()` 실제 API 호출로 변경
2. `processAdditionalQuestion()` 실제 Bedrock 연동
3. 프로필 제출 API 활성화

### Step 3: 폴링 시스템 구현
1. 주석 처리된 폴링 코드 활성화
2. `startPolling()` 함수 구현
3. 에러 처리 및 타임아웃 로직 추가

### Step 4: 진행률 UI 구현
1. 진행률 상태 변수 추가
2. 진행률 바 UI 컴포넌트 구현
3. 단계별 메시지 표시 로직

### Step 5: 테스트 및 최적화
1. 전체 플로우 통합 테스트
2. 에러 시나리오 테스트
3. 성능 최적화 및 UX 개선

## 예상 소요 시간
- **Step 1-2**: API 연동 (2-3시간)
- **Step 3**: 폴링 시스템 (1-2시간)
- **Step 4**: 진행률 UI (1시간)
- **Step 5**: 테스트 및 최적화 (1-2시간)

**총 예상 시간: 5-8시간**

## 주의사항
1. **API 엔드포인트 확인**: 백엔드 API가 완전히 구현되었는지 확인
2. **CORS 설정**: 프론트엔드에서 API 호출 가능하도록 CORS 설정 확인
3. **에러 처리**: 네트워크 오류, 타임아웃, 서버 오류 등 모든 시나리오 대응
4. **사용자 경험**: 로딩 시간이 길어질 경우 사용자에게 적절한 피드백 제공
