# ====================================================================================
# 🎛️ INFRASTRUCTURE INVARIANT INPUT SCHEMAS
# ====================================================================================

variable "aws_region" {
  type        = string
  description = "The target AWS geography zone for resource allocation."
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment lifecycle stage constraint."
  default     = "dev"
}

variable "database_secure_password" {
  type        = string
  description = "The master password for the secure PostgreSQL instance cluster boundary."
  sensitive   = true # Mask properties within automated tracking logs completely
}
