#!/bin/bash

# AI Chef API Gateway Deployment Script

set -e

REGION="us-east-1"

echo "🚀 Deploying AI Chef API Gateway..."

# Deploy API Gateway
echo "🌐 Deploying API Gateway..."
aws cloudformation deploy \
  --template-file api-gateway-only.yaml \
  --stack-name ai-chef-api-gateway \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

echo "✅ API Gateway deployed successfully!"
echo "📊 Resources deployed:"
echo "  - ai-chef-api (API Gateway)"
echo "  - /sessions endpoint"
echo "  - CloudWatch monitoring"
