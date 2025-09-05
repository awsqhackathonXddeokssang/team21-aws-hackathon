#!/bin/bash

STACK_NAME="ai-chef-session-api"
ENVIRONMENT=${1:-dev}
REGION="us-east-1"

echo "🚀 Deploying Session API to ${REGION}..."

aws cloudformation deploy \
  --template-file session-api.yaml \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --parameter-overrides Environment=${ENVIRONMENT} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

API_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text)

echo "✅ Session API deployed!"
echo "🌐 API Gateway URL: ${API_URL}"
echo "📋 Test endpoint: ${API_URL}/session/{id}/process"
