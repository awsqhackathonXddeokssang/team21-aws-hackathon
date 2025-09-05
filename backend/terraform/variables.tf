variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "ai-chef"
}

variable "naver_client_id" {
  description = "Naver Shopping API Client ID"
  type        = string
  default     = "5A_tDnltTaEiCEsXbHH7"
}

variable "naver_client_secret" {
  description = "Naver Shopping API Client Secret"
  type        = string
  default     = "ygjYjr9oqc"
}
