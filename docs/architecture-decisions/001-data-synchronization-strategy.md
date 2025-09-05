# Architecture Decision Record: 데이터 동기화 전략

## 날짜
2025-01-05

## 상태
결정됨 (Decided)

## 컨텍스트
AI Chef 애플리케이션에서 사용자 프로필 데이터를 수집하고 관리하는 과정에서 다음과 같은 도전과제가 있었습니다:

1. **데이터 일관성 문제**: Frontend와 Backend 간 데이터 동기화
2. **보안 문제**: Frontend에서 데이터 위조 가능성
3. **UX 요구사항**: 빠른 응답속도와 오프라인 지원
4. **확장성**: 향후 더 복잡한 프로필 데이터 처리

## 문제 상황

### 초기 설계의 문제점
- Frontend(localStorage)에서만 기본 프로필 데이터 관리
- "아니요, 충분해요" 경로에서 Backend로 데이터 전송 누락
- Frontend 데이터를 신뢰할 수 없는 보안 취약점

### 구체적 시나리오
```
사용자 A: "시작하기" → 타겟/인분/시간 선택 → "아니요, 충분해요"
결과: Backend에 프로필 데이터가 없어서 레시피 생성 실패
```

## 검토한 옵션들

### 옵션 1: 즉시 동기화 (선택됨) ✅
각 단계마다 서버에 즉시 저장
- **장점**: 
  - 데이터 무결성 보장
  - 서버가 Single Source of Truth
  - 중간 이탈 시에도 데이터 보존
- **단점**: 
  - API 호출 빈도 증가
  - 네트워크 의존적

### 옵션 2: 체크포인트 저장
중요 시점에만 일괄 저장
- **장점**: API 호출 최소화
- **단점**: 중간 이탈 시 데이터 손실

### 옵션 3: 서명 기반 검증
Frontend 데이터에 서버 서명 추가
- **장점**: Frontend 성능 유지
- **단점**: 구현 복잡도 높음

### 옵션 4: UUID 매핑
선택지를 UUID로 관리
- **장점**: 완벽한 위조 방지
- **단점**: 매핑 테이블 관리 부담

## 결정

**옵션 1: 즉시 동기화 방식**을 채택합니다.

### 구현 방식
```javascript
// 각 단계마다 전체 프로필 데이터 전송
async function updateProfile(field, value) {
    const profile = {
        ...currentProfile,
        [field]: value
    };
    
    await fetch('/session/update', {
        method: 'POST',
        body: JSON.stringify({
            sessionId,
            profile  // 누적된 전체 데이터
        })
    });
}
```

## 결과

### 긍정적 효과
1. **데이터 일관성**: Frontend-Backend 항상 동기화
2. **보안 강화**: 서버가 유일한 진실의 소스
3. **단순한 구조**: GetItem 불필요, 상태 관리 단순화
4. **신뢰성**: 네트워크 중단 시에도 이전 데이터는 보존

### 부정적 효과
1. **네트워크 부담**: 각 단계마다 API 호출
2. **지연 시간**: 각 선택마다 서버 응답 대기

## 향후 개선 계획

### Phase 1: 현재 구현 (MVP)
- 매 단계 즉시 동기화
- 단순한 POST /session/update 엔드포인트

### Phase 2: 성능 최적화
```javascript
// Optimistic UI 적용
async function updateWithOptimisticUI(field, value) {
    // 1. UI 즉시 업데이트
    setUIProfile(prev => ({ ...prev, [field]: value }));
    
    // 2. 백그라운드에서 서버 동기화
    try {
        await syncToServer(field, value);
    } catch (error) {
        // 3. 실패 시 롤백
        rollbackUI();
        showRetryOption();
    }
}
```

### Phase 3: 하이브리드 전략
```javascript
// 네트워크 상태에 따른 적응형 동기화
class AdaptiveSyncStrategy {
    constructor() {
        this.networkQuality = this.measureNetwork();
        this.pendingUpdates = [];
    }
    
    async sync(data) {
        if (this.networkQuality === 'good') {
            // 즉시 동기화
            return await this.immediateSync(data);
        } else {
            // 배치 동기화
            this.pendingUpdates.push(data);
            return await this.batchSync();
        }
    }
}
```

### Phase 4: 엔터프라이즈 확장
- WebSocket 실시간 동기화
- Conflict Resolution 전략
- Multi-device 동기화
- Offline-first PWA 지원

## 관련 문서
- [PHASE2_COLLECTION.md](../integration/sequences/PHASE2_COLLECTION.md)
- [보안 고려사항](./002-security-considerations.md)
- [확장성 로드맵](./003-scalability-roadmap.md)