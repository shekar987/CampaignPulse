output "delivery_queue_url" {
  value = aws_sqs_queue.delivery.url
}

output "dead_letter_queue_url" {
  value = aws_sqs_queue.dead_letter.url
}

output "incident_topic_arn" {
  value = aws_sns_topic.incidents.arn
}

output "database_secret_arn" {
  value = aws_secretsmanager_secret.database_url.arn
}

output "database_endpoint" {
  value       = var.create_database ? aws_db_instance.postgres[0].address : null
  description = "RDS endpoint when create_database is true."
}

output "dashboard_url" {
  value = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.overview.dashboard_name}"
}
