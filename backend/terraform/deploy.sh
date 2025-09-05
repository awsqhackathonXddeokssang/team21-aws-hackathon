#!/bin/bash

# AI Chef Lambda Functions Terraform Deployment Script

set -e

REGION="us-east-1"

echo "🚀 Deploying AI Chef Lambda Functions with Terraform..."

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init

# Plan deployment
echo "📋 Planning Terraform deployment..."
terraform plan -var="aws_region=${REGION}"

# Apply deployment
echo "🚀 Applying Terraform deployment..."
terraform apply -auto-approve -var="aws_region=${REGION}"

echo "✅ All Lambda functions deployed successfully with Terraform!"
echo "📊 Functions deployed:"
echo "  - ai-chef-recipe"
echo "  - ai-chef-price"
echo "  - ai-chef-combine"
echo "  - recipe-image-generator"

echo ""
echo "📝 Next steps:"
echo "  1. Update Step Functions to reference new Lambda ARNs"
echo "  2. Test Lambda functions individually"
echo "  3. Remove old CloudFormation stacks"
