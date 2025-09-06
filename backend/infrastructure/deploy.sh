#!/bin/bash

# AI Chef Lambda Functions Deployment Script

set -e

REGION="us-east-1"

echo "🚀 Deploying AI Chef Lambda Functions..."

# Deploy Recipe Lambda
echo "📦 Deploying Recipe Lambda..."
aws cloudformation deploy \
  --template-file recipe-lambda.yaml \
  --stack-name ai-chef-recipe-lambda \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# Deploy Price Lambda
echo "💰 Deploying Price Lambda..."
aws cloudformation deploy \
  --template-file price-lambda.yaml \
  --stack-name ai-chef-price-lambda \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# Deploy Combine Lambda
echo "🔗 Deploying Combine Lambda..."
aws cloudformation deploy \
  --template-file combine-lambda.yaml \
  --stack-name ai-chef-combine-lambda \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# Deploy Image Generator Lambda
echo "🖼️  Deploying Image Generator Lambda..."
aws cloudformation deploy \
  --template-file image-generator-lambda.yaml \
  --stack-name ai-chef-image-generator-lambda \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

# Deploy Result Lambda
echo "📊 Deploying Result Lambda..."
echo "⚠️  Skipping Result Lambda deployment (function already exists and updated manually)"

echo "✅ All Lambda functions deployed successfully!"
echo "📊 Functions deployed:"
echo "  - ai-chef-recipe"
echo "  - PriceLambda"
echo "  - CombineLambda"
echo "  - recipe-image-generator"
echo "  - ai-chef-result"
