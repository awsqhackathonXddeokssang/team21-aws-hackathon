#!/bin/bash

STACK_NAME="ai-chef-stepfunctions"
ENVIRONMENT=${1:-dev}
REGION=${AWS_DEFAULT_REGION:-ap-northeast-2}

echo "🚀 Deploying Step Functions..."

aws cloudformation deploy \
  --template-file step-functions-only.yaml \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --parameter-overrides Environment=${ENVIRONMENT} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

STATE_MACHINE_ARN=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[0].OutputValue' \
  --output text)

echo "✅ Step Functions deployed!"
echo "📊 State Machine ARN: ${STATE_MACHINE_ARN}"
