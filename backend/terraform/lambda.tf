# Data sources for ZIP files
data "archive_file" "recipe_zip" {
  type        = "zip"
  source_dir  = "../src/recipe"
  output_path = "recipe.zip"
}

data "archive_file" "price_zip" {
  type        = "zip"
  source_dir  = "../src/price"
  output_path = "price.zip"
}

data "archive_file" "combine_zip" {
  type        = "zip"
  source_dir  = "../src/combine"
  output_path = "combine.zip"
}

data "archive_file" "image_generator_zip" {
  type        = "zip"
  source_dir  = "../src/image-generator"
  output_path = "image-generator.zip"
}

# Recipe Lambda Function
resource "aws_lambda_function" "recipe" {
  filename         = data.archive_file.recipe_zip.output_path
  function_name    = "${var.project_name}-recipe"
  role            = aws_iam_role.recipe_lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 120
  memory_size     = 512

  source_code_hash = data.archive_file.recipe_zip.output_base64sha256

  tags = {
    Name        = "${var.project_name}-recipe"
    Environment = var.environment
  }
}

# Price Lambda Function
resource "aws_lambda_function" "price" {
  filename         = data.archive_file.price_zip.output_path
  function_name    = "${var.project_name}-price"
  role            = aws_iam_role.price_lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 256

  source_code_hash = data.archive_file.price_zip.output_base64sha256

  environment {
    variables = {
      NAVER_CLIENT_ID     = var.naver_client_id
      NAVER_CLIENT_SECRET = var.naver_client_secret
      SESSIONS_TABLE_NAME = "ai-chef-sessions"
    }
  }

  tags = {
    Name        = "${var.project_name}-price"
    Environment = var.environment
  }
}

# Combine Lambda Function
resource "aws_lambda_function" "combine" {
  filename         = data.archive_file.combine_zip.output_path
  function_name    = "${var.project_name}-combine"
  role            = aws_iam_role.combine_lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 128

  source_code_hash = data.archive_file.combine_zip.output_base64sha256

  environment {
    variables = {
      SESSIONS_TABLE_NAME = "ai-chef-sessions"
    }
  }

  tags = {
    Name        = "${var.project_name}-combine"
    Environment = var.environment
  }
}

# Image Generator Lambda Function
resource "aws_lambda_function" "image_generator" {
  filename         = data.archive_file.image_generator_zip.output_path
  function_name    = "${var.project_name}-image-generator"
  role            = aws_iam_role.image_generator_lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30
  memory_size     = 128

  source_code_hash = data.archive_file.image_generator_zip.output_base64sha256

  tags = {
    Name        = "recipe-image-generator"
    Environment = var.environment
  }
}
