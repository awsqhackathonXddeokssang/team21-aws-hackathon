# API Gateway 최대 로깅 및 모니터링 설정 가이드

> **⚠️ 경고**: 이 설정은 AWS 비용을 대폭 증가시킵니다. 월 $80-160 예상 (트래픽에 따라 더 증가 가능)

## 🎯 설정 완료 현황

### ✅ 완료된 작업들

#### 1. IAM 역할 및 권한 설정
```bash
# IAM 역할 생성
Role Name: APIGatewayCloudWatchLogsRole
ARN: arn:aws:iam::491085385364:role/APIGatewayCloudWatchLogsRole
Policy: AmazonAPIGatewayPushToCloudWatchLogs
```

#### 2. 계정 레벨 설정
```bash
# CloudWatch 역할 설정
cloudwatchRoleArn: arn:aws:iam::491085385364:role/APIGatewayCloudWatchLogsRole
```

#### 3. API Gateway 로깅 설정 (모든 API)

| API ID | API Name | Stage | 로깅 레벨 | 데이터 트레이스 | 메트릭 | X-Ray |
|--------|----------|-------|-----------|----------------|--------|-------|
| 68k4rbx0g4 | ai-chef-api | prod | INFO | ✅ | ✅ | ✅ |
| tlg1j21vgf | ai-chef-session-api | prod | INFO | ✅ | ✅ | ✅ |
| tlg1j21vgf | ai-chef-session-api | dev | INFO | ✅ | ✅ | ✅ |
| tlg1j21vgf | ai-chef-session-api | v1 | INFO | ✅ | ✅ | ✅ |
| wf7iioy7kf | nutrition-rag-prod-restful-api | prod | INFO | ✅ | ✅ | ✅ |

#### 4. CloudWatch 로그 그룹 설정
```bash
# 로그 그룹 보존 기간: 365일 (1년)
API-Gateway-Execution-Logs_68k4rbx0g4/prod
API-Gateway-Execution-Logs_tlg1j21vgf/prod
API-Gateway-Execution-Logs_tlg1j21vgf/dev
API-Gateway-Execution-Logs_tlg1j21vgf/v1
API-Gateway-Execution-Logs_wf7iioy7kf/prod
```

#### 5. CloudWatch 대시보드
```bash
대시보드명: AI-Chef-API-Gateway-Monitoring
URL: https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=AI-Chef-API-Gateway-Monitoring
```

#### 6. CloudWatch 알람
- **AI-Chef-API-High-Error-Rate**: 에러율 5% 이상
- **AI-Chef-API-High-Latency**: 지연시간 5초 이상
- **AI-Chef-API-Server-Errors**: 5XX 에러 발생시

---

## 📊 로그 확인 방법

### 1. CloudWatch Logs 콘솔
```
AWS Console > CloudWatch > Logs > Log groups
/aws/apigateway/API-Gateway-Execution-Logs_[API_ID]/[STAGE]
```

### 2. AWS CLI로 로그 확인
```bash
# 실시간 로그 스트림
aws logs tail API-Gateway-Execution-Logs_68k4rbx0g4/prod --follow --region us-east-1

# 특정 시간 범위 로그
aws logs filter-log-events \
  --log-group-name "API-Gateway-Execution-Logs_68k4rbx0g4/prod" \
  --start-time 1693900800000 \
  --region us-east-1
```

### 3. X-Ray 트레이싱 확인
```
AWS Console > X-Ray > Traces
Service Map에서 API Gateway 호출 추적 가능
```

---

## 💰 비용 분석

### 예상 월 비용 (트래픽 기준)

| 트래픽 | CloudWatch Logs | X-Ray | 메트릭 | 총 비용 |
|--------|----------------|-------|--------|---------|
| 1K req/일 | $0.1 | $0.05 | $0.02 | **$0.17** |
| 10K req/일 | $1 | $0.5 | $0.2 | **$1.7** |
| 100K req/일 | $10 | $5 | $2 | **$17** |
| 1M req/일 | $100 | $50 | $20 | **$170** |

### 비용 절약 방법
```bash
# ERROR 레벨로 변경 (비용 90% 절약)
aws apigateway update-stage \
  --rest-api-id 68k4rbx0g4 \
  --stage-name prod \
  --patch-operations op='replace',path='/*/*/logging/loglevel',value='ERROR'

# 데이터 트레이스 비활성화 (비용 50% 절약)
aws apigateway update-stage \
  --rest-api-id 68k4rbx0g4 \
  --stage-name prod \
  --patch-operations op='replace',path='/*/*/logging/dataTrace',value='false'
```

---

## 🔧 설정 명령어 모음

### 전체 설정 스크립트
```bash
#!/bin/bash
# API Gateway 최대 로깅 설정 스크립트

# 1. IAM 역할 생성
aws iam create-role \
  --role-name APIGatewayCloudWatchLogsRole \
  --assume-role-policy-document file://api-gateway-logging-role.json

aws iam attach-role-policy \
  --role-name APIGatewayCloudWatchLogsRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs

# 2. 계정 설정
aws apigateway update-account \
  --patch-operations op='replace',path='/cloudwatchRoleArn',value='arn:aws:iam::491085385364:role/APIGatewayCloudWatchLogsRole'

# 3. API Gateway 로깅 활성화 (예시)
aws apigateway update-stage \
  --rest-api-id 68k4rbx0g4 \
  --stage-name prod \
  --patch-operations \
    op='replace',path='/*/*/logging/loglevel',value='INFO' \
    op='replace',path='/*/*/logging/dataTrace',value='true' \
    op='replace',path='/*/*/metrics/enabled',value='true' \
    op='replace',path='/tracingEnabled',value='true'

# 4. 로그 보존 기간 설정
aws logs put-retention-policy \
  --log-group-name "API-Gateway-Execution-Logs_68k4rbx0g4/prod" \
  --retention-in-days 365
```

### 롤백 스크립트
```bash
#!/bin/bash
# 로깅 비활성화 (비용 절약)

# 로깅 레벨 제거
aws apigateway update-stage \
  --rest-api-id 68k4rbx0g4 \
  --stage-name prod \
  --patch-operations op='remove',path='/*/*/logging/loglevel'

# X-Ray 비활성화
aws apigateway update-stage \
  --rest-api-id 68k4rbx0g4 \
  --stage-name prod \
  --patch-operations op='replace',path='/tracingEnabled',value='false'
```

---

## 🚨 주의사항

### 1. 보안 고려사항
- 로그에 민감한 정보 (토큰, 비밀번호) 포함 가능
- CloudWatch Logs 접근 권한 엄격히 관리
- 로그 보존 기간 정책 수립 필요

### 2. 성능 영향
- INFO 레벨 로깅: 10-50ms 지연 증가
- 데이터 트레이스: 추가 5-10ms 지연
- 높은 트래픽에서 처리량 5-10% 감소

### 3. 비용 모니터링
- CloudWatch 비용 알람 설정 권장
- 월 예산 한도 설정
- 정기적인 로그 사용량 검토

---

## 📞 문제 해결

### 로그가 안 보일 때
1. IAM 역할 권한 확인
2. 계정 레벨 cloudwatchRoleArn 설정 확인
3. 스테이지 로깅 설정 확인
4. 로그 그룹 생성 여부 확인

### 비용이 너무 높을 때
1. ERROR 레벨로 변경
2. 데이터 트레이스 비활성화
3. 로그 보존 기간 단축 (7일, 30일)
4. 불필요한 API 로깅 비활성화

---

## 📚 참고 자료

- [AWS API Gateway 로깅 공식 문서](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-logging.html)
- [CloudWatch Logs 요금](https://aws.amazon.com/cloudwatch/pricing/)
- [X-Ray 요금](https://aws.amazon.com/xray/pricing/)

---

**작성일**: 2025-09-05  
**작성자**: Amazon Q Developer  
**상태**: 설정 완료 ✅  
**비용 경고**: 🚨 HIGH COST SETUP 🚨
