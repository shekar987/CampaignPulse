locals {
  name = "${var.project}-${var.stage}"

  # Serverless names functions <service>-<stage>-<function>; the log groups follow.
  function_names = {
    graphql              = "${local.name}-graphql"
    delivery_worker      = "${local.name}-deliveryWorker"
    dead_letter_consumer = "${local.name}-deadLetterConsumer"
  }
}

# ---------------------------------------------------------------------------------------------
# Messaging: the delivery queue feeds the worker; messages it cannot process after
# max_receive_count attempts are redriven to the dead-letter queue.
# ---------------------------------------------------------------------------------------------

resource "aws_sqs_queue" "dead_letter" {
  name                      = "${local.name}-delivery-dlq"
  message_retention_seconds = 1209600 # 14 days: long enough to investigate
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "delivery" {
  name                       = "${local.name}-delivery"
  visibility_timeout_seconds = 120 # >= worker timeout (60 s) with headroom for retries
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 10
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = var.max_receive_count
  })
}

resource "aws_sqs_queue_redrive_allow_policy" "dead_letter" {
  queue_url = aws_sqs_queue.dead_letter.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.delivery.arn]
  })
}

# ---------------------------------------------------------------------------------------------
# Notifications: incidents and dead letters are published here; subscribe email, chat or
# paging tools. Subscribers can filter on the `severity` and `type` message attributes.
# ---------------------------------------------------------------------------------------------

resource "aws_sns_topic" "incidents" {
  name = "${local.name}-incidents"
}

resource "aws_sns_topic_subscription" "alert_email" {
  count = var.alert_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.incidents.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ---------------------------------------------------------------------------------------------
# Database credentials: never in environment variables or source control.
# ---------------------------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project}/${var.stage}/database-url"
  description             = "PostgreSQL connection string for the CampaignPulse API and workers"
  recovery_window_in_days = 0 # allow quick re-creation in a sandbox
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = var.create_database ? (
    "postgresql://${aws_db_instance.postgres[0].username}:${urlencode(random_password.database[0].result)}@${aws_db_instance.postgres[0].address}:${aws_db_instance.postgres[0].port}/${aws_db_instance.postgres[0].db_name}?sslmode=require"
  ) : var.database_url

  lifecycle {
    precondition {
      condition     = var.create_database || var.database_url != ""
      error_message = "Set database_url, or set create_database = true to provision RDS."
    }
  }
}

# ---------------------------------------------------------------------------------------------
# Optional RDS PostgreSQL. Small, single-AZ, suitable for a demo; not a production posture.
# ---------------------------------------------------------------------------------------------

resource "random_password" "database" {
  count = var.create_database ? 1 : 0

  length           = 32
  special          = true
  override_special = "!#$%^*()-_=+[]{}<>:?"
}

data "aws_vpc" "default" {
  count   = var.create_database ? 1 : 0
  default = true
}

resource "aws_security_group" "database" {
  count = var.create_database ? 1 : 0

  name        = "${local.name}-postgres"
  description = "PostgreSQL access for CampaignPulse"
  vpc_id      = data.aws_vpc.default[0].id

  dynamic "ingress" {
    for_each = var.database_allowed_cidrs
    content {
      description = "PostgreSQL"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  count = var.create_database ? 1 : 0

  identifier              = "${local.name}-postgres"
  engine                  = "postgres"
  engine_version          = "17"
  instance_class          = var.database_instance_class
  allocated_storage       = 20
  storage_type            = "gp3"
  db_name                 = "campaignpulse"
  username                = "campaignpulse"
  password                = random_password.database[0].result
  publicly_accessible     = var.database_publicly_accessible
  vpc_security_group_ids  = [aws_security_group.database[0].id]
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 1
  apply_immediately       = true
}

# ---------------------------------------------------------------------------------------------
# Observability: log groups (owned here so filters can reference them), metric filters on the
# structured logs, alarms and a dashboard.
# ---------------------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "functions" {
  for_each = local.function_names

  name              = "/aws/lambda/${each.value}"
  retention_in_days = var.log_retention_days
}

# The worker logs one line per incident it opens; count them as a metric.
resource "aws_cloudwatch_log_metric_filter" "incidents_created" {
  name           = "${local.name}-incidents-created"
  log_group_name = aws_cloudwatch_log_group.functions["delivery_worker"].name
  pattern        = "{ $.msg = \"incident created\" }"

  metric_transformation {
    name          = "IncidentsCreated"
    namespace     = "CampaignPulse/${var.stage}"
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_log_metric_filter" "deliveries_dead_lettered" {
  name           = "${local.name}-deliveries-dead-lettered"
  log_group_name = aws_cloudwatch_log_group.functions["delivery_worker"].name
  pattern        = "{ $.msg = \"delivery dead-lettered\" }"

  metric_transformation {
    name          = "DeliveriesDeadLettered"
    namespace     = "CampaignPulse/${var.stage}"
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_log_metric_filter" "delivery_failures" {
  name           = "${local.name}-delivery-attempt-failures"
  log_group_name = aws_cloudwatch_log_group.functions["delivery_worker"].name
  pattern        = "{ $.msg = \"delivery attempt failed\" }"

  metric_transformation {
    name          = "DeliveryAttemptFailures"
    namespace     = "CampaignPulse/${var.stage}"
    value         = "1"
    default_value = 0
  }
}

resource "aws_cloudwatch_metric_alarm" "dead_letter_queue_not_empty" {
  alarm_name          = "${local.name}-dead-letter-queue-not-empty"
  alarm_description   = "Messages are waiting in the delivery dead-letter queue."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.dead_letter.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.incidents.arn]
  ok_actions          = [aws_sns_topic.incidents.arn]
}

resource "aws_cloudwatch_metric_alarm" "worker_errors" {
  alarm_name          = "${local.name}-delivery-worker-errors"
  alarm_description   = "The delivery worker is failing invocations."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = local.function_names.delivery_worker }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.incidents.arn]
}

resource "aws_cloudwatch_metric_alarm" "queue_backlog" {
  alarm_name          = "${local.name}-delivery-queue-backlog"
  alarm_description   = "Delivery requests are older than five minutes; workers are not keeping up."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateAgeOfOldestMessage"
  dimensions          = { QueueName = aws_sqs_queue.delivery.name }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 5
  threshold           = 300
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.incidents.arn]
}

resource "aws_cloudwatch_dashboard" "overview" {
  dashboard_name = local.name

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Delivery outcomes"
          region = var.region
          stat   = "Sum"
          period = 60
          metrics = [
            ["CampaignPulse/${var.stage}", "DeliveryAttemptFailures", { label = "Failed attempts" }],
            [".", "DeliveriesDeadLettered", { label = "Dead-lettered" }],
            [".", "IncidentsCreated", { label = "Incidents opened" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Queues"
          region = var.region
          stat   = "Maximum"
          period = 60
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.delivery.name, { label = "Delivery queue depth" }],
            [".", "ApproximateNumberOfMessagesDelayed", ".", ".", { label = "Retries waiting (delayed)" }],
            [".", "ApproximateNumberOfMessagesVisible", ".", aws_sqs_queue.dead_letter.name, { label = "Dead-letter queue depth" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda invocations and errors"
          region = var.region
          stat   = "Sum"
          period = 60
          metrics = [
            for name in values(local.function_names) : ["AWS/Lambda", "Invocations", "FunctionName", name]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Worker duration (p95)"
          region = var.region
          stat   = "p95"
          period = 60
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", local.function_names.delivery_worker],
            [".", ".", ".", local.function_names.graphql],
          ]
        }
      },
    ]
  })
}

# ---------------------------------------------------------------------------------------------
# Hand-off to the Serverless Framework deployment.
# ---------------------------------------------------------------------------------------------

resource "aws_ssm_parameter" "handoff" {
  for_each = {
    "delivery-queue-url"    = aws_sqs_queue.delivery.url
    "delivery-queue-arn"    = aws_sqs_queue.delivery.arn
    "dead-letter-queue-url" = aws_sqs_queue.dead_letter.url
    "dead-letter-queue-arn" = aws_sqs_queue.dead_letter.arn
    "incident-topic-arn"    = aws_sns_topic.incidents.arn
    "database-secret-arn"   = aws_secretsmanager_secret.database_url.arn
  }

  name  = "/${var.project}/${var.stage}/${each.key}"
  type  = "String"
  value = each.value
}
