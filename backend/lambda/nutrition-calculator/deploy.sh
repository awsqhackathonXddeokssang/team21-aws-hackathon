#!/bin/bash

# nutrition-calculator Lambda 배포 스크립트

echo "🚀 Building Python Lambda package..."

# 임시 디렉토리 생성
mkdir -p build
cd build

# 의존성 설치
pip install -r ../requirements.txt -t .

# Lambda 함수 코드 복사
cp ../lambda_function.py .

# ZIP 패키지 생성
zip -r ../lambda-package.zip .

# 임시 디렉토리 정리
cd ..
rm -rf build

echo "📦 Package created: lambda-package.zip"

# Lambda 함수 업데이트
echo "🔄 Updating Lambda function..."
aws lambda update-function-code \
    --function-name ai-chef-nutrition-calculator \
    --zip-file fileb://lambda-package.zip \
    --region us-east-1

echo "✅ Deployment completed!"
