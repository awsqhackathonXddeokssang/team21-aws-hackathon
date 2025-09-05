#!/bin/bash

# AI Chef Lambda Functions - Safe Test Deployment

set -e

echo "🧪 Starting SAFE test deployment (no impact on existing resources)..."
echo ""
echo "📋 Test Configuration:"
echo "  - Function names: ai-chef-test-* (different from existing)"
echo "  - Environment: test"
echo "  - No Step Functions integration"
echo ""

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Please install Terraform first:"
    echo "   brew install terraform"
    exit 1
fi

# Initialize Terraform
echo "🔧 Initializing Terraform..."
terraform init

# Validate configuration
echo "✅ Validating Terraform configuration..."
terraform validate

# Plan deployment (show what will be created)
echo "📋 Planning deployment (review what will be created)..."
terraform plan -var-file="terraform.tfvars"

# Ask for confirmation
echo ""
read -p "🤔 Do you want to proceed with test deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Apply deployment
echo "🚀 Deploying test Lambda functions..."
terraform apply -auto-approve -var-file="terraform.tfvars"

echo ""
echo "✅ Test deployment completed successfully!"
echo ""
echo "📊 Created Lambda functions:"
terraform output -json | jq -r 'to_entries[] | "  - \(.key): \(.value.value)"'

echo ""
echo "🧪 Test Commands:"
echo "  # List functions"
echo "  aws lambda list-functions --query 'Functions[?contains(FunctionName, \`ai-chef-test\`)].FunctionName'"
echo ""
echo "  # Test recipe function"
echo "  aws lambda invoke --function-name ai-chef-test-recipe --payload '{\"sessionId\":\"test\",\"profile\":{\"target\":\"general\"}}' response.json"
echo ""
echo "🧹 Cleanup when done:"
echo "  ./test-cleanup.sh"
