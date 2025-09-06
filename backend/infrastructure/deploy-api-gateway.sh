#!/bin/bash

# AI Chef API Gateway Deployment Script

set -e

STACK_NAME="ai-chef-api-gateway"
REGION="us-east-1"

echo "🚀 Deploying AI Chef API Gateway..."

# Check if stack exists and its status
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "DOES_NOT_EXIST")

echo "📋 Current stack status: ${STACK_STATUS}"

# Handle ROLLBACK_COMPLETE state
if [ "$STACK_STATUS" = "ROLLBACK_COMPLETE" ]; then
  echo "⚠️  Stack is in ROLLBACK_COMPLETE state. Deleting and recreating..."
  
  # Delete the failed stack
  aws cloudformation delete-stack \
    --stack-name ${STACK_NAME} \
    --region ${REGION}
  
  echo "🗑️  Waiting for stack deletion to complete..."
  aws cloudformation wait stack-delete-complete \
    --stack-name ${STACK_NAME} \
    --region ${REGION}
  
  echo "✅ Stack deleted successfully"
fi

# Deploy API Gateway
echo "🌐 Deploying API Gateway..."
aws cloudformation deploy \
  --template-file api-gateway-only.yaml \
  --stack-name ${STACK_NAME} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

if [ $? -ne 0 ]; then
  echo "❌ CloudFormation deployment failed!"
  echo "📋 Stack events:"
  aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --region ${REGION} --max-items 10 || true
  exit 1
fi

echo "✅ API Gateway deployed successfully!"
echo "📊 Resources deployed:"
echo "  - ai-chef-api (API Gateway)"
echo "  - /sessions endpoint"
echo "  - CloudWatch monitoring"
