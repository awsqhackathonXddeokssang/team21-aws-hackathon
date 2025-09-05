# API 통합 명세서

## 개요
AI 셰프 프로젝트의 백엔드 API 통합 및 세션 기반 워크플로우 명세서

## API 엔드포인트

### 1. 세션 생성
**POST** `/api/session/start`

세션을 생성하고 2시간 동안 유지되는 sessionId를 발급받습니다.

**요청**
```javascript
// 요청 body는 비어있음
const response = await fetch('/api/session/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**응답**
```json
{
  "sessionId": "sess_abc123def456",
  "createdAt": "2024-09-05T11:30:00Z",
  "expiresAt": "2024-09-05T13:30:00Z"
}
```

**구현 예제**
```javascript
async function createSession() {
  try {
    const response = await fetch('/api/session/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const session = await response.json();
    
    // localStorage에 sessionId 저장 (2시간 유지)
    localStorage.setItem('sessionId', session.sessionId);
    localStorage.setItem('sessionExpiry', session.expiresAt);
    
    return session;
  } catch (error) {
    console.error('세션 생성 실패:', error);
    throw error;
  }
}
```

### 2. 프로필 제출 및 처리 시작
**POST** `/api/session/{sessionId}/process`

사용자 프로필을 제출하고 Step Functions 워크플로우를 시작합니다.

**요청**
```javascript
const profile = {
  target: "keto",
  budget: 30000,
  servings: 2,
  carbLimit: 20,
  allergies: ["nuts"],
  cookingTime: 30
};

const response = await fetch(`/api/session/${sessionId}/process`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ profile })
});
```

**응답**
```json
{
  "executionId": "exec_xyz789abc123",
  "estimatedTime": 30
}
```

**구현 예제**
```javascript
async function submitProfile(sessionId, profile) {
  try {
    const response = await fetch(`/api/session/${sessionId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ profile })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // 제출 직후 폴링 시작
    startPolling(sessionId);
    
    return result;
  } catch (error) {
    console.error('프로필 제출 실패:', error);
    throw error;
  }
}
```

### 3. 상태 폴링
**GET** `/api/session/{sessionId}/status`

처리 상태를 2초 간격으로 확인합니다. 최대 30번 시도 후 타임아웃 처리합니다.

**응답**
```json
{
  "status": "processing",
  "phase": "recipe_generation",
  "progress": 40,
  "result": null,
  "error": null
}
```

**Phase별 Progress 매핑**
- `recipe_generation`: 40%
- `price_fetching`: 70%  
- `combining`: 90%

**완료 시 응답**
```json
{
  "status": "completed",
  "phase": "combining",
  "progress": 100,
  "result": {
    "recipe": { /* RecipeResult 객체 */ },
    "pricing": { /* PricingResult 객체 */ },
    "generatedAt": "2024-09-05T11:31:00Z"
  },
  "error": null
}
```

**폴링 구현 예제**
```javascript
function startPolling(sessionId) {
  let attempts = 0;
  const maxAttempts = 30;
  const interval = 2000; // 2초

  const pollInterval = setInterval(async () => {
    attempts++;
    
    try {
      const response = await fetch(`/api/session/${sessionId}/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const statusData = await response.json();
      
      // 진행 상황 업데이트
      updateProgress(statusData.phase, statusData.progress);
      
      // 완료 처리
      if (statusData.status === 'completed') {
        clearInterval(pollInterval);
        handleSuccess(statusData.result);
        return;
      }
      
      // 실패 처리
      if (statusData.status === 'failed') {
        clearInterval(pollInterval);
        handleError(statusData.error);
        return;
      }
      
      // 타임아웃 처리
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        handleTimeout();
        return;
      }
      
    } catch (error) {
      console.error('폴링 에러:', error);
      attempts++; // 네트워크 에러도 시도 횟수에 포함
      
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        handleError('네트워크 오류로 인한 타임아웃');
      }
    }
  }, interval);
  
  return pollInterval;
}

function updateProgress(phase, progress) {
  const phaseMessages = {
    'recipe_generation': '레시피 생성 중...',
    'price_fetching': '가격 정보 조회 중...',
    'combining': '결과 정리 중...'
  };
  
  console.log(`${phaseMessages[phase]} (${progress}%)`);
  
  // UI 업데이트
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressText) progressText.textContent = phaseMessages[phase];
}

function handleSuccess(result) {
  console.log('처리 완료:', result);
  // 결과 화면 표시 로직
  displayRecipeResult(result);
}

function handleError(error) {
  console.error('처리 실패:', error);
  // 에러 화면 표시 로직
  displayError(error);
}

function handleTimeout() {
  console.error('처리 시간 초과');
  // 타임아웃 화면 표시 로직
  displayTimeout();
}
```

## 전체 워크플로우 예제

```javascript
class AIChefAPI {
  constructor() {
    this.sessionId = null;
    this.pollInterval = null;
  }

  async initialize() {
    // 기존 세션 확인
    const savedSessionId = localStorage.getItem('sessionId');
    const sessionExpiry = localStorage.getItem('sessionExpiry');
    
    if (savedSessionId && sessionExpiry && new Date(sessionExpiry) > new Date()) {
      this.sessionId = savedSessionId;
      return this.sessionId;
    }
    
    // 새 세션 생성
    const session = await this.createSession();
    this.sessionId = session.sessionId;
    return this.sessionId;
  }

  async createSession() {
    const response = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`세션 생성 실패: ${response.status}`);
    }

    const session = await response.json();
    localStorage.setItem('sessionId', session.sessionId);
    localStorage.setItem('sessionExpiry', session.expiresAt);
    
    return session;
  }

  async submitProfile(profile) {
    if (!this.sessionId) {
      throw new Error('세션이 초기화되지 않았습니다');
    }

    const response = await fetch(`/api/session/${this.sessionId}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile })
    });

    if (!response.ok) {
      throw new Error(`프로필 제출 실패: ${response.status}`);
    }

    const result = await response.json();
    this.startPolling();
    
    return result;
  }

  startPolling() {
    let attempts = 0;
    const maxAttempts = 30;

    this.pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch(`/api/session/${this.sessionId}/status`);
        const statusData = await response.json();
        
        this.updateProgress(statusData.phase, statusData.progress);
        
        if (statusData.status === 'completed') {
          this.stopPolling();
          this.onSuccess(statusData.result);
        } else if (statusData.status === 'failed') {
          this.stopPolling();
          this.onError(statusData.error);
        } else if (attempts >= maxAttempts) {
          this.stopPolling();
          this.onTimeout();
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          this.stopPolling();
          this.onError('네트워크 오류');
        }
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  updateProgress(phase, progress) {
    // 진행 상황 업데이트 콜백
    if (this.onProgressUpdate) {
      this.onProgressUpdate(phase, progress);
    }
  }

  // 콜백 함수들 (사용자가 정의)
  onSuccess(result) {}
  onError(error) {}
  onTimeout() {}
  onProgressUpdate(phase, progress) {}
}
```

## 에러 처리

### 에러 코드 및 HTTP 상태 코드
- `SESSION_NOT_FOUND` (404): 세션을 찾을 수 없음
- `SESSION_EXPIRED` (410): 세션이 만료됨
- `PROFILE_INVALID` (400): 프로필 검증 실패
- `RECIPE_GENERATION_FAILED` (500): Bedrock API 실패
- `PRICE_FETCH_FAILED` (500): 네이버 API 실패
- `PROCESSING_TIMEOUT` (504): 60초 처리 시간 초과
- `RATE_LIMIT_EXCEEDED` (429): API 호출 제한 초과

### 에러 처리 함수
```javascript
async function handleApiError(error, response, sessionId) {
  const status = response?.status;
  
  switch (status) {
    case 404: // SESSION_NOT_FOUND
      localStorage.removeItem('sessionId');
      localStorage.removeItem('sessionExpiry');
      throw new Error('세션을 찾을 수 없습니다. 새로 시작해주세요.');
      
    case 410: // SESSION_EXPIRED
      localStorage.removeItem('sessionId');
      localStorage.removeItem('sessionExpiry');
      // 자동으로 새 세션 생성
      const newSession = await createSession();
      throw new Error('세션이 만료되어 새로 생성했습니다. 다시 시도해주세요.');
      
    case 400: // PROFILE_INVALID
      throw new Error('입력 정보가 올바르지 않습니다. 다시 확인해주세요.');
      
    case 429: // RATE_LIMIT_EXCEEDED
      throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      
    case 500: // RECIPE_GENERATION_FAILED, PRICE_FETCH_FAILED
      return {
        canRetry: true,
        message: '처리 중 오류가 발생했습니다.',
        retryAction: () => retryProcessing(sessionId)
      };
      
    case 504: // PROCESSING_TIMEOUT
      return {
        canRetry: true,
        message: '처리 시간이 초과되었습니다.',
        retryAction: () => retryProcessing(sessionId)
      };
      
    default:
      throw new Error('알 수 없는 오류가 발생했습니다.');
  }
}

async function retryProcessing(sessionId) {
  try {
    // 기존 프로필로 재시도
    const savedProfile = JSON.parse(localStorage.getItem(`profile_${sessionId}`) || '{}');
    return await submitProfile(sessionId, savedProfile);
  } catch (error) {
    throw new Error('재시도 중 오류가 발생했습니다.');
  }
}
```

## 결과 캐싱 시스템

### 캐시 관리 클래스
```javascript
class ResultCache {
  static TTL = 3600000; // 1시간 (ms)
  static MAX_RECENT_SESSIONS = 5;

  static saveResult(sessionId, result) {
    const cacheData = {
      result,
      timestamp: Date.now(),
      ttl: this.TTL
    };
    
    localStorage.setItem(`result_${sessionId}`, JSON.stringify(cacheData));
    this.updateRecentSessions(sessionId);
    this.clearExpiredCache();
  }

  static getResult(sessionId) {
    const cached = localStorage.getItem(`result_${sessionId}`);
    if (!cached) return null;

    try {
      const cacheData = JSON.parse(cached);
      const now = Date.now();
      
      // TTL 체크
      if (now - cacheData.timestamp > cacheData.ttl) {
        localStorage.removeItem(`result_${sessionId}`);
        return null;
      }
      
      return cacheData.result;
    } catch (error) {
      localStorage.removeItem(`result_${sessionId}`);
      return null;
    }
  }

  static updateRecentSessions(sessionId) {
    let recentSessions = JSON.parse(localStorage.getItem('recent_sessions') || '[]');
    
    // 기존 세션 제거
    recentSessions = recentSessions.filter(id => id !== sessionId);
    
    // 새 세션을 맨 앞에 추가
    recentSessions.unshift(sessionId);
    
    // 최대 개수 제한
    if (recentSessions.length > this.MAX_RECENT_SESSIONS) {
      const removedSessions = recentSessions.splice(this.MAX_RECENT_SESSIONS);
      // 제거된 세션의 캐시 삭제
      removedSessions.forEach(id => {
        localStorage.removeItem(`result_${id}`);
      });
    }
    
    localStorage.setItem('recent_sessions', JSON.stringify(recentSessions));
  }

  static clearExpiredCache() {
    const recentSessions = JSON.parse(localStorage.getItem('recent_sessions') || '[]');
    const now = Date.now();
    
    recentSessions.forEach(sessionId => {
      const cached = localStorage.getItem(`result_${sessionId}`);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          if (now - cacheData.timestamp > cacheData.ttl) {
            localStorage.removeItem(`result_${sessionId}`);
          }
        } catch (error) {
          localStorage.removeItem(`result_${sessionId}`);
        }
      }
    });
    
    // 만료된 세션을 recent_sessions에서도 제거
    const validSessions = recentSessions.filter(sessionId => {
      return localStorage.getItem(`result_${sessionId}`) !== null;
    });
    
    localStorage.setItem('recent_sessions', JSON.stringify(validSessions));
  }

  static getRecentResults() {
    const recentSessions = JSON.parse(localStorage.getItem('recent_sessions') || '[]');
    const results = [];
    
    recentSessions.forEach(sessionId => {
      const result = this.getResult(sessionId);
      if (result) {
        results.push({
          sessionId,
          result,
          timestamp: JSON.parse(localStorage.getItem(`result_${sessionId}`)).timestamp
        });
      }
    });
    
    return results;
  }
}
```

### 캐싱이 적용된 API 클래스
```javascript
class AIChefAPI {
  constructor() {
    this.sessionId = null;
    this.pollInterval = null;
  }

  async initialize() {
    const savedSessionId = localStorage.getItem('sessionId');
    const sessionExpiry = localStorage.getItem('sessionExpiry');
    
    if (savedSessionId && sessionExpiry && new Date(sessionExpiry) > new Date()) {
      this.sessionId = savedSessionId;
      
      // 캐시된 결과 확인
      const cachedResult = ResultCache.getResult(savedSessionId);
      if (cachedResult) {
        this.onSuccess(cachedResult);
        return savedSessionId;
      }
    }
    
    const session = await this.createSession();
    this.sessionId = session.sessionId;
    return this.sessionId;
  }

  async createSession() {
    try {
      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        await handleApiError(null, response, null);
      }

      const session = await response.json();
      localStorage.setItem('sessionId', session.sessionId);
      localStorage.setItem('sessionExpiry', session.expiresAt);
      
      return session;
    } catch (error) {
      throw error;
    }
  }

  async submitProfile(profile) {
    if (!this.sessionId) {
      throw new Error('세션이 초기화되지 않았습니다');
    }

    // 프로필 저장 (재시도용)
    localStorage.setItem(`profile_${this.sessionId}`, JSON.stringify(profile));

    try {
      const response = await fetch(`/api/session/${this.sessionId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });

      if (!response.ok) {
        const errorResult = await handleApiError(null, response, this.sessionId);
        if (errorResult?.canRetry) {
          this.onRetryAvailable(errorResult);
          return;
        }
      }

      const result = await response.json();
      this.startPolling();
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  startPolling() {
    let attempts = 0;
    const maxAttempts = 30;

    this.pollInterval = setInterval(async () => {
      attempts++;
      
      try {
        const response = await fetch(`/api/session/${this.sessionId}/status`);
        
        if (!response.ok) {
          const errorResult = await handleApiError(null, response, this.sessionId);
          if (errorResult?.canRetry) {
            this.stopPolling();
            this.onRetryAvailable(errorResult);
            return;
          }
        }
        
        const statusData = await response.json();
        this.updateProgress(statusData.phase, statusData.progress);
        
        if (statusData.status === 'completed') {
          this.stopPolling();
          // 결과 캐싱
          ResultCache.saveResult(this.sessionId, statusData.result);
          this.onSuccess(statusData.result);
        } else if (statusData.status === 'failed') {
          this.stopPolling();
          this.onError(statusData.error);
        } else if (attempts >= maxAttempts) {
          this.stopPolling();
          this.onTimeout();
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          this.stopPolling();
          this.onError('네트워크 오류');
        }
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  updateProgress(phase, progress) {
    if (this.onProgressUpdate) {
      this.onProgressUpdate(phase, progress);
    }
  }

  getRecentResults() {
    return ResultCache.getRecentResults();
  }

  // 콜백 함수들
  onSuccess(result) {}
  onError(error) {}
  onTimeout() {}
  onProgressUpdate(phase, progress) {}
  onRetryAvailable(retryInfo) {}
}
```

### 사용 예제
```javascript
// API 초기화
const api = new AIChefAPI();

// 콜백 설정
api.onSuccess = (result) => {
  console.log('레시피 완성:', result);
  displayResult(result);
};

api.onError = (error) => {
  console.error('오류 발생:', error);
  showErrorMessage(error);
};

api.onRetryAvailable = (retryInfo) => {
  showRetryDialog(retryInfo.message, retryInfo.retryAction);
};

api.onProgressUpdate = (phase, progress) => {
  updateProgressBar(phase, progress);
};

// 사용
await api.initialize();
await api.submitProfile(userProfile);

// 최근 결과 조회
const recentResults = api.getRecentResults();
console.log('최근 결과들:', recentResults);
```
