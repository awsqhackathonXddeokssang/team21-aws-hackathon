# 서버리스 배포 스크립트

## 개요
AI Chef 서버리스 아키텍처 자동 배포를 위한 스크립트 및 가이드

## 배포 스크립트 구조
```
backend/infrastructure/
├── deploy.sh              # 메인 배포 스크립트
├── cleanup.sh             # 리소스 정리 스크립트
├── build-lambdas.sh       # Lambda 패키지 빌드
├── upload-templates.sh    # CloudFormation 템플릿 업로드
├── validate-stack.sh      # 스택 검증
└── scripts/
    ├── package-lambda.py  # Lambda 패키징 도구
    ├── check-resources.py # 리소스 상태 확인
    └── setup-env.sh       # 환경 설정
```

## 메인 배포 스크립트 (deploy.sh)
```bash
#!/bin/bash

set -e  # 에러 발생 시 스크립트 중단

# 설정 변수
PROJECT_NAME="ai-chef"
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
AWS_PROFILE=${3:-default}

# 색상 출력을 위한 함수
print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# 사전 요구사항 확인
check_prerequisites() {
    print_info "사전 요구사항 확인 중..."
    
    # AWS CLI 확인
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI가 설치되지 않았습니다."
        exit 1
    fi
    
    # Python 확인
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3가 설치되지 않았습니다."
        exit 1
    fi
    
    # jq 확인 (JSON 처리용)
    if ! command -v jq &> /dev/null; then
        print_error "jq가 설치되지 않았습니다. 'brew install jq' 또는 'apt-get install jq'로 설치하세요."
        exit 1
    fi
    
    # AWS 자격 증명 확인
    if ! aws sts get-caller-identity --profile $AWS_PROFILE &> /dev/null; then
        print_error "AWS 자격 증명이 설정되지 않았습니다."
        exit 1
    fi
    
    print_success "사전 요구사항 확인 완료"
}

# S3 배포 버킷 생성
create_deployment_bucket() {
    local bucket_name="${PROJECT_NAME}-deployment-${ENVIRONMENT}-$(aws sts get-caller-identity --query Account --output text --profile $AWS_PROFILE)"
    
    print_info "배포 버킷 생성: $bucket_name"
    
    # 버킷 존재 확인
    if aws s3 ls "s3://$bucket_name" --profile $AWS_PROFILE 2>/dev/null; then
        print_info "배포 버킷이 이미 존재합니다: $bucket_name"
    else
        # 버킷 생성
        if [ "$AWS_REGION" = "us-east-1" ]; then
            aws s3 mb "s3://$bucket_name" --profile $AWS_PROFILE
        else
            aws s3 mb "s3://$bucket_name" --region $AWS_REGION --profile $AWS_PROFILE
        fi
        
        # 버전 관리 활성화
        aws s3api put-bucket-versioning \
            --bucket $bucket_name \
            --versioning-configuration Status=Enabled \
            --profile $AWS_PROFILE
        
        print_success "배포 버킷 생성 완료: $bucket_name"
    fi
    
    echo $bucket_name
}

# Lambda 함수 빌드 및 패키징
build_lambda_packages() {
    print_info "Lambda 함수 패키징 중..."
    
    local lambda_dir="../lambda"
    local build_dir="./build"
    
    # 빌드 디렉토리 생성
    mkdir -p $build_dir
    
    # 각 Lambda 함수 패키징
    for lambda_function in recipe price combine orchestrator; do
        print_info "패키징: $lambda_function"
        
        local function_dir="$lambda_dir/$lambda_function"
        local zip_file="$build_dir/${lambda_function}.zip"
        
        if [ -d "$function_dir" ]; then
            # 기존 zip 파일 삭제
            rm -f $zip_file
            
            # 의존성 설치 및 패키징
            cd $function_dir
            
            # requirements.txt가 있으면 의존성 설치
            if [ -f "requirements.txt" ]; then
                pip install -r requirements.txt -t ./package
                cd package && zip -r "../../../infrastructure/$zip_file" . && cd ..
                zip -g "../../../infrastructure/$zip_file" *.py
                rm -rf package
            else
                zip -r "../../infrastructure/$zip_file" *.py
            fi
            
            cd - > /dev/null
            print_success "$lambda_function 패키징 완료"
        else
            print_warning "$function_dir 디렉토리가 존재하지 않습니다."
        fi
    done
}

# CloudFormation 템플릿 업로드
upload_templates() {
    local bucket_name=$1
    
    print_info "CloudFormation 템플릿 업로드 중..."
    
    # 중첩 템플릿 업로드
    aws s3 cp nested-templates/ "s3://$bucket_name/nested-templates/" \
        --recursive \
        --profile $AWS_PROFILE
    
    # Lambda 패키지 업로드
    aws s3 cp build/ "s3://$bucket_name/lambda/" \
        --recursive \
        --exclude "*" \
        --include "*.zip" \
        --profile $AWS_PROFILE
    
    print_success "템플릿 업로드 완료"
}

# CloudFormation 스택 배포
deploy_stack() {
    local bucket_name=$1
    
    print_info "CloudFormation 스택 배포 중..."
    
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}"
    local template_file="main-template.yaml"
    local params_file="parameters/${ENVIRONMENT}-params.json"
    
    # 파라미터 파일 존재 확인
    if [ ! -f "$params_file" ]; then
        print_error "파라미터 파일이 존재하지 않습니다: $params_file"
        exit 1
    fi
    
    # 스택 배포
    aws cloudformation deploy \
        --template-file $template_file \
        --stack-name $stack_name \
        --parameter-overrides file://$params_file \
        --capabilities CAPABILITY_NAMED_IAM \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --no-fail-on-empty-changeset
    
    if [ $? -eq 0 ]; then
        print_success "스택 배포 완료: $stack_name"
        
        # 스택 출력 표시
        print_info "스택 출력:"
        aws cloudformation describe-stacks \
            --stack-name $stack_name \
            --query 'Stacks[0].Outputs' \
            --output table \
            --region $AWS_REGION \
            --profile $AWS_PROFILE
    else
        print_error "스택 배포 실패"
        exit 1
    fi
}

# 배포 후 검증
validate_deployment() {
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}"
    
    print_info "배포 검증 중..."
    
    # 스택 상태 확인
    local stack_status=$(aws cloudformation describe-stacks \
        --stack-name $stack_name \
        --query 'Stacks[0].StackStatus' \
        --output text \
        --region $AWS_REGION \
        --profile $AWS_PROFILE)
    
    if [ "$stack_status" = "CREATE_COMPLETE" ] || [ "$stack_status" = "UPDATE_COMPLETE" ]; then
        print_success "스택 상태: $stack_status"
        
        # API 엔드포인트 테스트
        local api_endpoint=$(aws cloudformation describe-stacks \
            --stack-name $stack_name \
            --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
            --output text \
            --region $AWS_REGION \
            --profile $AWS_PROFILE)
        
        if [ ! -z "$api_endpoint" ]; then
            print_info "API 엔드포인트 테스트: $api_endpoint"
            
            # 헬스체크 엔드포인트 테스트
            if curl -s -f "$api_endpoint/health" > /dev/null; then
                print_success "API 엔드포인트 정상 작동"
            else
                print_warning "API 엔드포인트 응답 없음 (아직 준비 중일 수 있음)"
            fi
        fi
    else
        print_error "스택 상태 이상: $stack_status"
        exit 1
    fi
}

# 메인 실행 함수
main() {
    print_info "AI Chef 서버리스 배포 시작"
    print_info "환경: $ENVIRONMENT, 리전: $AWS_REGION, 프로필: $AWS_PROFILE"
    
    # 사전 요구사항 확인
    check_prerequisites
    
    # 배포 버킷 생성
    local bucket_name=$(create_deployment_bucket)
    
    # Lambda 패키지 빌드
    build_lambda_packages
    
    # 템플릿 업로드
    upload_templates $bucket_name
    
    # 스택 배포
    deploy_stack $bucket_name
    
    # 배포 검증
    validate_deployment
    
    print_success "배포 완료!"
    print_info "다음 명령어로 스택 상태를 확인할 수 있습니다:"
    print_info "aws cloudformation describe-stacks --stack-name ${PROJECT_NAME}-${ENVIRONMENT} --region $AWS_REGION --profile $AWS_PROFILE"
}

# 도움말 표시
show_help() {
    echo "사용법: $0 [ENVIRONMENT] [AWS_REGION] [AWS_PROFILE]"
    echo ""
    echo "매개변수:"
    echo "  ENVIRONMENT  배포 환경 (기본값: dev)"
    echo "  AWS_REGION   AWS 리전 (기본값: us-east-1)"
    echo "  AWS_PROFILE  AWS 프로필 (기본값: default)"
    echo ""
    echo "예시:"
    echo "  $0 dev us-east-1 default"
    echo "  $0 prod us-west-2 production"
}

# 명령행 인수 처리
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# 메인 함수 실행
main
```

## Lambda 패키징 스크립트 (build-lambdas.sh)
```bash
#!/bin/bash

set -e

print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

# Lambda 함수별 패키징
package_lambda() {
    local function_name=$1
    local source_dir="../lambda/$function_name"
    local build_dir="./build"
    local zip_file="$build_dir/${function_name}.zip"
    
    print_info "패키징: $function_name"
    
    if [ ! -d "$source_dir" ]; then
        echo "경고: $source_dir 디렉토리가 존재하지 않습니다."
        return 1
    fi
    
    # 빌드 디렉토리 생성
    mkdir -p $build_dir
    rm -f $zip_file
    
    # 임시 패키징 디렉토리 생성
    local temp_dir=$(mktemp -d)
    
    # 소스 코드 복사
    cp -r $source_dir/* $temp_dir/
    
    # requirements.txt가 있으면 의존성 설치
    if [ -f "$temp_dir/requirements.txt" ]; then
        print_info "의존성 설치: $function_name"
        pip install -r "$temp_dir/requirements.txt" -t $temp_dir/ --quiet
        rm "$temp_dir/requirements.txt"
    fi
    
    # ZIP 파일 생성
    cd $temp_dir
    zip -r "$OLDPWD/$zip_file" . -q
    cd - > /dev/null
    
    # 임시 디렉토리 정리
    rm -rf $temp_dir
    
    print_success "$function_name 패키징 완료: $zip_file"
}

# 모든 Lambda 함수 패키징
main() {
    print_info "Lambda 함수 패키징 시작"
    
    # Lambda 함수 목록
    local functions=("recipe" "price" "combine" "orchestrator")
    
    for func in "${functions[@]}"; do
        package_lambda $func
    done
    
    print_success "모든 Lambda 함수 패키징 완료"
    
    # 패키지 크기 확인
    print_info "패키지 크기:"
    ls -lh build/*.zip 2>/dev/null || echo "패키지 파일이 없습니다."
}

main
```

## 리소스 정리 스크립트 (cleanup.sh)
```bash
#!/bin/bash

set -e

PROJECT_NAME="ai-chef"
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
AWS_PROFILE=${3:-default}

print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

# 사용자 확인
confirm_cleanup() {
    echo ""
    print_warning "다음 리소스들이 삭제됩니다:"
    echo "  - CloudFormation 스택: ${PROJECT_NAME}-${ENVIRONMENT}"
    echo "  - S3 배포 버킷"
    echo "  - Lambda 함수들"
    echo "  - DynamoDB 테이블들"
    echo "  - OpenSearch 도메인"
    echo "  - Step Functions"
    echo ""
    
    read -p "정말로 삭제하시겠습니까? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_info "정리 작업이 취소되었습니다."
        exit 0
    fi
}

# S3 버킷 비우기 및 삭제
cleanup_s3_bucket() {
    local bucket_name="${PROJECT_NAME}-deployment-${ENVIRONMENT}-$(aws sts get-caller-identity --query Account --output text --profile $AWS_PROFILE)"
    
    print_info "S3 버킷 정리: $bucket_name"
    
    # 버킷 존재 확인
    if aws s3 ls "s3://$bucket_name" --profile $AWS_PROFILE 2>/dev/null; then
        # 버킷 비우기
        aws s3 rm "s3://$bucket_name" --recursive --profile $AWS_PROFILE
        
        # 버킷 삭제
        aws s3 rb "s3://$bucket_name" --profile $AWS_PROFILE
        
        print_success "S3 버킷 삭제 완료: $bucket_name"
    else
        print_info "S3 버킷이 존재하지 않습니다: $bucket_name"
    fi
}

# CloudFormation 스택 삭제
delete_cloudformation_stack() {
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}"
    
    print_info "CloudFormation 스택 삭제: $stack_name"
    
    # 스택 존재 확인
    if aws cloudformation describe-stacks --stack-name $stack_name --region $AWS_REGION --profile $AWS_PROFILE 2>/dev/null; then
        # 스택 삭제
        aws cloudformation delete-stack \
            --stack-name $stack_name \
            --region $AWS_REGION \
            --profile $AWS_PROFILE
        
        print_info "스택 삭제 진행 중... (완료까지 몇 분 소요)"
        
        # 삭제 완료 대기
        aws cloudformation wait stack-delete-complete \
            --stack-name $stack_name \
            --region $AWS_REGION \
            --profile $AWS_PROFILE
        
        print_success "CloudFormation 스택 삭제 완료: $stack_name"
    else
        print_info "CloudFormation 스택이 존재하지 않습니다: $stack_name"
    fi
}

# 남은 리소스 확인
check_remaining_resources() {
    print_info "남은 리소스 확인 중..."
    
    # Lambda 함수 확인
    local lambda_functions=$(aws lambda list-functions \
        --query "Functions[?starts_with(FunctionName, '${PROJECT_NAME}-')].FunctionName" \
        --output text \
        --region $AWS_REGION \
        --profile $AWS_PROFILE)
    
    if [ ! -z "$lambda_functions" ]; then
        print_warning "남은 Lambda 함수들:"
        echo "$lambda_functions"
    fi
    
    # DynamoDB 테이블 확인
    local dynamodb_tables=$(aws dynamodb list-tables \
        --query "TableNames[?starts_with(@, '${PROJECT_NAME}-')]" \
        --output text \
        --region $AWS_REGION \
        --profile $AWS_PROFILE)
    
    if [ ! -z "$dynamodb_tables" ]; then
        print_warning "남은 DynamoDB 테이블들:"
        echo "$dynamodb_tables"
    fi
    
    # CloudWatch 로그 그룹 확인
    local log_groups=$(aws logs describe-log-groups \
        --log-group-name-prefix "/aws/lambda/${PROJECT_NAME}-" \
        --query "logGroups[].logGroupName" \
        --output text \
        --region $AWS_REGION \
        --profile $AWS_PROFILE)
    
    if [ ! -z "$log_groups" ]; then
        print_warning "남은 CloudWatch 로그 그룹들:"
        echo "$log_groups"
        
        read -p "로그 그룹들을 삭제하시겠습니까? (y/n): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for log_group in $log_groups; do
                aws logs delete-log-group \
                    --log-group-name $log_group \
                    --region $AWS_REGION \
                    --profile $AWS_PROFILE
                print_info "로그 그룹 삭제: $log_group"
            done
        fi
    fi
}

# 메인 실행 함수
main() {
    print_info "AI Chef 리소스 정리 시작"
    print_info "환경: $ENVIRONMENT, 리전: $AWS_REGION, 프로필: $AWS_PROFILE"
    
    # 사용자 확인
    confirm_cleanup
    
    # CloudFormation 스택 삭제
    delete_cloudformation_stack
    
    # S3 버킷 정리
    cleanup_s3_bucket
    
    # 남은 리소스 확인
    check_remaining_resources
    
    print_success "리소스 정리 완료!"
}

# 도움말 표시
show_help() {
    echo "사용법: $0 [ENVIRONMENT] [AWS_REGION] [AWS_PROFILE]"
    echo ""
    echo "매개변수:"
    echo "  ENVIRONMENT  배포 환경 (기본값: dev)"
    echo "  AWS_REGION   AWS 리전 (기본값: us-east-1)"
    echo "  AWS_PROFILE  AWS 프로필 (기본값: default)"
    echo ""
    echo "예시:"
    echo "  $0 dev us-east-1 default"
    echo "  $0 prod us-west-2 production"
}

# 명령행 인수 처리
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# 메인 함수 실행
main
```

## 환경 설정 스크립트 (scripts/setup-env.sh)
```bash
#!/bin/bash

# 환경 변수 설정
setup_environment() {
    local env_file=".env.${1:-dev}"
    
    echo "환경 설정 파일 생성: $env_file"
    
    cat > $env_file << EOF
# AI Chef 환경 설정
PROJECT_NAME=ai-chef
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
AWS_PROFILE=${3:-default}

# Bedrock 설정
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# 네이버 API (실제 값으로 교체 필요)
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

# DynamoDB 설정
SESSIONS_TABLE_NAME=ai-chef-sessions-${1:-dev}
RESULTS_TABLE_NAME=ai-chef-results-${1:-dev}

# OpenSearch 설정
OPENSEARCH_ENDPOINT=https://search-ai-chef-nutrition-${1:-dev}.us-east-1.es.amazonaws.com
EOF

    echo "환경 설정 파일이 생성되었습니다: $env_file"
    echo "네이버 API 키를 실제 값으로 수정해주세요."
}

setup_environment $1 $2 $3
```

## 배포 명령어 예시

### 개발 환경 배포
```bash
# 권한 부여
chmod +x deploy.sh cleanup.sh build-lambdas.sh

# 개발 환경 배포
./deploy.sh dev us-east-1 default

# 또는 단계별 실행
./build-lambdas.sh
./deploy.sh dev
```

### 프로덕션 환경 배포
```bash
# 프로덕션 환경 배포
./deploy.sh prod us-west-2 production
```

### 리소스 정리
```bash
# 개발 환경 정리
./cleanup.sh dev

# 프로덕션 환경 정리
./cleanup.sh prod us-west-2 production
```

## 배포 전 체크리스트

### 1. 사전 준비
- [ ] AWS CLI 설치 및 설정
- [ ] Python 3.8+ 설치
- [ ] jq 설치 (JSON 처리용)
- [ ] 네이버 API 키 발급

### 2. 권한 확인
- [ ] CloudFormation 권한
- [ ] Lambda 권한
- [ ] DynamoDB 권한
- [ ] S3 권한
- [ ] Bedrock 권한

### 3. 설정 파일
- [ ] parameters/dev-params.json 작성
- [ ] parameters/prod-params.json 작성
- [ ] 네이버 API 키 설정

### 4. 배포 후 확인
- [ ] API 엔드포인트 테스트
- [ ] Lambda 함수 로그 확인
- [ ] DynamoDB 테이블 생성 확인
- [ ] Step Functions 실행 테스트
