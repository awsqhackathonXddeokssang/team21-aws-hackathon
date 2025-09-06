#!/bin/bash

echo "🚀 AI Chef 핵심 백엔드 배포 시작..."

export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"

# SAM 빌드
echo "📦 SAM 빌드 중..."
sam build --template template-core.yaml

if [ $? -ne 0 ]; then
    echo "❌ SAM 빌드 실패"
    exit 1
fi

# SAM 배포
echo "🚀 AWS에 배포 중..."
sam deploy \
    --template template-core.yaml \
    --stack-name ai-chef-backend \
    --capabilities CAPABILITY_IAM \
    --region us-east-1 \
    --no-confirm-changeset \
    --resolve-s3

if [ $? -eq 0 ]; then
    echo "✅ 배포 완료!"
    echo "📋 API Gateway URL:"
    aws cloudformation describe-stacks \
        --stack-name ai-chef-backend \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text \
        --region us-east-1
else
    echo "❌ 배포 실패"
    exit 1
fi
