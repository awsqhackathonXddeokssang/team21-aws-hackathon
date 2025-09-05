#!/bin/bash

# AI Chef Step Functions Deployment Script

set -e

STACK_NAME="ai-chef-step-functions"
ENVIRONMENT=${1:-dev}
REGION=${AWS_DEFAULT_REGION:-ap-northeast-2}

echo "🚀 Deploying AI Chef Step Functions to ${ENVIRONMENT} environment..."

# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file step-functions.yaml \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --parameter-overrides Environment=${ENVIRONMENT} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# Get outputs
STACK_OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME}-${ENVIRONMENT} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs')

STATE_MACHINE_ARN=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="StateMachineArn") | .OutputValue')
SESSION_TABLE=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="SessionTableName") | .OutputValue')

echo "✅ Deployment completed!"
echo "📊 State Machine ARN: ${STATE_MACHINE_ARN}"
echo "🗄️  Session Table: ${SESSION_TABLE}"

# Test the workflow
echo "🧪 Testing workflow..."
EXECUTION_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn ${STATE_MACHINE_ARN} \
  --name "test-$(date +%s)" \
  --input '{
    "sessionId": "test-session",
    "userInput": {
      "dietType": "keto",
      "healthGoals": ["weight_loss"],
      "allergies": [],
      "budget": 30000
    }
  }' \
  --region ${REGION} \
  --query 'executionArn' \
  --output text)

echo "🔄 Execution started: ${EXECUTION_ARN}"
echo "Monitor at: https://${REGION}.console.aws.amazon.com/states/home?region=${REGION}#/executions/details/${EXECUTION_ARN}"
