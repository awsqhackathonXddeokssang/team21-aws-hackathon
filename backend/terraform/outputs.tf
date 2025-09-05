output "recipe_lambda_arn" {
  description = "Recipe Lambda Function ARN"
  value       = aws_lambda_function.recipe.arn
}

output "recipe_lambda_name" {
  description = "Recipe Lambda Function Name"
  value       = aws_lambda_function.recipe.function_name
}

output "price_lambda_arn" {
  description = "Price Lambda Function ARN"
  value       = aws_lambda_function.price.arn
}

output "price_lambda_name" {
  description = "Price Lambda Function Name"
  value       = aws_lambda_function.price.function_name
}

output "combine_lambda_arn" {
  description = "Combine Lambda Function ARN"
  value       = aws_lambda_function.combine.arn
}

output "combine_lambda_name" {
  description = "Combine Lambda Function Name"
  value       = aws_lambda_function.combine.function_name
}

output "image_generator_lambda_arn" {
  description = "Image Generator Lambda Function ARN"
  value       = aws_lambda_function.image_generator.arn
}

output "image_generator_lambda_name" {
  description = "Image Generator Lambda Function Name"
  value       = aws_lambda_function.image_generator.function_name
}
