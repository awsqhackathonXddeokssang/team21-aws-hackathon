# Lambda 서비스 배포 가이드

## 개요

모든 Lambda 함수는 **통합 배포 방식**을 사용하여 `deploy-backend.yml` 워크플로우에서 관리됩니다.

## 아키텍처

### 통합 배포 구조
```
backend/infrastructure/
├── session-create-lambda.yaml
├── session-update-lambda.yaml
├── recipe-lambda.yaml
├── price-lambda.yaml
├── combine-lambda.yaml
├── image-generator-lambda.yaml
├── nutrition-calculator-lambda.yaml
└── deploy.sh                    # 통합 배포 스크립트

.github/workflows/
└── deploy-backend.yml           # 단일 워크플로우
```

### 트리거 조건
```yaml
on:
  push:
    paths:
      - 'backend/infrastructure/*-lambda.yaml'
      - 'backend/infrastructure/deploy.sh'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch:
```

## Lambda 함수 표준 구조

### CloudFormation 템플릿 구조
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Chef {Function Name} Lambda Function'

Resources:
  # CloudWatch Log Group
  {FunctionName}LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: '/aws/lambda/ai-chef-{function-name}'
      RetentionInDays: 7

  # CloudWatch Alarm
  {FunctionName}ErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: 'AI-Chef-{FunctionName}-Errors'
      MetricName: 'Errors'
      Threshold: 3

  # IAM Role
  {FunctionName}LambdaRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: DynamoDBAccess
        - PolicyName: BedrockAccess  # 필요시
        - PolicyName: CloudWatchLogsAccess

  # Lambda Function
  {FunctionName}Lambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: 'ai-chef-{function-name}'
      Runtime: nodejs18.x  # 또는 python3.11
      Handler: index.handler
      Role: !GetAtt {FunctionName}LambdaRole.Arn
      Timeout: 30
      MemorySize: 256
      Environment:
        Variables:
          SESSIONS_TABLE_NAME: 'ai-chef-sessions'
      Code:
        ZipFile: |
          # 인라인 코드 또는 S3 참조

  # API Gateway Permission
  {FunctionName}LambdaPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref {FunctionName}Lambda
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com

Outputs:
  {FunctionName}LambdaArn:
    Description: '{Function Name} Lambda Function ARN'
    Value: !GetAtt {FunctionName}Lambda.Arn
    Export:
      Name: !Sub '${AWS::StackName}-{FunctionName}LambdaArn'
```

## 배포 스크립트 구조

### deploy.sh 표준 패턴
```bash
#!/bin/bash
set -e
REGION="us-east-1"

echo "🚀 Deploying AI Chef Lambda Functions..."

# 각 Lambda 함수 순차 배포
deploy_lambda() {
  local template_file=$1
  local stack_name=$2
  local function_name=$3
  
  echo "🔑 Deploying ${function_name}..."
  aws cloudformation deploy \
    --template-file ${template_file} \
    --stack-name ${stack_name} \
    --capabilities CAPABILITY_IAM \
    --region ${REGION}
}

# Lambda 함수들 배포
deploy_lambda "session-create-lambda.yaml" "ai-chef-session-create-lambda" "Session Create"
deploy_lambda "session-update-lambda.yaml" "ai-chef-session-update-lambda" "Session Update"
# 추가 Lambda 함수들...

echo "✅ Lambda Functions deployed successfully!"
```

## 새로운 Lambda 함수 추가 방법

### 1. CloudFormation 템플릿 생성
```bash
# 파일명: {function-name}-lambda.yaml
cp session-create-lambda.yaml new-function-lambda.yaml
# 템플릿 내용 수정
```

### 2. deploy.sh에 추가
```bash
# deploy.sh 파일에 새 함수 추가
deploy_lambda "new-function-lambda.yaml" "ai-chef-new-function-lambda" "New Function"
```

### 3. 트리거 조건 확인
GitHub Actions가 새 파일을 감지하도록 트리거 조건이 `*-lambda.yaml` 패턴을 사용하므로 자동으로 포함됩니다.

## 모니터링 및 로깅

### CloudWatch 로그
- 로그 그룹: `/aws/lambda/ai-chef-{function-name}`
- 보존 기간: 7일 (비용 최적화)

### CloudWatch 알람
- 에러 임계값: 3개 이상
- 평가 주기: 5분
- 누락 데이터: notBreaching

### Discord 알림
배포 성공/실패 시 자동 알림 발송

## 베스트 프랙티스

### 1. 함수명 규칙
- CloudFormation: `ai-chef-{function-name}`
- 스택명: `ai-chef-{function-name}-lambda`

### 2. 환경변수 표준화
```yaml
Environment:
  Variables:
    SESSIONS_TABLE_NAME: 'ai-chef-sessions'
    RESULTS_TABLE_NAME: 'ai-chef-results'
    AWS_REGION: !Ref AWS::Region
```

### 3. 에러 처리
모든 Lambda 함수는 표준화된 에러 응답 구조 사용:
```javascript
return {
  statusCode: 500,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify({
    error: '에러 메시지'
  })
};
```

### 4. 보안 설정
- 최소 권한 원칙 적용
- 환경변수로 민감 정보 관리
- VPC 설정 (필요시)

## 트러블슈팅

### 일반적인 문제들
1. **IAM 권한 부족**: 정책 확인 및 수정
2. **타임아웃 에러**: 메모리/타임아웃 설정 조정
3. **환경변수 누락**: CloudFormation 템플릿 확인
4. **DependsOn 순서**: 리소스 의존성 검토

### 로그 확인 방법
```bash
aws logs describe-log-streams --log-group-name "/aws/lambda/ai-chef-{function-name}"
aws logs get-log-events --log-group-name "/aws/lambda/ai-chef-{function-name}" --log-stream-name "{stream-name}"
```
