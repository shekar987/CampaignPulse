variable "project" {
  description = "Name used as a prefix for every resource."
  type        = string
  default     = "campaignpulse"
}

variable "stage" {
  description = "Deployment stage (dev, staging, prod). Must match the Serverless stage."
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region. London keeps the demo close to its retail-media context."
  type        = string
  default     = "eu-west-2"
}

variable "database_url" {
  description = <<-EOT
    PostgreSQL connection string stored in Secrets Manager for the Lambda functions. Leave empty
    to create an RDS instance instead (create_database = true), in which case the RDS-managed
    credentials are used.
  EOT
  type        = string
  default     = ""
  sensitive   = true
}

variable "create_database" {
  description = "Provision a small RDS PostgreSQL instance. Off by default: bring your own database via database_url."
  type        = bool
  default     = false
}

variable "database_instance_class" {
  description = "RDS instance class when create_database is true."
  type        = string
  default     = "db.t4g.micro"
}

variable "database_publicly_accessible" {
  description = "Expose the RDS instance publicly so Lambda (outside a VPC) and migrations can reach it. Restrict with database_allowed_cidrs."
  type        = bool
  default     = true
}

variable "database_allowed_cidrs" {
  description = <<-EOT
    CIDR blocks allowed to reach PostgreSQL when create_database is true. The Lambda functions
    run outside a VPC with no fixed egress address, so the demo default admits any address and
    relies on TLS plus a 32-character random password. Narrow it for anything beyond a demo.
  EOT
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "alert_email" {
  description = "Email address subscribed to the incident topic. Empty disables the subscription."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the Lambda log groups."
  type        = number
  default     = 14
}

variable "max_receive_count" {
  description = "Deliveries of a message to the worker before SQS moves it to the dead-letter queue."
  type        = number
  default     = 3
}
