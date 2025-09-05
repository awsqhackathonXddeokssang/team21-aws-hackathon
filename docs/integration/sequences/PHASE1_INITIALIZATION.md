# Phase 1: 세션 초기화 시퀀스

## 개요
사용자가 앱에 접속하여 세션을 생성하는 초기화 과정

## 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant MockApiService
    participant API Gateway as API Gateway
    participant Lambda
    participant DynamoDB

    Note over User, DynamoDB: Phase 1: 세션 초기화

    User->>Frontend: 앱 접속
    Frontend->>Frontend: localStorage에서 sessionId 확인
    
    alt sessionId 없음 또는 만료
        Frontend->>MockApiService: startSession() 호출
        MockApiService->>API Gateway: POST /session/start
        API Gateway->>Lambda: 세션 생성 요청
        Lambda->>Lambda: sessionId 생성 (서버에서만)
        Lambda->>DynamoDB: sessionId 및 메타데이터 저장 (TTL 2시간)
        
        Note over Lambda: 세션 ID 형식: sess-{timestamp}-{random}
        Note over Lambda: STATUS: 'idle'로 시작
        
        DynamoDB-->>Lambda: 저장 완료
        Lambda-->>API Gateway: sessionId, createdAt, expiresAt 반환
        API Gateway-->>MockApiService: 세션 데이터 반환
        MockApiService-->>Frontend: sessionId 반환
        Frontend->>Frontend: localStorage에 sessionId 저장
        Frontend-->>User: 세션 준비 완료
    else sessionId 유효
        Note over Frontend: 기존 세션 사용 (서버 검증 생략)
        Frontend-->>User: 세션 복원 완료
    end
```

## 상세 플로우

### 1. 앱 접속
- 사용자가 웹 애플리케이션에 접속
- Frontend 컴포넌트 마운트 시 세션 초기화 시작

### 2. 기존 세션 확인
```javascript
// localStorage에서 기존 세션 확인
const savedSessionId = localStorage.getItem('sessionId');
const sessionExpiry = localStorage.getItem('sessionExpiry');

if (savedSessionId && sessionExpiry && new Date(sessionExpiry) > new Date()) {
    // 유효한 세션 존재 - 서버 검증 필요시 추가 호출
    return savedSessionId;
} else {
    // 새 세션 생성 필요
    const sessionData = await MockApiService.startSession();
    return sessionData.sessionId;
}
```

### 3. 새 세션 생성 요청
- **Frontend**: `MockApiService.startSession()` 호출
- **Mock API**: `POST /session/start` 시뮬레이션
- **Request Body**: 빈 객체 `{}`
- **Headers**: `Content-Type: application/json`

### 4. 서버 세션 생성 로직 (Mock)
```javascript
// MockApiService.startSession() 구현
export const startSession = async (): Promise<SessionResponse> => {
  // 실제 구현에서는 서버가 생성
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sessionId = `sess-${timestamp}-${random}`;
  
  const sessionData = {
    sessionId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  };
  
  // Mock: 실제로는 서버에서 DynamoDB 저장
  return sessionData;
};
```

### 5. DynamoDB 저장 (서버에서 처리)
- **Table**: `ai-chef-sessions`
- **Partition Key**: `sessionId`
- **TTL Attribute**: `TTL` (2시간 자동 삭제)
- **프론트엔드는 관여하지 않음**

### 6. 응답 데이터
```json
{
    "sessionId": "sess-1725512345678-abc123",
    "createdAt": "2024-09-05T11:30:00.000Z",
    "expiresAt": "2024-09-05T13:30:00.000Z"
}
```

### 7. Frontend 저장
```javascript
// ChatScreen useEffect 수정
useEffect(() => {
  const initializeSession = async () => {
    try {
      const sessionData = await MockApiService.startSession();
      setSessionId(sessionData.sessionId);
      localStorage.setItem('sessionId', sessionData.sessionId);
      localStorage.setItem('sessionExpiry', sessionData.expiresAt);
    } catch (error) {
      console.error('세션 초기화 실패:', error);
      // Fallback: 클라이언트 임시 세션
      const fallbackId = `temp-${Date.now()}`;
      setSessionId(fallbackId);
    }
  };
  
  initializeSession();
}, []);
```

## 역할 분담

### Frontend 역할
- **세션 API 호출**: `MockApiService.startSession()` 호출
- **응답 저장**: 받은 sessionId를 localStorage에 저장
- **세션 사용**: 이후 모든 API 호출에 sessionId 포함
- **sessionId 생성 안 함**: 서버에서만 생성

### 서버 역할 (Mock/실제)
- **sessionId 생성**: 고유한 세션 ID 생성
- **DynamoDB 저장**: 세션 메타데이터 저장
- **TTL 관리**: 2시간 자동 만료 설정
- **응답 반환**: sessionId와 만료 시간 반환

### MockApiService 역할
- **API 추상화**: 실제 서버 호출 시뮬레이션
- **인터페이스 통일**: 실제 API와 동일한 응답 구조
- **에러 처리**: 네트워크 오류 시뮬레이션

## 에러 처리

### 세션 생성 실패
- **HTTP 500**: Lambda 실행 오류
- **HTTP 503**: DynamoDB 연결 실패
- **Retry Logic**: 2초 후 자동 재시도

### 네트워크 오류
- **Connection Timeout**: 10초 타임아웃
- **Retry Logic**: 최대 3회 재시도

## 성능 고려사항

### Cold Start 최적화
- Lambda 함수 Provisioned Concurrency 설정
- 최소 메모리 128MB로 빠른 시작

### DynamoDB 최적화
- On-Demand 빌링 모드
- TTL 자동 삭제로 스토리지 비용 절약

## 보안 고려사항

### 세션 ID 보안
- 충분한 엔트로피 (timestamp + random)
- 예측 불가능한 형태
- 2시간 자동 만료

### CORS 설정
```javascript
// API Gateway CORS 헤더
{
    "Access-Control-Allow-Origin": "https://your-domain.com",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
}
```
