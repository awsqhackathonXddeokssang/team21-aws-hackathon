#!/bin/bash

# AI Chef Hybrid Deployment Script (Terraform + CloudFormation)

set -e

REGION="us-east-1"

echo "🚀 Deploying AI Chef Infrastructure (Hybrid: Terraform + CloudFormation)..."

# Deploy Lambda functions with Terraform
echo "📦 Deploying Lambda Functions with Terraform..."
cd ../terraform
./deploy.sh
cd ../infrastructure

# Deploy remaining infrastructure with CloudFormation
echo "🔗 Deploying Session API with CloudFormation..."
./deploy-session-api.sh

echo "🔄 Deploying Step Functions with CloudFormation..."
./deploy-stepfunctions.sh

echo "✅ Hybrid deployment completed successfully!"
echo ""
echo "🏗️ Infrastructure Summary:"
echo "  📦 Lambda Functions: Terraform"
echo "  🔗 API Gateway: CloudFormation"
echo "  🔄 Step Functions: CloudFormation"
echo "  💾 DynamoDB: CloudFormation"
echo ""
echo "📝 Migration Notes:"
echo "  - Lambda functions now managed by Terraform"
echo "  - Other resources still use CloudFormation"
echo "  - Consider full Terraform migration in future"
