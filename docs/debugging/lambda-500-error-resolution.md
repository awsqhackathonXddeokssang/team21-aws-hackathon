# Lambda 500 에러 디버깅 및 해결 과정

## 문제 상황
- **에러**: `Cannot read properties of undefined (reading 'sessionId')`
- **위치**: `/var/task/index.js:91:48`
- **증상**: API 호출 시 500 에러 발생

## 디버깅 과정

### 1. CloudWatch 로그 분석
```bash
aws logs describe-log-streams --log-group-name "/aws/lambda/session-update-profile"
aws logs get-log-events --log-group-name "/aws/lambda/session-update-profile" --log-stream-name "..."
```

### 2. API Gateway 설정 확인
- ✅ POST 메서드 정상 설정
- ✅ /sessions/update 경로 존재
- ✅ Lambda 통합 정상
- ✅ CORS 설정 완료

### 3. 근본 원인
- `event.body`가 undefined로 전달됨
- `JSON.parse(event.body)`에서 실패
- sessionId가 빈 문자열일 때 body 자체가 전송되지 않음

## 해결 방법
localStorage에서 sessionId를 제대로 읽도록 프론트엔드 수정

## 검증 결과
```json
{
  "sessionId": "test-after-fix",
  "userPrompt": "권한 수정 후 테스트"
}
```
- ✅ Lambda 정상 실행
- ✅ Body 파싱 성공
- ✅ 에러 없이 완료

## 교훈
- sessionId 유효성 검사 필수
- CloudWatch 로그를 통한 실시간 디버깅 효과적
- API Gateway → Lambda 연결은 정상이었음
