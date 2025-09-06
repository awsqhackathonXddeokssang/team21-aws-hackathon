# DynamoDB 배포 가이드

## 개요

DynamoDB는 **독립 배포 서비스**로 분류되어 기반 인프라로서 전용 GitHub Actions 워크플로우로 관리됩니다.

## 아키텍처

### 독립 배포 구조
```
backend/infrastructure/
├── dynamodb-schema.yaml         # CloudFormation 템플릿
└── deploy-dynamodb.sh           # 배포 스크립트

.github/workflows/
└── deploy-dynamodb.yml          # 전용 워크플로우
```

### 트리거 조건
```yaml
on:
  push:
    paths:
      - 'backend/infrastructure/dynamodb-schema.yaml'
      - 'backend/infrastructure/deploy-dynamodb.sh'
      - '.github/workflows/deploy-dynamodb.yml'
  workflow_dispatch:
```

## CloudFormation 템플릿 구조

### 기본 구성 요소
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Chef DynamoDB Tables Schema'

Resources:
  # CloudWatch Log Group
  DynamoDBLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: '/aws/dynamodb/ai-chef-tables'
      RetentionInDays: 7

  # CloudWatch Alarm
  SessionsTableErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: 'AI-Chef-DynamoDB-SessionsTable-Errors'
      AlarmDescription: 'Error monitoring for Sessions DynamoDB Table'
      MetricName: 'ThrottledRequests'
      Namespace: 'AWS/DynamoDB'
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: TableName
          Value: !Ref AiChefSessionsTable
      TreatMissingData: notBreaching

  # Sessions Table
  AiChefSessionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: ai-chef-sessions
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: sessionId
          AttributeType: S
      KeySchema:
        - AttributeName: sessionId
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: TTL
        Enabled: true
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      Tags:
        - Key: Environment
          Value: production
        - Key: Service
          Value: ai-chef

  # Results Table
  AiChefResultsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: ai-chef-results
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: resultId
          AttributeType: S
        - AttributeName: sessionId
          AttributeType: S
      KeySchema:
        - AttributeName: resultId
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: sessionId-index
          KeySchema:
            - AttributeName: sessionId
              KeyType: HASH
          Projection:
            ProjectionType: ALL
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      Tags:
        - Key: Environment
          Value: production
        - Key: Service
          Value: ai-chef

Outputs:
  SessionsTableName:
    Description: 'Sessions table name'
    Value: !Ref AiChefSessionsTable
    Export:
      Name: !Sub '${AWS::StackName}-SessionsTable'

  ResultsTableName:
    Description: 'Results table name'
    Value: !Ref AiChefResultsTable
    Export:
      Name: !Sub '${AWS::StackName}-ResultsTable'

  SessionsTableArn:
    Description: 'Sessions table ARN'
    Value: !GetAtt AiChefSessionsTable.Arn
    Export:
      Name: !Sub '${AWS::StackName}-SessionsTableArn'

  ResultsTableArn:
    Description: 'Results table ARN'
    Value: !GetAtt AiChefResultsTable.Arn
    Export:
      Name: !Sub '${AWS::StackName}-ResultsTableArn'
```

## 배포 스크립트 구조

### deploy-dynamodb.sh 표준 패턴
```bash
#!/bin/bash
set -e

STACK_NAME="ai-chef-dynamodb"
REGION="us-east-1"

echo "🚀 Deploying AI Chef DynamoDB Tables..."

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
echo "🗄️  Deploying DynamoDB Tables..."
aws cloudformation deploy \
  --template-file dynamodb-schema.yaml \
  --stack-name ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

if [ $? -ne 0 ]; then
  echo "❌ CloudFormation deployment failed!"
  echo "📋 Stack events:"
  aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --region ${REGION} --max-items 10 || true
  exit 1
fi

echo "✅ DynamoDB Tables deployed successfully!"
echo "📊 Resources deployed:"
echo "  - ai-chef-sessions (DynamoDB Table)"
echo "  - ai-chef-results (DynamoDB Table)"
echo "  - CloudWatch monitoring"
```

## 테이블 설계 패턴

### 1. 기본 테이블 구조
```yaml
TableName: ai-chef-{table-name}
BillingMode: PAY_PER_REQUEST  # 비용 최적화
AttributeDefinitions:
  - AttributeName: {primary-key}
    AttributeType: S  # String
KeySchema:
  - AttributeName: {primary-key}
    KeyType: HASH
```

### 2. GSI (Global Secondary Index)
```yaml
GlobalSecondaryIndexes:
  - IndexName: {attribute}-index
    KeySchema:
      - AttributeName: {attribute}
        KeyType: HASH
    Projection:
      ProjectionType: ALL  # 또는 KEYS_ONLY, INCLUDE
```

### 3. TTL (Time To Live) 설정
```yaml
TimeToLiveSpecification:
  AttributeName: TTL
  Enabled: true
```

### 4. 백업 설정
```yaml
PointInTimeRecoverySpecification:
  PointInTimeRecoveryEnabled: true
```

## 데이터 모델링 베스트 프랙티스

### 1. 파티션 키 설계
- **고유성**: 각 항목이 고유한 파티션 키를 가져야 함
- **분산성**: 핫 파티션 방지를 위한 균등 분산
- **예측 가능성**: 쿼리 패턴에 맞는 키 설계

### 2. 정렬 키 활용
```yaml
KeySchema:
  - AttributeName: PK
    KeyType: HASH
  - AttributeName: SK
    KeyType: RANGE
```

### 3. 속성 명명 규칙
- **camelCase** 사용: `sessionId`, `createdAt`
- **예약어 피하기**: `status` → `sessionStatus`
- **일관성 유지**: 동일한 의미의 속성은 동일한 이름 사용

## 새로운 테이블 추가 방법

### 1. CloudFormation 템플릿에 추가
```yaml
NewTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: ai-chef-new-table
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: id
        AttributeType: S
    KeySchema:
      - AttributeName: id
        KeyType: HASH
    Tags:
      - Key: Environment
        Value: production
      - Key: Service
        Value: ai-chef
```

### 2. CloudWatch 알람 추가
```yaml
NewTableErrorAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: 'AI-Chef-DynamoDB-NewTable-Errors'
    MetricName: 'ThrottledRequests'
    Dimensions:
      - Name: TableName
        Value: !Ref NewTable
```

### 3. 출력값 추가
```yaml
Outputs:
  NewTableName:
    Description: 'New table name'
    Value: !Ref NewTable
    Export:
      Name: !Sub '${AWS::StackName}-NewTable'
```

## 모니터링 및 알람

### 주요 메트릭
- `ConsumedReadCapacityUnits`: 읽기 용량 사용량
- `ConsumedWriteCapacityUnits`: 쓰기 용량 사용량
- `ThrottledRequests`: 스로틀된 요청 수
- `SystemErrors`: 시스템 에러 수

### 알람 설정
```yaml
ThrottleAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: 'DynamoDB-Throttle-Alarm'
    MetricName: 'ThrottledRequests'
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    EvaluationPeriods: 1
    Period: 300
```

## 보안 설정

### 1. IAM 정책 예시
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:region:account:table/ai-chef-*"
    }
  ]
}
```

### 2. 리소스 기반 정책
```yaml
ResourcePolicy:
  Type: AWS::DynamoDB::ResourcePolicy
  Properties:
    TableName: !Ref TableName
    PolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:role/lambda-execution-role'
          Action:
            - dynamodb:GetItem
            - dynamodb:PutItem
          Resource: !GetAtt TableName.Arn
```

## 비용 최적화

### 1. 빌링 모드 선택
- **PAY_PER_REQUEST**: 예측 불가능한 워크로드
- **PROVISIONED**: 예측 가능한 워크로드

### 2. 테이블 클래스
```yaml
TableClass: STANDARD_INFREQUENT_ACCESS  # 비용 절약
```

### 3. TTL 활용
```yaml
TimeToLiveSpecification:
  AttributeName: expiresAt
  Enabled: true
```

## 트러블슈팅

### 일반적인 문제들
1. **스로틀링**: 읽기/쓰기 용량 부족
2. **핫 파티션**: 파티션 키 분산 불균형
3. **GSI 스로틀링**: 인덱스 용량 부족
4. **비용 급증**: 예상치 못한 트래픽 증가

### 디버깅 방법
```bash
# 테이블 상태 확인
aws dynamodb describe-table --table-name ai-chef-sessions

# 메트릭 확인
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=ai-chef-sessions \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-01T01:00:00Z \
  --period 300 \
  --statistics Sum

# 백업 확인
aws dynamodb list-backups --table-name ai-chef-sessions
```

## 데이터 마이그레이션

### 1. 스키마 변경
- 새 속성 추가: 기존 항목에 영향 없음
- 속성 제거: 애플리케이션 레벨에서 처리
- 키 변경: 새 테이블 생성 후 마이그레이션

### 2. 마이그레이션 스크립트 예시
```python
import boto3

def migrate_data():
    dynamodb = boto3.resource('dynamodb')
    old_table = dynamodb.Table('old-table')
    new_table = dynamodb.Table('new-table')
    
    # 스캔 및 마이그레이션
    response = old_table.scan()
    for item in response['Items']:
        # 데이터 변환
        transformed_item = transform_item(item)
        new_table.put_item(Item=transformed_item)
```
