# 📁 프로젝트 구조 명세서

## 개요
Team21 AWS Hackathon 프로젝트의 디렉토리 구조 및 각 폴더의 역할을 정의합니다.

## 전체 구조

```
team21-aws-hackathon/
├── web/                    # 프론트엔드 (Next.js)
│   ├── package.json        # 의존성 관리
│   ├── next.config.js      # Next.js 설정
│   ├── tailwind.config.js  # Tailwind CSS 설정
│   ├── tsconfig.json       # TypeScript 설정
│   ├── app/                # Next.js App Router
│   │   ├── page.tsx        # 메인 페이지
│   │   ├── layout.tsx      # 레이아웃
│   │   ├── globals.css     # 전역 스타일
│   │   ├── components/     # React 컴포넌트
│   │   │   ├── SplashScreen.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── ResultModal.tsx
│   │   │   └── ConversationalChat.tsx
│   │   └── lib/            # 유틸리티 함수
│   │       ├── api.ts      # API 클라이언트
│   │       └── types.ts    # TypeScript 타입 정의
│   └── public/             # 정적 파일
│       ├── images/
│       └── icons/
├── backend/                # 백엔드 (AWS Lambda + Infrastructure)
│   ├── lambda/             # Lambda 함수들
│   │   ├── orchestrator/   # 세션 관리 및 워크플로우 제어
│   │   │   ├── index.js    # 메인 핸들러
│   │   │   ├── session.js  # 세션 관리 로직
│   │   │   └── package.json
│   │   ├── recipe/         # AI 레시피 생성
│   │   │   ├── index.js    # Bedrock 연동
│   │   │   ├── prompts.js  # AI 프롬프트 관리
│   │   │   └── package.json
│   │   ├── price/          # 가격 조회
│   │   │   ├── index.js    # 네이버 API 연동
│   │   │   ├── cache.js    # 캐싱 로직
│   │   │   └── package.json
│   │   └── combine/        # 결과 합성
│   │       ├── index.js    # 최종 결과 생성
│   │       └── package.json
│   ├── infrastructure/     # AWS 인프라 코드
│   │   ├── cloudformation.yaml  # CloudFormation 템플릿
│   │   ├── step-functions.json  # Step Functions 정의
│   │   ├── deploy.sh       # 배포 스크립트
│   │   └── cleanup.sh      # 리소스 정리 스크립트
│   ├── shared/             # 공통 모듈
│   │   ├── utils/          # 유틸리티 함수
│   │   │   ├── dynamodb.js # DynamoDB 헬퍼
│   │   │   ├── validation.js # 입력 검증
│   │   │   └── response.js # 응답 포맷터
│   │   └── constants/      # 상수 정의
│   │       ├── targets.js  # 타겟별 설정
│   │       └── errors.js   # 에러 코드
│   └── tests/              # 테스트 코드
│       ├── unit/           # 단위 테스트
│       └── integration/    # 통합 테스트
├── docs/                   # 문서들
│   ├── frontend-specs/     # 프론트엔드 명세
│   ├── backend-specs/      # 백엔드 명세
│   ├── integration/        # 통합 명세
│   ├── flows/              # 플로우 다이어그램
│   └── PROJECT_STRUCTURE.md # 이 문서
├── README.md               # 프로젝트 개요
├── .gitignore              # Git 무시 파일
└── .env.example            # 환경변수 예시
```

## 폴더별 상세 설명

### 📱 web/ - 프론트엔드
**기술 스택**: Next.js 14, TypeScript, Tailwind CSS

**주요 역할**:
- 사용자 인터페이스 제공
- 대화형 온보딩 처리
- API 통신 및 상태 관리
- 결과 표시 및 사용자 경험

**배포**: AWS Amplify 또는 Vercel

### ⚡ backend/ - 백엔드
**기술 스택**: Node.js, AWS Lambda, DynamoDB, Step Functions

**주요 역할**:
- API 엔드포인트 제공
- 비즈니스 로직 처리
- AI 서비스 연동 (Bedrock)
- 외부 API 연동 (네이버 쇼핑)
- 데이터 저장 및 관리

**배포**: AWS CloudFormation

### 📚 docs/ - 문서
**역할**:
- 기술 명세서
- API 문서
- 아키텍처 다이어그램
- 개발 가이드

## 개발 워크플로우

### 1. 로컬 개발 환경 설정
```bash
# 프론트엔드 설정
cd web/
npm install
npm run dev

# 백엔드 설정 (별도 터미널)
cd backend/
npm install
# AWS CLI 설정 필요
```

### 2. 개발 순서
1. **백엔드 인프라** 구축 (CloudFormation)
2. **Lambda 함수** 개발 및 배포
3. **프론트엔드** 개발 및 API 연동
4. **통합 테스트** 및 최적화

### 3. 배포 프로세스
```bash
# 백엔드 배포
cd backend/infrastructure/
./deploy.sh

# 프론트엔드 배포
cd web/
npm run build
# Amplify 자동 배포 또는 수동 배포
```

## 환경 분리

### 개발 환경 (dev)
- 로컬 개발 서버
- AWS 개발 계정 리소스
- Mock 데이터 활용

### 프로덕션 환경 (prod)
- AWS 프로덕션 계정
- 실제 API 연동
- 성능 최적화 설정

## 보안 고려사항

### 환경변수 관리
```bash
# web/.env.local
NEXT_PUBLIC_API_ENDPOINT=https://api.example.com
NEXT_PUBLIC_ENVIRONMENT=development

# backend/.env
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
BEDROCK_REGION=us-east-1
```

### API 키 보안
- AWS Systems Manager Parameter Store 사용
- Lambda 환경변수는 암호화
- 프론트엔드에는 공개 키만 노출

## 확장성 고려사항

### 모듈화
- 각 Lambda 함수는 독립적으로 배포 가능
- 공통 모듈은 shared/ 폴더에서 관리
- 프론트엔드 컴포넌트는 재사용 가능하게 설계

### 성능 최적화
- Lambda 함수별 메모리 및 타임아웃 최적화
- DynamoDB 인덱스 설계
- 프론트엔드 코드 스플리팅

### 모니터링
- CloudWatch 로그 및 메트릭
- 프론트엔드 에러 추적
- 성능 모니터링 대시보드

## 팀 협업 가이드

### 브랜치 전략
```
main          # 프로덕션 브랜치
├── develop   # 개발 통합 브랜치
├── feature/frontend-ui    # 프론트엔드 기능
├── feature/backend-api    # 백엔드 API
└── feature/infrastructure # 인프라 구성
```

### 코드 리뷰
- 프론트엔드와 백엔드 각각 전문가 리뷰
- 인프라 코드는 DevOps 관점에서 리뷰
- 보안 및 성능 관점 필수 체크

### 커밋 컨벤션
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 코드
chore: 빌드 및 설정 변경
```

---

**마지막 업데이트**: 2025-09-05  
**작성자**: Team21 AWS Hackathon Team
