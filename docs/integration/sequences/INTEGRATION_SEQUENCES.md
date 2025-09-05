# 통합 시퀀스 명세서

## 개요
AI 셰프 프로젝트의 Phase별 통합 시퀀스 다이어그램 및 상호작용 명세서

## 전체 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway as API Gateway
    participant Lambda(Orchestrator) as Lambda(Orchestrator)
    participant DynamoDB
    participant Step Functions as Step Functions
    participant Lambda(Recipe) as Lambda(Recipe)
    participant Lambda(Price) as Lambda(Price)
    participant Bedrock
    participant Naver API as Naver API

    %% Phase 1: 세션 초기화
    Note over User, Naver API: Phase 1: 세션 초기화
    User->>Frontend: 페이지 접속
    Frontend->>API Gateway: POST /api/session/start
    API Gateway->>Lambda(Orchestrator): 세션 생성 요청
    Lambda(Orchestrator)->>DynamoDB: 세션 데이터 저장
    DynamoDB-->>Lambda(Orchestrator): 저장 완료
    Lambda(Orchestrator)-->>API Gateway: sessionId, createdAt, expiresAt
    API Gateway-->>Frontend: 세션 정보 반환
    Frontend-->>User: 대화 시작

    %% Phase 2: 대화 및 프로필 수집
    Note over User, Naver API: Phase 2: 대화 및 프로필 수집
    User->>Frontend: 대화 진행 (타겟 선택, 질문 답변)
    Note over Frontend: 프로필 수집 완료

    %% Phase 3: 비동기 처리 시작
    Note over User, Naver API: Phase 3: 비동기 처리 시작
    Frontend->>API Gateway: POST /api/session/{sessionId}/process
    API Gateway->>Lambda(Orchestrator): 프로필 제출
    Lambda(Orchestrator)->>DynamoDB: 프로필 저장
    Lambda(Orchestrator)->>Step Functions: 워크플로우 시작
    Step Functions-->>Lambda(Orchestrator): executionId
    Lambda(Orchestrator)-->>API Gateway: executionId, estimatedTime
    API Gateway-->>Frontend: 처리 시작 응답

    %% Phase 4: 병렬 처리
    Note over User, Naver API: Phase 4: 병렬 처리
    Step Functions->>Lambda(Recipe): 레시피 생성 시작
    Step Functions->>Lambda(Price): 가격 조회 시작
    
    par 레시피 생성
        Lambda(Recipe)->>Bedrock: AI 레시피 생성 요청
        Bedrock-->>Lambda(Recipe): 레시피 데이터
        Lambda(Recipe)->>DynamoDB: 레시피 결과 저장
    and 가격 조회
        Lambda(Price)->>Naver API: 가격 정보 요청
        Naver API-->>Lambda(Price): 가격 데이터
        Lambda(Price)->>DynamoDB: 가격 결과 저장
    end

    Step Functions->>DynamoDB: 최종 결과 합성 및 저장
    DynamoDB-->>Step Functions: 저장 완료

    %% Phase 5: 폴링 및 결과 표시
    Note over User, Naver API: Phase 5: 폴링 및 결과 표시
    loop 폴링 (2초 간격, 최대 30회)
        Frontend->>API Gateway: GET /api/session/{sessionId}/status
        API Gateway->>Lambda(Orchestrator): 상태 조회
        Lambda(Orchestrator)->>DynamoDB: 처리 상태 확인
        DynamoDB-->>Lambda(Orchestrator): 상태 데이터
        Lambda(Orchestrator)-->>API Gateway: status, phase, progress
        API Gateway-->>Frontend: 처리 상태
        
        alt 처리 완료
            Frontend->>API Gateway: GET /api/session/{sessionId}/status
            API Gateway->>Lambda(Orchestrator): 최종 결과 조회
            Lambda(Orchestrator)->>DynamoDB: 결과 데이터 조회
            DynamoDB-->>Lambda(Orchestrator): 완성된 레시피 + 가격 정보
            Lambda(Orchestrator)-->>API Gateway: 완전한 결과
            API Gateway-->>Frontend: 최종 결과
            Frontend-->>User: 레시피 및 가격 정보 표시
        else 처리 중
            Note over Frontend: 진행률 업데이트 후 계속 폴링
        else 처리 실패
            Lambda(Orchestrator)-->>API Gateway: 에러 정보
            API Gateway-->>Frontend: 에러 응답
            Frontend-->>User: 에러 메시지 및 재시도 옵션
        end
    end
```

## Phase별 상세 설명

### Phase 1: 세션 초기화
- 사용자가 페이지에 접속하면 자동으로 세션 생성
- sessionId는 2시간 동안 유효
- localStorage에 세션 정보 저장

### Phase 2: 대화 및 프로필 수집  
- 타겟별 질문 플로우 진행
- 프론트엔드에서 프로필 완성까지 처리
- 서버 통신 없이 클라이언트 사이드에서 진행

### Phase 3: 비동기 처리 시작
- 완성된 프로필을 서버로 제출
- Step Functions 워크플로우 시작
- executionId로 처리 추적 시작

### Phase 4: 병렬 처리
- Recipe Lambda: Bedrock을 통한 AI 레시피 생성
- Price Lambda: 네이버 쇼핑 API를 통한 가격 조회
- 두 작업이 병렬로 실행되어 처리 시간 단축

### Phase 5: 폴링 및 결과 표시
- 2초 간격으로 처리 상태 확인
- 진행률 표시 (recipe_generation: 40%, price_fetching: 70%, combining: 90%)
- 완료 시 결과 표시, 실패 시 재시도 옵션 제공

## 목차
- [Phase 1: 세션 초기화](#phase-1-세션-초기화)
- [Phase 2: 대화 및 프로필 수집](#phase-2-대화-및-프로필-수집)
- [Phase 3: 비동기 처리](#phase-3-비동기-처리)
- [Phase 4: 결과 표시](#phase-4-결과-표시)
