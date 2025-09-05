#!/bin/bash

STACK_NAME="ai-chef-stepfunctions"
REGION="us-east-1"

echo "🚀 Deploying Step Functions to ${REGION}..."

aws cloudformation deploy \
  --template-file step-functions.yaml \
  --stack-name ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

STATE_MACHINE_ARN=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[0].OutputValue' \
  --output text)

echo "✅ Step Functions deployed!"
echo "📊 State Machine ARN: ${STATE_MACHINE_ARN}"
