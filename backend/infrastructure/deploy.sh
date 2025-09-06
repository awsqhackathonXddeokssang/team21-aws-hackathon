#!/bin/bash

# AI Chef Lambda Functions Deployment Script

set -e

REGION="us-east-1"

echo "🚀 Deploying AI Chef Lambda Functions..."

# Deploy Session Create Lambda
echo "🔑 Deploying Session Create Lambda..."
aws cloudformation deploy \
  --template-file session-create-lambda.yaml \
  --stack-name ai-chef-session-create-lambda \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# Deploy Session Update Lambda
echo "🔄 Deploying Session Update Lambda..."
aws cloudformation deploy \
  --template-file session-update-lambda.yaml \
  --stack-name ai-chef-session-update-lambda \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# TEMPORARILY DISABLED - Deploy only session-create and session-update Lambda
# # Deploy Recipe Lambda
# echo "📦 Deploying Recipe Lambda..."
# aws cloudformation deploy \
#   --template-file recipe-lambda.yaml \
#   --stack-name ai-chef-recipe-lambda \
#   --capabilities CAPABILITY_IAM \
#   --region ${REGION}

# # Deploy Price Lambda
# echo "💰 Deploying Price Lambda..."
# aws cloudformation deploy \
#   --template-file price-lambda.yaml \
#   --stack-name ai-chef-price-lambda \
#   --capabilities CAPABILITY_IAM \
#   --region ${REGION}

# # Deploy Combine Lambda
# echo "🔗 Deploying Combine Lambda..."
# aws cloudformation deploy \
#   --template-file combine-lambda.yaml \
#   --stack-name ai-chef-combine-lambda \
#   --capabilities CAPABILITY_IAM \
#   --region ${REGION}

# # Deploy Image Generator Lambda
# echo "🖼️  Deploying Image Generator Lambda..."
# aws cloudformation deploy \
#   --template-file image-generator-lambda.yaml \
#   --stack-name ai-chef-image-generator-lambda \
#   --capabilities CAPABILITY_IAM \
#   --region ${REGION}

echo "✅ Lambda Functions deployed successfully!"
echo "📊 Functions deployed:"
echo "  - ai-chef-session-create"
echo "  - ai-chef-session-update"
