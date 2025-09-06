# API Gateway 배포 가이드

## 개요

API Gateway는 **독립 배포 서비스**로 분류되어 전용 GitHub Actions 워크플로우로 관리됩니다.

## 아키텍처

### 독립 배포 구조
```
backend/infrastructure/
├── api-gateway-only.yaml        # CloudFormation 템플릿
└── deploy-api-gateway.sh        # 배포 스크립트

.github/workflows/
└── deploy-api-gateway.yml       # 전용 워크플로우
```

### 트리거 조건
```yaml
on:
  push:
    paths:
      - 'backend/infrastructure/api-gateway-only.yaml'
      - 'backend/infrastructure/deploy-api-gateway.sh'
      - '.github/workflows/deploy-api-gateway.yml'
  workflow_dispatch:
```

## CloudFormation 템플릿 구조

### 기본 구성 요소
```yaml
Resources:
  # API Gateway
  ApiGateway:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: 'ai-chef-api'
      Description: 'AI Chef API Gateway'

  # 리소스 정의
  {Resource}Resource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref ApiGateway
      ParentId: !GetAtt ApiGateway.RootResourceId
      PathPart: '{resource-name}'

  # 메서드 정의
  {Resource}{Method}Method:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref ApiGateway
      ResourceId: !Ref {Resource}Resource
      HttpMethod: POST
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:{lambda-function-name}/invocations'

  # CORS 지원
  {Resource}OptionsMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref ApiGateway
      ResourceId: !Ref {Resource}Resource
      HttpMethod: OPTIONS
      AuthorizationType: NONE
      Integration:
        Type: MOCK
        IntegrationResponses:
          - StatusCode: 200
            ResponseParameters:
              method.response.header.Access-Control-Allow-Origin: "'*'"
              method.response.header.Access-Control-Allow-Headers: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
              method.response.header.Access-Control-Allow-Methods: "'POST,OPTIONS'"

  # 배포
  ApiDeploymentProd:
    Type: AWS::ApiGateway::Deployment
    DependsOn:
      - {Resource}{Method}Method
      - {Resource}OptionsMethod
    Properties:
      RestApiId: !Ref ApiGateway
      StageName: 'prod'

  # Lambda 권한
  {Lambda}Permission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: '{lambda-function-name}'
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGateway}/*/*'

Outputs:
  ApiGatewayUrl:
    Description: 'API Gateway URL'
    Value: !Sub 'https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/prod'
    Export:
      Name: !Sub '${AWS::StackName}-ApiGatewayUrl'
```

## 배포 스크립트 구조

### deploy-api-gateway.sh 표준 패턴
```bash
#!/bin/bash
set -e

STACK_NAME="ai-chef-api-gateway"
REGION="us-east-1"

echo "🚀 Deploying AI Chef API Gateway..."

# 스택 상태 확인 및 복구
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if [ "$STACK_STATUS" = "ROLLBACK_COMPLETE" ]; then
  echo "⚠️  Stack is in ROLLBACK_COMPLETE state. Deleting and recreating..."
  aws cloudformation delete-stack --stack-name ${STACK_NAME} --region ${REGION}
  aws cloudformation wait stack-delete-complete --stack-name ${STACK_NAME} --region ${REGION}
fi

# CloudFormation 배포
aws cloudformation deploy \
  --template-file api-gateway-only.yaml \
  --stack-name ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# 강제 재배포 (중요!)
API_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text)

echo "🔄 Creating new API Gateway deployment..."
aws apigateway create-deployment \
  --rest-api-id ${API_GATEWAY_ID} \
  --stage-name prod \
  --description "Force deployment $(date)" \
  --region ${REGION}

echo "✅ API Gateway deployed successfully!"
```

## 강제 재배포의 중요성

### 문제점
CloudFormation의 `AWS::ApiGateway::Deployment`는 메서드나 리소스 변경 시 자동으로 새 배포를 생성하지 않습니다.

### 해결책
배포 스크립트에서 `aws apigateway create-deployment` 명령으로 강제로 새 배포를 생성합니다.

### 효과
- 변경사항이 즉시 prod 스테이지에 반영
- URL 변경 없이 투명한 업데이트
- 배포 일관성 보장

## 새로운 엔드포인트 추가 방법

### 1. 리소스 추가
```yaml
NewEndpointResource:
  Type: AWS::ApiGateway::Resource
  Properties:
    RestApiId: !Ref ApiGateway
    ParentId: !Ref ParentResource  # 또는 !GetAtt ApiGateway.RootResourceId
    PathPart: 'new-endpoint'
```

### 2. 메서드 추가
```yaml
NewEndpointPostMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    RestApiId: !Ref ApiGateway
    ResourceId: !Ref NewEndpointResource
    HttpMethod: POST
    AuthorizationType: NONE
    Integration:
      Type: AWS_PROXY
      IntegrationHttpMethod: POST
      Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:target-lambda-function/invocations'
```

### 3. CORS 메서드 추가
```yaml
NewEndpointOptionsMethod:
  Type: AWS::ApiGateway::Method
  # CORS 설정...
```

### 4. 배포 의존성 업데이트
```yaml
ApiDeploymentProd:
  DependsOn:
    - ExistingMethods...
    - NewEndpointPostMethod
    - NewEndpointOptionsMethod
```

### 5. Lambda 권한 추가
```yaml
NewLambdaPermission:
  Type: AWS::Lambda::Permission
  Properties:
    FunctionName: 'target-lambda-function'
    Action: lambda:InvokeFunction
    Principal: apigateway.amazonaws.com
    SourceArn: !Sub 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGateway}/*/*'
```

## 모니터링 및 로깅

### CloudWatch 설정
```yaml
ApiGatewayLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: '/aws/apigateway/ai-chef-api'
    RetentionInDays: 7

ApiGatewayErrorAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: 'AI-Chef-ApiGateway-Errors'
    MetricName: 'ThrottledRequests'
    Namespace: 'AWS/ApiGateway'
    Threshold: 5
```

## 베스트 프랙티스

### 1. 명명 규칙
- API 이름: `ai-chef-api`
- 스택명: `ai-chef-api-gateway`
- 리소스명: `{Resource}Resource`, `{Resource}{Method}Method`

### 2. CORS 설정
모든 엔드포인트에 OPTIONS 메서드 추가:
```yaml
ResponseParameters:
  method.response.header.Access-Control-Allow-Origin: "'*'"
  method.response.header.Access-Control-Allow-Headers: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
  method.response.header.Access-Control-Allow-Methods: "'POST,OPTIONS'"
```

### 3. 에러 처리
- 4xx/5xx 응답에 대한 적절한 CORS 헤더 설정
- 에러 응답 표준화

### 4. 보안 설정
- API 키 관리 (필요시)
- 요청 검증
- 스로틀링 설정

## 트러블슈팅

### 일반적인 문제들
1. **403 Forbidden**: Lambda 권한 확인
2. **404 Not Found**: 배포 상태 확인, 강제 재배포 실행
3. **CORS 에러**: OPTIONS 메서드 및 헤더 설정 확인
4. **Integration 에러**: Lambda 함수 존재 여부 확인

### 디버깅 방법
```bash
# API Gateway 리소스 확인
aws apigateway get-resources --rest-api-id {api-id}

# 배포 상태 확인
aws apigateway get-deployments --rest-api-id {api-id}

# 스테이지 확인
aws apigateway get-stage --rest-api-id {api-id} --stage-name prod
```
