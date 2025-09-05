# Recipe Lambda IAM Role
resource "aws_iam_role" "recipe_lambda_role" {
  name = "${var.project_name}-recipe-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-recipe-lambda-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "recipe_lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.recipe_lambda_role.name
}

resource "aws_iam_role_policy" "recipe_bedrock_policy" {
  name = "${var.project_name}-recipe-bedrock-policy"
  role = aws_iam_role.recipe_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-opus-4-1-20250805-v1:0"
      }
    ]
  })
}

# Price Lambda IAM Role
resource "aws_iam_role" "price_lambda_role" {
  name = "${var.project_name}-price-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-price-lambda-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "price_lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.price_lambda_role.name
}

resource "aws_iam_role_policy" "price_dynamodb_policy" {
  name = "${var.project_name}-price-dynamodb-policy"
  role = aws_iam_role.price_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/ai-chef-sessions"
      }
    ]
  })
}

# Combine Lambda IAM Role
resource "aws_iam_role" "combine_lambda_role" {
  name = "${var.project_name}-combine-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-combine-lambda-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "combine_lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.combine_lambda_role.name
}

resource "aws_iam_role_policy" "combine_dynamodb_policy" {
  name = "${var.project_name}-combine-dynamodb-policy"
  role = aws_iam_role.combine_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/ai-chef-sessions"
      }
    ]
  })
}

# Image Generator Lambda IAM Role
resource "aws_iam_role" "image_generator_lambda_role" {
  name = "${var.project_name}-image-generator-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-image-generator-lambda-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "image_generator_lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.image_generator_lambda_role.name
}
