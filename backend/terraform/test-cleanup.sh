#!/bin/bash

# AI Chef Lambda Functions - Test Cleanup

set -e

echo "🧹 Cleaning up test Lambda functions..."
echo ""
echo "⚠️  This will destroy:"
echo "  - ai-chef-test-recipe"
echo "  - ai-chef-test-price" 
echo "  - ai-chef-test-combine"
echo "  - recipe-image-generator (test version)"
echo ""

read -p "🤔 Are you sure you want to cleanup test resources? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

# Destroy test resources
echo "💥 Destroying test resources..."
terraform destroy -auto-approve -var-file="terraform.tfvars"

# Clean up local files
echo "🗑️ Cleaning up local files..."
rm -f *.zip
rm -f terraform.tfstate*
rm -rf .terraform/

echo "✅ Test cleanup completed!"
echo "📝 Note: Your existing production resources are untouched"
