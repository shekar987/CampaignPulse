# ---------------------------------------------------------------------------------------------
# Lambda functions, API route and SQS event source mappings, deployed straight from the esbuild
# bundles in ../serverless/.build (run `npm run build:lambda` first). Set manage_functions = false
# to deploy the functions with the Serverless Framework instead.
# ---------------------------------------------------------------------------------------------

variable "manage_functions" {
  description = "Deploy the Lambda functions with Terraform (true) or leave them to the Serverless Framework (false)."
  type        = bool
  default     = true
}

locals {
  functions_enabled = var.manage_functions ? 1 : 0
  build_dir         = "${path.module}/../serverless/.build"

  function_environment = {
    NODE_ENV                 = "production"
    LOG_LEVEL                = "info"
    EVENT_BUS                = "sqs"
    NOTIFICATIONS            = "sns"
    RETRY_BACKOFF_SCALE      = "1"
    SIMULATION_LATENCY_SCALE = "0.05"
    DATABASE_SECRET_ARN      = aws_secretsmanager_secret.database_url.arn
    DELIVERY_QUEUE_URL       = aws_sqs_queue.delivery.url
    DEAD_LETTER_QUEUE_URL    = aws_sqs_queue.dead_letter.url
    INCIDENT_TOPIC_ARN       = aws_sns_topic.incidents.arn
  }
}

data "archive_file" "function" {
  for_each = var.manage_functions ? {
    graphql              = "graphql"
    delivery_worker      = "delivery-worker"
    dead_letter_consumer = "dead-letter-consumer"
  } : {}

  type        = "zip"
  source_dir  = "${local.build_dir}/${each.value}"
  output_path = "${local.build_dir}/${each.value}.zip"
  excludes    = ["index.mjs.map", "meta.json"]
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [for group in aws_cloudwatch_log_group.functions : "${group.arn}:*"]
  }

  statement {
    sid       = "PublishDeliveries"
    actions   = ["sqs:SendMessage", "sqs:SendMessageBatch"]
    resources = [aws_sqs_queue.delivery.arn]
  }

  statement {
    sid       = "ConsumeQueues"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.delivery.arn, aws_sqs_queue.dead_letter.arn]
  }

  statement {
    sid       = "Notify"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.incidents.arn]
  }

  statement {
    sid       = "ReadDatabaseSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.database_url.arn]
  }
}

resource "aws_iam_role" "lambda" {
  count = local.functions_enabled

  name               = "${local.name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "lambda" {
  count = local.functions_enabled

  name   = "${local.name}-lambda"
  role   = aws_iam_role.lambda[0].id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

resource "aws_lambda_function" "graphql" {
  count = local.functions_enabled

  function_name    = local.function_names.graphql
  description      = "GraphQL API (queries, campaign creation, simulation and incident actions)"
  role             = aws_iam_role.lambda[0].arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  memory_size      = 512
  timeout          = 20
  filename         = data.archive_file.function["graphql"].output_path
  source_code_hash = data.archive_file.function["graphql"].output_base64sha256

  environment {
    variables = local.function_environment
  }

  depends_on = [aws_cloudwatch_log_group.functions, aws_iam_role_policy.lambda]
}

resource "aws_lambda_function" "delivery_worker" {
  count = local.functions_enabled

  function_name                  = local.function_names.delivery_worker
  description                    = "Consumes delivery requests, performs simulated deliveries, schedules retries"
  role                           = aws_iam_role.lambda[0].arn
  handler                        = "index.handler"
  runtime                        = "nodejs22.x"
  architectures                  = ["arm64"]
  memory_size                    = 512
  timeout                        = 60
  reserved_concurrent_executions = 5
  filename                       = data.archive_file.function["delivery_worker"].output_path
  source_code_hash               = data.archive_file.function["delivery_worker"].output_base64sha256

  environment {
    variables = local.function_environment
  }

  depends_on = [aws_cloudwatch_log_group.functions, aws_iam_role_policy.lambda]
}

resource "aws_lambda_function" "dead_letter_consumer" {
  count = local.functions_enabled

  function_name    = local.function_names.dead_letter_consumer
  description      = "Records messages the worker gave up on and raises a notification"
  role             = aws_iam_role.lambda[0].arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  memory_size      = 512
  timeout          = 30
  filename         = data.archive_file.function["dead_letter_consumer"].output_path
  source_code_hash = data.archive_file.function["dead_letter_consumer"].output_base64sha256

  environment {
    variables = local.function_environment
  }

  depends_on = [aws_cloudwatch_log_group.functions, aws_iam_role_policy.lambda]
}

resource "aws_lambda_event_source_mapping" "delivery_worker" {
  count = local.functions_enabled

  event_source_arn                   = aws_sqs_queue.delivery.arn
  function_name                      = aws_lambda_function.delivery_worker[0].arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 2
  function_response_types            = ["ReportBatchItemFailures"]
}

resource "aws_lambda_event_source_mapping" "dead_letter_consumer" {
  count = local.functions_enabled

  event_source_arn        = aws_sqs_queue.dead_letter.arn
  function_name           = aws_lambda_function.dead_letter_consumer[0].arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]
}

# ---------------------------------------------------------------------------------------------
# HTTP API in front of the GraphQL function. CORS is open because the web app is served from a
# different origin (CloudFront).
# ---------------------------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "graphql" {
  count = local.functions_enabled

  name          = "${local.stage}-campaignpulse"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type", "accept", "x-request-id", "x-correlation-id"]
    max_age       = 86400
  }
}

locals {
  stage = var.stage
}

resource "aws_apigatewayv2_integration" "graphql" {
  count = local.functions_enabled

  api_id                 = aws_apigatewayv2_api.graphql[0].id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.graphql[0].invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "graphql" {
  count = local.functions_enabled

  api_id    = aws_apigatewayv2_api.graphql[0].id
  route_key = "ANY /graphql"
  target    = "integrations/${aws_apigatewayv2_integration.graphql[0].id}"
}

resource "aws_apigatewayv2_stage" "default" {
  count = local.functions_enabled

  api_id      = aws_apigatewayv2_api.graphql[0].id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  count = local.functions_enabled

  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.graphql[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.graphql[0].execution_arn}/*/*"
}

output "api_url" {
  value       = var.manage_functions ? "${aws_apigatewayv2_api.graphql[0].api_endpoint}/graphql" : null
  description = "GraphQL endpoint when Terraform manages the functions."
}
