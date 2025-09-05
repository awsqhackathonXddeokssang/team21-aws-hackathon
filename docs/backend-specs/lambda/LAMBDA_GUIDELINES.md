# Lambda 함수 개발 및 배포 가이드라인

## ⚠️ 중요: 코드 동기화 필수사항

**Lambda 소스 코드를 수정할 경우, 반드시 CloudFormation 템플릿의 ZipFile 코드도 함께 업데이트해야 합니다.**

## 현재 Lambda 함수 구조

### 1. 소스 코드 위치
```
backend/lambda/
├── price/index.js                    # 실제 개발 코드
├── combine/index.js                  # 실제 개발 코드
├── recipe-image-generator/index.js   # 실제 개발 코드
└── recipe/lambda_function.py         # 실제 개발 코드
```

### 2. CloudFormation 템플릿 위치
```
backend/infrastructure/
├── price-lambda.yaml        # ZipFile 인라인 코드
├── combine-lambda.yaml      # ZipFile 인라인 코드
├── image-generator-lambda.yaml  # ZipFile 인라인 코드
└── recipe-lambda.yaml       # ZipFile 인라인 코드
```

## 🔄 코드 수정 워크플로우

### 1. Lambda 함수 코드 수정 시
1. **실제 소스 파일 수정**: `backend/lambda/[function-name]/index.js`
2. **CloudFormation 템플릿 업데이트**: `backend/infrastructure/[function-name]-lambda.yaml`의 ZipFile 섹션
3. **두 코드가 동일한지 확인**
4. **배포 실행**

### 2. 예시: Price Lambda 수정
```bash
# 1. 실제 코드 수정
vim backend/lambda/price/index.js

# 2. CloudFormation 템플릿 업데이트
vim backend/infrastructure/price-lambda.yaml
# ZipFile 섹션의 코드를 실제 파일과 동일하게 수정

# 3. 배포
cd backend/infrastructure
./deploy.sh
```

## ⚠️ 주의사항

### 1. 코드 불일치 위험
- **실제 코드**와 **CloudFormation ZipFile 코드**가 다르면 배포된 함수가 예상과 다르게 동작
- 디버깅 시 혼란 발생 가능
- 로컬 테스트와 배포된 함수의 동작 차이

### 2. 의존성 관리
- ZipFile 방식은 `node_modules` 포함 불가
- 외부 라이브러리 사용 시 인라인 코드로 제한
- AWS SDK는 Lambda 런타임에 기본 포함

### 3. 코드 크기 제한
- ZipFile 인라인 코드는 4KB 제한
- 복잡한 로직은 여러 함수로 분할 고려

## 🚀 배포 프로세스

### 1. 로컬 배포
```bash
cd backend/infrastructure
./deploy.sh  # 모든 Lambda 함수 배포
```

### 2. GitHub Actions 자동 배포
- `main` 브랜치 푸시 시 자동 배포
- 모든 CloudFormation 템플릿 순차 배포

## 📋 체크리스트

### Lambda 코드 수정 시 확인사항
- [ ] 실제 소스 파일 수정 완료
- [ ] CloudFormation 템플릿 ZipFile 업데이트 완료
- [ ] 두 코드가 동일한지 확인
- [ ] 의존성 라이브러리 확인 (AWS SDK 외 사용 금지)
- [ ] 코드 크기 4KB 이하 확인
- [ ] 로컬 테스트 완료
- [ ] 배포 후 함수 동작 확인

## 🔧 개선 방향 (향후)

### 1. S3 기반 배포로 전환
```yaml
Code:
  S3Bucket: ai-chef-lambda-code
  S3Key: functions/price-lambda.zip
```

### 2. 빌드 스크립트 추가
```bash
# 자동으로 소스 코드를 ZIP으로 패키징하여 S3 업로드
./build-and-deploy.sh
```

### 3. 코드 동기화 자동화
- 실제 소스 코드 변경 시 CloudFormation 템플릿 자동 업데이트
- Pre-commit hook으로 코드 일치성 검증

## 📞 문제 발생 시

### 1. 함수가 예상대로 동작하지 않는 경우
1. CloudWatch Logs 확인
2. 실제 소스 코드와 CloudFormation ZipFile 코드 비교
3. 코드 동기화 후 재배포

### 2. 배포 실패 시
1. CloudFormation 스택 상태 확인
2. IAM 권한 확인
3. 코드 문법 오류 확인

---

**⚠️ 핵심 원칙: Lambda 소스 코드 수정 = CloudFormation 템플릿 필수 업데이트**
