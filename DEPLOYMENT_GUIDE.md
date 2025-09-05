# 🚨 배포 가이드 - 삽질 방지용

## ⚠️ 절대 실수하지 말 것들

### 1. API Gateway Stage는 필수다!
```yaml
# ❌ 절대 이렇게 하지 마라
ApiDeployment:
  Type: AWS::ApiGateway::Deployment
  Properties:
    RestApiId: !Ref ApiGateway
    # StageName 없으면 403 Forbidden 에러

# ✅ 반드시 이렇게 해야 함
ApiDeployment:
  Type: AWS::ApiGateway::Deployment
  Properties:
    RestApiId: !Ref ApiGateway
    StageName: prod  # 이게 없으면 API Gateway 작동 안함
```

**결과**: Stage 없으면 엔드포인트가 활성화되지 않아서 403 에러 발생

### 2. Lambda Handler 경로 주의
```yaml
# ❌ ZipFile 사용 시 이렇게 하면 에러
SessionLambda:
  Type: AWS::Lambda::Function
  Properties:
    Handler: lambda_function.lambda_handler  # 파일이 없어서 에러
    Code:
      ZipFile: |
        import json
        def lambda_handler(event, context):
          # 코드

# ✅ ZipFile 사용 시 반드시 index로
SessionLambda:
  Type: AWS::Lambda::Function
  Properties:
    Handler: index.lambda_handler  # ZipFile은 index여야 함
    Code:
      ZipFile: |
        import json
        def lambda_handler(event, context):
          # 코드
```

### 3. CloudFormation Deployment 이름 변경 시 주의
```yaml
# ❌ 기존 Deployment에 StageName 추가하면 AWS 내부 에러
ApiDeployment:  # 기존 이름 그대로 사용하면 에러
  Properties:
    StageName: prod  # 추가하면 실패

# ✅ 새로운 이름으로 Deployment 생성
ApiDeploymentProd:  # 이름 변경해서 새로 생성
  Properties:
    StageName: prod
```

### 4. GitHub Actions 에러 처리 필수
```bash
#!/bin/bash
# ❌ 에러 처리 없으면 실패해도 성공으로 표시됨
aws cloudformation deploy --template-file session-api.yaml

# ✅ 반드시 에러 처리 추가
#!/bin/bash
set -e  # 에러 발생 시 즉시 종료

aws cloudformation deploy --template-file session-api.yaml
if [ $? -ne 0 ]; then
  echo "❌ CloudFormation deployment failed!"
  aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --max-items 10
  exit 1
fi
```

## 🔄 배포 프로세스 (GitHub Actions 필수)

### 절대 수동 배포 금지!
```bash
# ❌ 절대 이렇게 하지 마라
cd backend/infrastructure
aws cloudformation deploy --template-file session-api.yaml --stack-name ai-chef-session-api

# ✅ 반드시 GitHub Actions 사용
git add .
git commit -m "Update infrastructure"
git push  # 이것만 하면 자동 배포됨
```

### GitHub Actions 배포 확인 방법
```bash
# 1. 배포 상태 확인
gh run list --limit 2

# 2. 실패 시 로그 확인
gh run view --log [RUN_ID]

# 3. AWS 스택 상태 확인
aws cloudformation describe-stacks --stack-name ai-chef-session-api --region us-east-1

# 4. API 테스트
curl -X POST https://68k4rbx0g4.execute-api.us-east-1.amazonaws.com/prod/sessions \
  -H "Content-Type: application/json" -d "{}"
```

## 🐛 문제 해결 순서

### 1. 403 Forbidden 에러
```bash
# Stage 확인
aws apigateway get-stages --rest-api-id [API_ID] --region us-east-1

# Stage가 비어있으면 StageName 추가 필요
```

### 2. 502 Internal Server Error
```bash
# Lambda 로그 확인
aws logs describe-log-streams --log-group-name "/aws/lambda/ai-chef-session-api" --limit 1 --descending --order-by LastEventTime --region us-east-1

# 최신 로그 확인
aws logs get-log-events --log-group-name "/aws/lambda/ai-chef-session-api" --log-stream-name "[STREAM_NAME]" --region us-east-1
```

### 3. CloudFormation 실패
```bash
# 스택 이벤트 확인
aws cloudformation describe-stack-events --stack-name ai-chef-session-api --max-items 10 --region us-east-1

# 실패한 리소스 확인
aws cloudformation describe-stack-resources --stack-name ai-chef-session-api --region us-east-1
```

## 📋 체크리스트

### 배포 전 확인사항
- [ ] `StageName: prod` 설정되어 있는가?
- [ ] Lambda Handler가 `index.lambda_handler`인가?
- [ ] 배포 스크립트에 `set -e` 있는가?
- [ ] GitHub Actions로 배포하는가? (수동 배포 금지)

### 배포 후 확인사항
- [ ] GitHub Actions 성공했는가?
- [ ] CloudFormation 스택 상태가 `UPDATE_COMPLETE`인가?
- [ ] API Gateway Stage가 생성되었는가?
- [ ] API 엔드포인트 테스트 성공하는가?

## 🚨 삽질 기록 (절대 반복하지 말 것)

### 총 삽질 시간: 2시간
1. **API Gateway Stage 문제** (30분) - Stage 없이 배포
2. **CloudFormation Deployment 충돌** (15분) - 기존 리소스 수정 시도
3. **Lambda Handler 오류** (10분) - 잘못된 Handler 경로
4. **GitHub Actions 에러 처리** (20분) - 실패를 성공으로 오인
5. **수동 vs 자동 배포 혼재** (15분) - 일관성 없는 배포 방식
6. **기타 시행착오** (30분) - 근본 원인 파악 지연

### 교훈
- AWS 기본 개념 숙지 필수
- 에러 로그 먼저 확인
- 자동화 우선, 수동 작업 최소화
- 체계적 접근 필요

## 🎯 현재 배포된 리소스

### API Gateway
- **ID**: `68k4rbx0g4`
- **이름**: `ai-chef-api`
- **URL**: `https://68k4rbx0g4.execute-api.us-east-1.amazonaws.com/prod`
- **Stage**: `prod`

### Lambda
- **함수명**: `ai-chef-session-api`
- **Runtime**: `python3.11`
- **Handler**: `index.lambda_handler`

### 엔드포인트
- `POST /sessions` - 세션 생성
- `GET /sessions` - 세션 목록
- `POST /session/{id}/process` - 세션 처리

---

**⚠️ 이 가이드를 무시하고 삽질하면 2시간 날린다. 반드시 따라할 것!**
