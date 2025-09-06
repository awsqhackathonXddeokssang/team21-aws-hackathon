#!/bin/bash

echo "🚀 AI Chef 완전한 백엔드 배포 시작..."

export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"

# 기존 API Gateway 삭제 완료 대기
echo "⏳ 기존 API Gateway 삭제 완료 대기 중..."
sleep 30

# SAM 빌드
echo "📦 SAM 빌드 중..."
sam build --template template-complete.yaml

if [ $? -ne 0 ]; then
    echo "❌ SAM 빌드 실패"
    exit 1
fi

# SAM 배포
echo "🚀 AWS에 배포 중..."
sam deploy \
    --template template-complete.yaml \
    --stack-name ai-chef-complete \
    --capabilities CAPABILITY_IAM \
    --region us-east-1 \
    --no-confirm-changeset \
    --resolve-s3

if [ $? -eq 0 ]; then
    echo "✅ 배포 완료!"
    echo "📋 새로운 API Gateway URL:"
    aws cloudformation describe-stacks \
        --stack-name ai-chef-complete \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text \
        --region us-east-1
    
    echo ""
    echo "🔗 사용 가능한 엔드포인트:"
    echo "POST /sessions - 세션 생성"
    echo "POST /sessions/update - 세션 업데이트"
    echo "GET /sessions/{sessionId}/status - 세션 상태 조회"
    echo "POST /sessions/{sessionId}/process - 레시피 생성 시작"
    echo "GET /results/{sessionId} - 결과 조회"
else
    echo "❌ 배포 실패"
    exit 1
fi
