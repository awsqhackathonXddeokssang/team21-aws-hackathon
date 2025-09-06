#!/bin/bash

echo "🚀 AI Chef Backend 배포 시작..."

# SAM 빌드
echo "📦 SAM 빌드 중..."
sam build

if [ $? -ne 0 ]; then
    echo "❌ SAM 빌드 실패"
    exit 1
fi

# SAM 배포
echo "🚀 AWS에 배포 중..."
sam deploy \
    --stack-name ai-chef-backend \
    --capabilities CAPABILITY_IAM \
    --region us-east-1 \
    --confirm-changeset \
    --resolve-s3

if [ $? -eq 0 ]; then
    echo "✅ 배포 완료!"
    echo "📋 API Gateway URL 확인 중..."
    aws cloudformation describe-stacks \
        --stack-name ai-chef-backend \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text \
        --region us-east-1
else
    echo "❌ 배포 실패"
    exit 1
fi
