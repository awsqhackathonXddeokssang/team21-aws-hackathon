#!/bin/bash

# AI Chef Step Functions Cleanup Script

set -e

STACK_NAME="ai-chef-step-functions"
ENVIRONMENT=${1:-dev}
REGION=${AWS_DEFAULT_REGION:-ap-northeast-2}

echo "🧹 Cleaning up AI Chef Step Functions from ${ENVIRONMENT} environment..."

# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --region ${REGION}

echo "⏳ Waiting for stack deletion to complete..."
aws cloudformation wait stack-delete-complete \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --region ${REGION}

echo "✅ Cleanup completed!"
echo "🗑️  All resources have been removed."
