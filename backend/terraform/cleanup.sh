#!/bin/bash

# AI Chef Lambda Functions Terraform Cleanup Script

set -e

echo "🧹 Cleaning up AI Chef Lambda Functions (Terraform)..."

# Destroy Terraform resources
echo "💥 Destroying Terraform resources..."
terraform destroy -auto-approve

# Clean up local files
echo "🗑️ Cleaning up local files..."
rm -f *.zip
rm -f terraform.tfstate*
rm -rf .terraform/

echo "✅ Terraform cleanup completed!"
echo "📝 Note: CloudFormation resources are not affected"
