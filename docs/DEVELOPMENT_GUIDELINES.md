# 🚀 Team21 개발 가이드라인

AI 셰프 프로젝트 개발 시 팀원들이 공통으로 지켜야 할 규칙과 가이드라인입니다.

## 📋 목차
- [기술 스택 표준](#기술-스택-표준)
- [프로젝트 구조 규칙](#프로젝트-구조-규칙)
- [코딩 컨벤션](#코딩-컨벤션)
- [Git 워크플로우](#git-워크플로우)
- [문서화 규칙](#문서화-규칙)
- [보안 가이드라인](#보안-가이드라인)
- [배포 및 인프라](#배포-및-인프라)

## 🛠 기술 스택 표준

### 프론트엔드
- **Framework**: Next.js 14 (App Router 사용)
- **Language**: TypeScript (필수)
- **Styling**: Tailwind CSS
- **State Management**: React Hooks + Context API
- **HTTP Client**: fetch API 또는 axios

### 백엔드
- **Platform**: AWS Lambda
- **Database**: DynamoDB
- **Orchestration**: AWS Step Functions
- **AI Service**: AWS Bedrock (Claude 3)
- **External API**: 네이버 쇼핑 API

### 인프라
- **IaC**: AWS CloudFormation
- **Deployment**: AWS CLI + Shell Scripts
- **Monitoring**: CloudWatch
- **Security**: AWS Systems Manager Parameter Store

## 📁 프로젝트 구조 규칙

### 디렉토리 명명 규칙
```
team21-aws-hackathon/
├── web/                    # 프론트엔드 (kebab-case)
├── backend/                # 백엔드 (kebab-case)
├── docs/                   # 문서 (kebab-case)
└── README.md               # 대문자 확장자
```

### 파일 명명 규칙
- **React 컴포넌트**: PascalCase (예: `ChatScreen.tsx`)
- **유틸리티 함수**: camelCase (예: `api.ts`)
- **Lambda 함수**: camelCase (예: `index.js`)
- **문서 파일**: UPPER_SNAKE_CASE (예: `PROJECT_STRUCTURE.md`)
- **설정 파일**: kebab-case (예: `next.config.js`)

### 폴더 구조 준수
- Lambda 함수는 `backend/lambda/[function-name]/` 형태
- 공통 모듈은 `backend/shared/` 에 배치
- 프론트엔드 컴포넌트는 `web/app/components/` 에 배치
- 문서는 용도별로 `docs/[category]/` 에 분류

## 💻 코딩 컨벤션

### TypeScript 규칙
```typescript
// ✅ 좋은 예
interface UserProfile {
  targetType: 'keto' | 'baby' | 'diabetes' | 'diet' | 'fridge';
  preferences: string[];
  restrictions: string[];
}

// ❌ 나쁜 예
interface userprofile {
  target: string;
  prefs: any;
}
```

### React 컴포넌트 규칙
```typescript
// ✅ 좋은 예 - 함수형 컴포넌트 + TypeScript
interface ChatScreenProps {
  sessionId: string;
  onComplete: (profile: UserProfile) => void;
}

export default function ChatScreen({ sessionId, onComplete }: ChatScreenProps) {
  // 컴포넌트 로직
}

// ❌ 나쁜 예 - 타입 정의 없음
export default function ChatScreen(props) {
  // 컴포넌트 로직
}
```

### Lambda 함수 규칙
```javascript
// ✅ 좋은 예 - 명확한 에러 핸들링
exports.handler = async (event) => {
  try {
    const result = await processRequest(event);
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
```

## 🔄 Git 워크플로우

### 브랜치 전략
```
main                    # 프로덕션 브랜치 (보호됨)
├── develop            # 개발 통합 브랜치
├── feature/frontend-* # 프론트엔드 기능 브랜치
├── feature/backend-*  # 백엔드 기능 브랜치
├── feature/infra-*    # 인프라 기능 브랜치
├── fix/*              # 버그 수정 브랜치
└── docs/*             # 문서 수정 브랜치
```

### 커밋 메시지 컨벤션
```bash
# 형식: type: description
feat: Add user profile collection chat interface
fix: Resolve DynamoDB connection timeout issue
docs: Update API documentation for recipe endpoint
style: Format code with prettier
refactor: Extract common validation logic
test: Add unit tests for price calculation
chore: Update dependencies and build scripts
```

### Pull Request 규칙
1. **제목**: `[타입] 간단한 설명`
2. **설명**: 변경사항, 테스트 방법, 스크린샷 포함
3. **리뷰어**: 최소 1명 이상 승인 필요
4. **체크리스트**: 
   - [ ] 로컬 테스트 완료
   - [ ] 문서 업데이트 (필요시)
   - [ ] 보안 검토 완료

## 📝 문서화 규칙

### README.md 구조
1. 프로젝트 제목 및 설명
2. 어플리케이션 개요 (핵심 가치 제안, 타겟 사용자)
3. 주요 기능
4. 동영상 데모 (TODO 허용)
5. 리소스 배포하기 (TODO 허용)
6. AWS 아키텍처 (Mermaid 다이어그램 필수)
7. 프로젝트 기대 효과 및 예상 사용 사례

### 다이어그램 규칙
- **플로우차트**: Mermaid 문법 사용 필수
- **아키텍처**: 컴포넌트별 색상 구분
- **API 플로우**: 순서도 형태로 표현

### 코드 문서화
```typescript
/**
 * 사용자 프로필을 기반으로 AI 레시피를 생성합니다.
 * @param profile 사용자 프로필 정보
 * @param preferences 식단 선호도
 * @returns Promise<Recipe> 생성된 레시피
 */
async function generateRecipe(profile: UserProfile, preferences: string[]): Promise<Recipe> {
  // 구현
}
```

## 🔒 보안 가이드라인

### 환경변수 관리
```bash
# ✅ 좋은 예 - 환경별 분리
# web/.env.local (로컬 개발)
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3001
NEXT_PUBLIC_ENVIRONMENT=development

# web/.env.production (프로덕션)
NEXT_PUBLIC_API_ENDPOINT=https://api.ai-chef.com
NEXT_PUBLIC_ENVIRONMENT=production
```

### API 키 보안
- **절대 금지**: 코드에 직접 하드코딩
- **프론트엔드**: `NEXT_PUBLIC_` 접두사만 사용
- **백엔드**: AWS Parameter Store 또는 Lambda 환경변수
- **로컬 개발**: `.env` 파일 (`.gitignore`에 포함)

### 데이터 검증
```typescript
// ✅ 입력 데이터 검증 필수
function validateUserInput(input: any): UserProfile {
  if (!input.targetType || !['keto', 'baby', 'diabetes', 'diet', 'fridge'].includes(input.targetType)) {
    throw new Error('Invalid target type');
  }
  // 추가 검증 로직
}
```

## 🚀 배포 및 인프라

### 배포 순서
1. **백엔드 인프라** 배포 (CloudFormation)
2. **Lambda 함수** 배포 및 테스트
3. **프론트엔드** 빌드 및 배포
4. **통합 테스트** 실행

### 환경 분리
- **개발 환경**: `dev` 접미사 사용
- **프로덕션 환경**: `prod` 접미사 사용
- **리소스 명명**: `ai-chef-[resource]-[env]` 형태

### 모니터링 필수사항
- CloudWatch 로그 그룹 설정
- Lambda 함수별 메트릭 모니터링
- API Gateway 에러율 추적
- DynamoDB 성능 모니터링

## ✅ 코드 리뷰 체크리스트

### 공통
- [ ] 커밋 메시지가 컨벤션을 따르는가?
- [ ] 코드에 하드코딩된 값이 없는가?
- [ ] 에러 핸들링이 적절한가?
- [ ] 보안 취약점이 없는가?

### 프론트엔드
- [ ] TypeScript 타입이 정의되어 있는가?
- [ ] 컴포넌트가 재사용 가능하게 설계되었는가?
- [ ] 반응형 디자인이 적용되었는가?
- [ ] 접근성(a11y)이 고려되었는가?

### 백엔드
- [ ] Lambda 함수가 단일 책임을 가지는가?
- [ ] DynamoDB 쿼리가 최적화되었는가?
- [ ] API 응답 형식이 일관적인가?
- [ ] 로깅이 적절히 구현되었는가?

### 인프라
- [ ] CloudFormation 템플릿이 유효한가?
- [ ] 리소스 태그가 적절히 설정되었는가?
- [ ] 보안 그룹 설정이 최소 권한 원칙을 따르는가?
- [ ] 비용 최적화가 고려되었는가?

## 🆘 문제 해결 가이드

### 자주 발생하는 이슈
1. **CORS 에러**: API Gateway에서 CORS 설정 확인
2. **Lambda 타임아웃**: 메모리 및 타임아웃 설정 조정
3. **DynamoDB 스로틀링**: 읽기/쓰기 용량 확인
4. **환경변수 누락**: `.env` 파일 및 Parameter Store 확인

### 디버깅 방법
- CloudWatch 로그 확인
- 로컬 환경에서 단위 테스트
- Postman으로 API 테스트
- 브라우저 개발자 도구 활용

---

**마지막 업데이트**: 2025-09-05  
**작성자**: Team21 AWS Hackathon Team  
**문서 버전**: 1.0

> 💡 **참고**: 이 가이드라인은 프로젝트 진행에 따라 업데이트될 수 있습니다. 변경사항이 있을 때는 팀원들에게 공지하고 문서를 업데이트해주세요.
