# ---------------------------------------------------------------------------------------------
# Optional custom domain for the web app: an ACM certificate (CloudFront requires us-east-1),
# DNS validation and alias records in a Route 53 hosted zone you already own.
#
#   domain_name    = "campaignpulse.example.com"
#   hosted_zone_id = "Z0123456789ABCDEFGHIJ"
# ---------------------------------------------------------------------------------------------

variable "domain_name" {
  description = "Fully qualified domain for the web app. Empty keeps the CloudFront address."
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone that owns domain_name; required when domain_name is set."
  type        = string
  default     = ""
}

locals {
  custom_domain = var.domain_name != "" ? 1 : 0
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_acm_certificate" "web" {
  count    = local.custom_domain
  provider = aws.us_east_1

  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
    precondition {
      condition     = var.hosted_zone_id != ""
      error_message = "hosted_zone_id is required when domain_name is set."
    }
  }
}

resource "aws_route53_record" "web_validation" {
  for_each = local.custom_domain == 1 ? {
    for option in aws_acm_certificate.web[0].domain_validation_options :
    option.domain_name => {
      name   = option.resource_record_name
      record = option.resource_record_value
      type   = option.resource_record_type
    }
  } : {}

  zone_id         = var.hosted_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "web" {
  count    = local.custom_domain
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.web[0].arn
  validation_record_fqdns = [for record in aws_route53_record.web_validation : record.fqdn]
}

resource "aws_route53_record" "web" {
  for_each = local.custom_domain == 1 ? toset(["A", "AAAA"]) : toset([])

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = each.value

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}
