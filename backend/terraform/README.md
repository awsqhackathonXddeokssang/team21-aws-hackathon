# AI Chef Lambda Functions - Terraform

Lambda 함수들을 Terraform으로 관리하는 디렉토리입니다.

## 📁 디렉토리 구조

```
terraform/
├── main.tf          # Terraform 설정 및 Provider
├── variables.tf     # 변수 정의
├── lambda.tf        # Lambda 함수 리소스
├── iam.tf          # IAM 역할 및 정책
├── outputs.tf      # 출력 값
├── deploy.sh       # 배포 스크립트
├── cleanup.sh      # 정리 스크립트
└── README.md       # 이 파일
```

## 🚀 배포 방법

### 1. Terraform 설치 (필요시)
```bash
# macOS
brew install terraform

# 또는 직접 다운로드
# https://www.terraform.io/downloads.html
```

### 2. Lambda 함수만 배포
```bash
cd backend/terraform
./deploy.sh
```

### 3. 전체 인프라 배포 (하이브리드)
```bash
cd backend/infrastructure
./deploy-with-terraform.sh
```

## 🧹 정리 방법

```bash
cd backend/terraform
./cleanup.sh
```

## 📦 배포되는 Lambda 함수들

- **ai-chef-recipe**: 레시피 생성 (Bedrock Claude Opus 4.1)
- **ai-chef-price**: 가격 조회 (네이버 쇼핑 API)
- **ai-chef-combine**: 결과 합성
- **recipe-image-generator**: 이미지 생성

## 🔧 환경 변수

`variables.tf`에서 다음 변수들을 설정할 수 있습니다:

- `aws_region`: AWS 리전 (기본값: us-east-1)
- `environment`: 환경명 (기본값: dev)
- `project_name`: 프로젝트명 (기본값: ai-chef)
- `naver_client_id`: 네이버 API 클라이언트 ID
- `naver_client_secret`: 네이버 API 클라이언트 시크릿

## 📝 마이그레이션 노트

- **기존**: CloudFormation 인라인 코드
- **현재**: Terraform + 별도 소스코드 디렉토리
- **장점**: 코드 관리 용이, 버전 관리, 모듈화 가능

## 🔗 연동 정보

Step Functions와 API Gateway는 여전히 CloudFormation으로 관리됩니다.
Lambda ARN은 Terraform outputs를 통해 확인할 수 있습니다:

```bash
terraform output recipe_lambda_arn
terraform output price_lambda_arn
terraform output combine_lambda_arn
terraform output image_generator_lambda_arn
```
