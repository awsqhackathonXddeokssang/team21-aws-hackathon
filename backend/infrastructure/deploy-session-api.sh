#!/bin/bash
set -e  # Exit on any error

STACK_NAME="ai-chef-session-api"
REGION="us-east-1"

echo "🚀 Deploying Session API to ${REGION}..."

aws cloudformation deploy \
  --template-file session-api.yaml \
  --stack-name ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

if [ $? -ne 0 ]; then
  echo "❌ CloudFormation deployment failed!"
  exit 1
fi

API_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)

echo "✅ Session API deployed!"
echo "🌐 API Gateway URL: ${API_URL}"
echo "📋 Test endpoint: ${API_URL}/sessions"
