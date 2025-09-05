# CloudFormation 템플릿 구현

## 개요
AI Chef 서버리스 아키텍처를 위한 AWS CloudFormation 템플릿

## 템플릿 구조
```
backend/infrastructure/
├── main-template.yaml          # 메인 CloudFormation 템플릿
├── nested-templates/
│   ├── lambda-functions.yaml   # Lambda 함수들
│   ├── step-functions.yaml     # Step Functions 워크플로우
│   ├── dynamodb.yaml          # DynamoDB 테이블들
│   ├── opensearch.yaml        # OpenSearch 도메인
│   └── api-gateway.yaml       # API Gateway
└── parameters/
    ├── dev-params.json        # 개발 환경 파라미터
    └── prod-params.json       # 프로덕션 환경 파라미터
```

## 메인 템플릿 (main-template.yaml)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Chef - 맞춤형 레시피 추천 서비스 인프라'

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, prod]
    Description: 배포 환경
  
  ProjectName:
    Type: String
    Default: ai-chef
    Description: 프로젝트 이름
  
  NaverClientId:
    Type: String
    NoEcho: true
    Description: 네이버 API 클라이언트 ID
  
  NaverClientSecret:
    Type: String
    NoEcho: true
    Description: 네이버 API 클라이언트 시크릿

Mappings:
  EnvironmentMap:
    dev:
      LambdaMemorySize: 512
      DynamoDBBillingMode: PAY_PER_REQUEST
      OpenSearchInstanceType: t3.small.search
    prod:
      LambdaMemorySize: 1024
      DynamoDBBillingMode: PROVISIONED
      OpenSearchInstanceType: t3.medium.search

Resources:
  # S3 버킷 (Lambda 배포 패키지용)
  DeploymentBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '${ProjectName}-deployment-${Environment}-${AWS::AccountId}'
      VersioningConfiguration:
        Status: Enabled
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  # DynamoDB 테이블들
  DynamoDBStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: !Sub 'https://${DeploymentBucket}.s3.amazonaws.com/nested-templates/dynamodb.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        BillingMode: !FindInMap [EnvironmentMap, !Ref Environment, DynamoDBBillingMode]

  # OpenSearch 도메인
  OpenSearchStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: !Sub 'https://${DeploymentBucket}.s3.amazonaws.com/nested-templates/opensearch.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        InstanceType: !FindInMap [EnvironmentMap, !Ref Environment, OpenSearchInstanceType]

  # Lambda 함수들
  LambdaStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: [DynamoDBStack, OpenSearchStack]
    Properties:
      TemplateURL: !Sub 'https://${DeploymentBucket}.s3.amazonaws.com/nested-templates/lambda-functions.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        MemorySize: !FindInMap [EnvironmentMap, !Ref Environment, LambdaMemorySize]
        SessionsTableName: !GetAtt DynamoDBStack.Outputs.SessionsTableName
        ResultsTableName: !GetAtt DynamoDBStack.Outputs.ResultsTableName
        OpenSearchEndpoint: !GetAtt OpenSearchStack.Outputs.DomainEndpoint
        NaverClientId: !Ref NaverClientId
        NaverClientSecret: !Ref NaverClientSecret

  # Step Functions
  StepFunctionsStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: LambdaStack
    Properties:
      TemplateURL: !Sub 'https://${DeploymentBucket}.s3.amazonaws.com/nested-templates/step-functions.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        RecipeLambdaArn: !GetAtt LambdaStack.Outputs.RecipeLambdaArn
        PriceLambdaArn: !GetAtt LambdaStack.Outputs.PriceLambdaArn
        CombineLambdaArn: !GetAtt LambdaStack.Outputs.CombineLambdaArn

  # API Gateway
  ApiGatewayStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: StepFunctionsStack
    Properties:
      TemplateURL: !Sub 'https://${DeploymentBucket}.s3.amazonaws.com/nested-templates/api-gateway.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        StepFunctionArn: !GetAtt StepFunctionsStack.Outputs.StateMachineArn

Outputs:
  ApiEndpoint:
    Description: API Gateway 엔드포인트
    Value: !GetAtt ApiGatewayStack.Outputs.ApiEndpoint
    Export:
      Name: !Sub '${ProjectName}-${Environment}-api-endpoint'
```

## Lambda 함수 템플릿 (nested-templates/lambda-functions.yaml)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Chef Lambda Functions'

Parameters:
  ProjectName:
    Type: String
  Environment:
    Type: String
  MemorySize:
    Type: Number
  SessionsTableName:
    Type: String
  ResultsTableName:
    Type: String
  OpenSearchEndpoint:
    Type: String
  NaverClientId:
    Type: String
    NoEcho: true
  NaverClientSecret:
    Type: String
    NoEcho: true

Resources:
  # Lambda 실행 역할
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '${ProjectName}-lambda-execution-role-${Environment}'
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
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:GetItem
                  - dynamodb:PutItem
                  - dynamodb:UpdateItem
                  - dynamodb:DeleteItem
                  - dynamodb:Query
                  - dynamodb:Scan
                Resource:
                  - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${SessionsTableName}'
                  - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${ResultsTableName}'
        - PolicyName: BedrockAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - bedrock:InvokeModel
                Resource:
                  - !Sub 'arn:aws:bedrock:${AWS::Region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0'
                  - !Sub 'arn:aws:bedrock:${AWS::Region}::foundation-model/amazon.titan-embed-text-v1'
        - PolicyName: OpenSearchAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - es:ESHttpPost
                  - es:ESHttpGet
                Resource: !Sub 'arn:aws:es:${AWS::Region}:${AWS::AccountId}:domain/*'

  # Recipe Lambda
  RecipeLambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${ProjectName}-recipe-${Environment}'
      Runtime: python3.11
      Handler: lambda_function.lambda_handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        S3Bucket: !Sub '${ProjectName}-deployment-${Environment}-${AWS::AccountId}'
        S3Key: lambda/recipe.zip
      MemorySize: !Ref MemorySize
      Timeout: 120
      Environment:
        Variables:
          BEDROCK_REGION: !Ref AWS::Region
          OPENSEARCH_ENDPOINT: !Ref OpenSearchEndpoint
          SESSIONS_TABLE: !Ref SessionsTableName
          RESULTS_TABLE: !Ref ResultsTableName
          ENVIRONMENT: !Ref Environment

  # Price Lambda
  PriceLambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${ProjectName}-price-${Environment}'
      Runtime: python3.11
      Handler: lambda_function.lambda_handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        S3Bucket: !Sub '${ProjectName}-deployment-${Environment}-${AWS::AccountId}'
        S3Key: lambda/price.zip
      MemorySize: !Ref MemorySize
      Timeout: 60
      Environment:
        Variables:
          NAVER_CLIENT_ID: !Ref NaverClientId
          NAVER_CLIENT_SECRET: !Ref NaverClientSecret
          SESSIONS_TABLE: !Ref SessionsTableName
          ENVIRONMENT: !Ref Environment

  # Combine Lambda
  CombineLambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${ProjectName}-combine-${Environment}'
      Runtime: python3.11
      Handler: lambda_function.lambda_handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        S3Bucket: !Sub '${ProjectName}-deployment-${Environment}-${AWS::AccountId}'
        S3Key: lambda/combine.zip
      MemorySize: 256
      Timeout: 30
      Environment:
        Variables:
          SESSIONS_TABLE: !Ref SessionsTableName
          RESULTS_TABLE: !Ref ResultsTableName
          ENVIRONMENT: !Ref Environment

  # Orchestrator Lambda
  OrchestratorLambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${ProjectName}-orchestrator-${Environment}'
      Runtime: python3.11
      Handler: lambda_function.lambda_handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        S3Bucket: !Sub '${ProjectName}-deployment-${Environment}-${AWS::AccountId}'
        S3Key: lambda/orchestrator.zip
      MemorySize: 256
      Timeout: 30
      Environment:
        Variables:
          SESSIONS_TABLE: !Ref SessionsTableName
          STATE_MACHINE_ARN: !Sub 'arn:aws:states:${AWS::Region}:${AWS::AccountId}:stateMachine:${ProjectName}-workflow-${Environment}'
          ENVIRONMENT: !Ref Environment

Outputs:
  RecipeLambdaArn:
    Description: Recipe Lambda ARN
    Value: !GetAtt RecipeLambda.Arn
  
  PriceLambdaArn:
    Description: Price Lambda ARN
    Value: !GetAtt PriceLambda.Arn
  
  CombineLambdaArn:
    Description: Combine Lambda ARN
    Value: !GetAtt CombineLambda.Arn
  
  OrchestratorLambdaArn:
    Description: Orchestrator Lambda ARN
    Value: !GetAtt OrchestratorLambda.Arn
```

## DynamoDB 템플릿 (nested-templates/dynamodb.yaml)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Chef DynamoDB Tables'

Parameters:
  ProjectName:
    Type: String
  Environment:
    Type: String
  BillingMode:
    Type: String
    Default: PAY_PER_REQUEST

Resources:
  # 세션 관리 테이블
  SessionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub '${ProjectName}-sessions-${Environment}'
      BillingMode: !Ref BillingMode
      AttributeDefinitions:
        - AttributeName: sessionId
          AttributeType: S
        - AttributeName: userId
          AttributeType: S
      KeySchema:
        - AttributeName: sessionId
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: UserIdIndex
          KeySchema:
            - AttributeName: userId
              KeyType: HASH
          Projection:
            ProjectionType: ALL
          ProvisionedThroughput:
            ReadCapacityUnits: !If [IsPayPerRequest, !Ref 'AWS::NoValue', 5]
            WriteCapacityUnits: !If [IsPayPerRequest, !Ref 'AWS::NoValue', 5]
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
      ProvisionedThroughput:
        ReadCapacityUnits: !If [IsPayPerRequest, !Ref 'AWS::NoValue', 10]
        WriteCapacityUnits: !If [IsPayPerRequest, !Ref 'AWS::NoValue', 10]

  # 결과 저장 테이블
  ResultsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub '${ProjectName}-results-${Environment}'
      BillingMode: !Ref BillingMode
      AttributeDefinitions:
        - AttributeName: sessionId
          AttributeType: S
        - AttributeName: createdAt
          AttributeType: S
      KeySchema:
        - AttributeName: sessionId
          KeyType: HASH
        - AttributeName: createdAt
          KeyType: RANGE
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
      ProvisionedThroughput:
        ReadCapacityUnits: !If [IsPayPerRequest, !Ref 'AWS::NoValue', 5]
        WriteCapacityUnits: !If [IsPayPerRequest, !Ref 'AWS::NoValue', 5]

Conditions:
  IsPayPerRequest: !Equals [!Ref BillingMode, PAY_PER_REQUEST]

Outputs:
  SessionsTableName:
    Description: Sessions Table Name
    Value: !Ref SessionsTable
  
  ResultsTableName:
    Description: Results Table Name
    Value: !Ref ResultsTable
  
  SessionsTableArn:
    Description: Sessions Table ARN
    Value: !GetAtt SessionsTable.Arn
  
  ResultsTableArn:
    Description: Results Table ARN
    Value: !GetAtt ResultsTable.Arn
```

## OpenSearch 템플릿 (nested-templates/opensearch.yaml)
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Chef OpenSearch Domain for Nutrition RAG'

Parameters:
  ProjectName:
    Type: String
  Environment:
    Type: String
  InstanceType:
    Type: String
    Default: t3.small.search

Resources:
  # OpenSearch 도메인
  NutritionSearchDomain:
    Type: AWS::OpenSearch::Domain
    Properties:
      DomainName: !Sub '${ProjectName}-nutrition-${Environment}'
      EngineVersion: 'OpenSearch_2.3'
      ClusterConfig:
        InstanceType: !Ref InstanceType
        InstanceCount: 1
        DedicatedMasterEnabled: false
      EBSOptions:
        EBSEnabled: true
        VolumeType: gp3
        VolumeSize: 20
      AccessPolicies:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
            Action: 'es:*'
            Resource: !Sub 'arn:aws:es:${AWS::Region}:${AWS::AccountId}:domain/${ProjectName}-nutrition-${Environment}/*'
      DomainEndpointOptions:
        EnforceHTTPS: true
        TLSSecurityPolicy: 'Policy-Min-TLS-1-2-2019-07'
      NodeToNodeEncryptionOptions:
        Enabled: true
      EncryptionAtRestOptions:
        Enabled: true
      AdvancedSecurityOptions:
        Enabled: true
        InternalUserDatabaseEnabled: false
        MasterUserOptions:
          MasterUserARN: !Sub 'arn:aws:iam::${AWS::AccountId}:root'

  # OpenSearch 인덱스 초기화 Lambda
  IndexInitializerLambda:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${ProjectName}-index-initializer-${Environment}'
      Runtime: python3.11
      Handler: index.handler
      Role: !GetAtt IndexInitializerRole.Arn
      Code:
        ZipFile: |
          import json
          import boto3
          import cfnresponse
          from opensearchpy import OpenSearch, RequestsHttpConnection
          from aws_requests_auth.aws_auth import AWSRequestsAuth
          
          def handler(event, context):
              try:
                  if event['RequestType'] == 'Create':
                      # OpenSearch 인덱스 생성
                      create_nutrition_index(event['ResourceProperties']['DomainEndpoint'])
                  
                  cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
              except Exception as e:
                  print(f"Error: {e}")
                  cfnresponse.send(event, context, cfnresponse.FAILED, {})
          
          def create_nutrition_index(endpoint):
              host = endpoint.replace('https://', '')
              
              awsauth = AWSRequestsAuth(
                  aws_access_key=os.environ['AWS_ACCESS_KEY_ID'],
                  aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
                  aws_token=os.environ.get('AWS_SESSION_TOKEN'),
                  aws_host=host,
                  aws_region=os.environ['AWS_REGION'],
                  aws_service='es'
              )
              
              client = OpenSearch(
                  hosts=[{'host': host, 'port': 443}],
                  http_auth=awsauth,
                  use_ssl=True,
                  verify_certs=True,
                  connection_class=RequestsHttpConnection
              )
              
              index_body = {
                  "mappings": {
                      "properties": {
                          "ingredient_name": {"type": "text", "analyzer": "korean"},
                          "ingredient_name_keyword": {"type": "keyword"},
                          "calories_per_100g": {"type": "float"},
                          "protein": {"type": "float"},
                          "fat": {"type": "float"},
                          "carbs": {"type": "float"},
                          "fiber": {"type": "float"},
                          "sodium": {"type": "float"},
                          "category": {"type": "keyword"},
                          "embedding": {
                              "type": "knn_vector",
                              "dimension": 1536,
                              "method": {"name": "hnsw", "space_type": "cosinesimil"}
                          }
                      }
                  }
              }
              
              client.indices.create(index='ingredient-nutrition', body=index_body)
      Timeout: 60

  IndexInitializerRole:
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
        - PolicyName: OpenSearchAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - es:ESHttpPost
                  - es:ESHttpPut
                  - es:ESHttpGet
                Resource: !GetAtt NutritionSearchDomain.Arn

  # 인덱스 초기화 실행
  IndexInitializer:
    Type: AWS::CloudFormation::CustomResource
    Properties:
      ServiceToken: !GetAtt IndexInitializerLambda.Arn
      DomainEndpoint: !GetAtt NutritionSearchDomain.DomainEndpoint

Outputs:
  DomainEndpoint:
    Description: OpenSearch Domain Endpoint
    Value: !GetAtt NutritionSearchDomain.DomainEndpoint
  
  DomainArn:
    Description: OpenSearch Domain ARN
    Value: !GetAtt NutritionSearchDomain.Arn
```

## 파라미터 파일 (parameters/dev-params.json)
```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "dev"
  },
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "ai-chef"
  },
  {
    "ParameterKey": "NaverClientId",
    "ParameterValue": "your-naver-client-id"
  },
  {
    "ParameterKey": "NaverClientSecret",
    "ParameterValue": "your-naver-client-secret"
  }
]
```

## 배포 명령어
```bash
# 개발 환경 배포
aws cloudformation deploy \
  --template-file main-template.yaml \
  --stack-name ai-chef-dev \
  --parameter-overrides file://parameters/dev-params.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# 프로덕션 환경 배포
aws cloudformation deploy \
  --template-file main-template.yaml \
  --stack-name ai-chef-prod \
  --parameter-overrides file://parameters/prod-params.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```
