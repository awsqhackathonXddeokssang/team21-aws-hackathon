# Step Functions 배포 가이드

## 개요

Step Functions는 **독립 배포 서비스**로 분류되어 API Gateway와 동일한 레벨에서 전용 GitHub Actions 워크플로우로 관리됩니다.

## 아키텍처

### 독립 배포 구조
```
backend/infrastructure/
├── step-functions.yaml          # CloudFormation 템플릿
└── deploy-stepfunctions.sh      # 배포 스크립트

.github/workflows/
└── deploy-stepfunctions.yml     # 전용 워크플로우
```

### 트리거 조건
```yaml
on:
  push:
    paths:
      - 'backend/infrastructure/step-functions.yaml'
      - 'backend/infrastructure/deploy-stepfunctions.sh'
      - '.github/workflows/deploy-stepfunctions.yml'
  workflow_dispatch:
```

## CloudFormation 템플릿 구조

### 기본 구성 요소
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Chef Step Functions Workflow'

Resources:
  # CloudWatch Log Group
  StepFunctionsLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: '/aws/stepfunctions/ai-chef-workflow'
      RetentionInDays: 7

  # IAM Role for Step Functions
  StepFunctionsRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: states.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: LambdaInvokePolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - lambda:InvokeFunction
                Resource: 
                  - !Sub 'arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:ai-chef-*'
        - PolicyName: DynamoDBAccessPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:GetItem
                  - dynamodb:PutItem
                  - dynamodb:UpdateItem
                Resource:
                  - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/ai-chef-*'

  # Step Functions State Machine
  AiChefWorkflow:
    Type: AWS::StepFunctions::StateMachine
    Properties:
      StateMachineName: 'ai-chef-recipe-workflow'
      RoleArn: !GetAtt StepFunctionsRole.Arn
      LoggingConfiguration:
        Level: ERROR
        IncludeExecutionData: true
        Destinations:
          - CloudWatchLogsLogGroup:
              LogGroupArn: !GetAtt StepFunctionsLogGroup.Arn
      DefinitionString: !Sub |
        {
          "Comment": "AI Chef Recipe Generation Workflow",
          "StartAt": "RecipeGeneration",
          "States": {
            "RecipeGeneration": {
              "Type": "Parallel",
              "Branches": [
                {
                  "StartAt": "GenerateRecipe",
                  "States": {
                    "GenerateRecipe": {
                      "Type": "Task",
                      "Resource": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:ai-chef-recipe",
                      "End": true
                    }
                  }
                },
                {
                  "StartAt": "GetPricing",
                  "States": {
                    "GetPricing": {
                      "Type": "Task",
                      "Resource": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:ai-chef-price",
                      "End": true
                    }
                  }
                }
              ],
              "Next": "CombineResults"
            },
            "CombineResults": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:ai-chef-combine",
              "End": true
            }
          }
        }

  # CloudWatch Alarm
  StepFunctionsErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: 'AI-Chef-StepFunctions-Errors'
      AlarmDescription: 'Error monitoring for Step Functions'
      MetricName: 'ExecutionsFailed'
      Namespace: 'AWS/States'
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      Dimensions:
        - Name: StateMachineArn
          Value: !Ref AiChefWorkflow

Outputs:
  StateMachineArn:
    Description: 'Step Functions State Machine ARN'
    Value: !Ref AiChefWorkflow
    Export:
      Name: !Sub '${AWS::StackName}-StateMachineArn'
```

## 배포 스크립트 구조

### deploy-stepfunctions.sh 표준 패턴
```bash
#!/bin/bash
set -e

STACK_NAME="ai-chef-stepfunctions"
REGION="us-east-1"

echo "🚀 Deploying AI Chef Step Functions..."

# 스택 상태 확인 및 복구
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "DOES_NOT_EXIST")

echo "📋 Current stack status: ${STACK_STATUS}"

if [ "$STACK_STATUS" = "ROLLBACK_COMPLETE" ]; then
  echo "⚠️  Stack is in ROLLBACK_COMPLETE state. Deleting and recreating..."
  aws cloudformation delete-stack --stack-name ${STACK_NAME} --region ${REGION}
  aws cloudformation wait stack-delete-complete --stack-name ${STACK_NAME} --region ${REGION}
  echo "✅ Stack deleted successfully"
fi

# CloudFormation 배포
echo "⚡ Deploying Step Functions..."
aws cloudformation deploy \
  --template-file step-functions.yaml \
  --stack-name ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

if [ $? -ne 0 ]; then
  echo "❌ CloudFormation deployment failed!"
  echo "📋 Stack events:"
  aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --region ${REGION} --max-items 10 || true
  exit 1
fi

echo "✅ Step Functions deployed successfully!"
echo "📊 Resources deployed:"
echo "  - ai-chef-recipe-workflow (State Machine)"
echo "  - CloudWatch monitoring"
echo "  - IAM roles and policies"
```

## GitHub Actions 워크플로우

### deploy-stepfunctions.yml 구조
```yaml
name: Deploy Step Functions

on:
  push:
    paths:
      - 'backend/infrastructure/step-functions.yaml'
      - 'backend/infrastructure/deploy-stepfunctions.sh'
      - '.github/workflows/deploy-stepfunctions.yml'
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "deploy" to confirm'
        required: true
        default: ''

jobs:
  deploy-stepfunctions:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' || github.event.inputs.confirm == 'deploy'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Deploy Step Functions
      run: |
        cd backend/infrastructure
        chmod +x deploy-stepfunctions.sh
        ./deploy-stepfunctions.sh
    
    - name: Discord Success Notification
      if: success()
      run: |
        curl -H "Content-Type: application/json" \
        -d '{
          "embeds": [{
            "title": "✅ Step Functions Deployed",
            "description": "AI Chef workflow deployed successfully",
            "color": 3066993,
            "fields": [
              {"name": "Resource", "value": "Step Functions", "inline": true},
              {"name": "Commit", "value": "${{ github.sha }}", "inline": true}
            ]
          }]
        }' \
        ${{ secrets.DISCORD_WEBHOOK_URL }}
    
    - name: Discord Failure Notification
      if: failure()
      run: |
        curl -H "Content-Type: application/json" \
        -d '{
          "embeds": [{
            "title": "❌ Step Functions Deployment Failed",
            "description": "Step Functions deployment failed",
            "color": 15158332,
            "fields": [
              {"name": "Resource", "value": "Step Functions", "inline": true},
              {"name": "Commit", "value": "${{ github.sha }}", "inline": true}
            ]
          }]
        }' \
        ${{ secrets.DISCORD_WEBHOOK_URL }}
```

## 워크플로우 정의 패턴

### 1. 순차 실행
```json
{
  "StartAt": "Step1",
  "States": {
    "Step1": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:function1",
      "Next": "Step2"
    },
    "Step2": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:account:function:function2",
      "End": true
    }
  }
}
```

### 2. 병렬 실행
```json
{
  "StartAt": "ParallelExecution",
  "States": {
    "ParallelExecution": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "Branch1",
          "States": {
            "Branch1": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:region:account:function:function1",
              "End": true
            }
          }
        },
        {
          "StartAt": "Branch2",
          "States": {
            "Branch2": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:region:account:function:function2",
              "End": true
            }
          }
        }
      ],
      "Next": "CombineResults"
    }
  }
}
```

### 3. 조건부 실행
```json
{
  "StartAt": "CheckCondition",
  "States": {
    "CheckCondition": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.condition",
          "StringEquals": "success",
          "Next": "SuccessPath"
        },
        {
          "Variable": "$.condition",
          "StringEquals": "error",
          "Next": "ErrorPath"
        }
      ],
      "Default": "DefaultPath"
    }
  }
}
```

## 모니터링 및 로깅

### CloudWatch 메트릭
- `ExecutionsStarted`: 실행 시작 횟수
- `ExecutionsSucceeded`: 성공한 실행 횟수
- `ExecutionsFailed`: 실패한 실행 횟수
- `ExecutionTime`: 실행 시간

### 로깅 설정
```yaml
LoggingConfiguration:
  Level: ERROR  # ALL, ERROR, FATAL, OFF
  IncludeExecutionData: true
  Destinations:
    - CloudWatchLogsLogGroup:
        LogGroupArn: !GetAtt StepFunctionsLogGroup.Arn
```

## 베스트 프랙티스

### 1. 명명 규칙
- State Machine: `ai-chef-{workflow-name}`
- 스택명: `ai-chef-stepfunctions`
- 로그 그룹: `/aws/stepfunctions/ai-chef-{workflow-name}`

### 2. 에러 처리
```json
{
  "Type": "Task",
  "Resource": "arn:aws:lambda:region:account:function:function-name",
  "Retry": [
    {
      "ErrorEquals": ["Lambda.ServiceException", "Lambda.AWSLambdaException"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ],
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "Next": "ErrorHandler"
    }
  ]
}
```

### 3. 타임아웃 설정
```json
{
  "Type": "Task",
  "Resource": "arn:aws:lambda:region:account:function:function-name",
  "TimeoutSeconds": 300
}
```

### 4. 입력/출력 처리
```json
{
  "Type": "Task",
  "Resource": "arn:aws:lambda:region:account:function:function-name",
  "InputPath": "$.input",
  "OutputPath": "$.output",
  "ResultPath": "$.result"
}
```

## 트러블슈팅

### 일반적인 문제들
1. **IAM 권한 부족**: Lambda 호출 권한 확인
2. **Lambda 함수 없음**: 함수 존재 여부 및 ARN 확인
3. **JSON 구문 오류**: 워크플로우 정의 검증
4. **타임아웃**: 각 단계별 타임아웃 설정 확인

### 디버깅 방법
```bash
# State Machine 목록 확인
aws stepfunctions list-state-machines

# 실행 히스토리 확인
aws stepfunctions list-executions --state-machine-arn {state-machine-arn}

# 실행 상세 정보 확인
aws stepfunctions describe-execution --execution-arn {execution-arn}
```
