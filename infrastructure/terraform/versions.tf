terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Remote state in the bucket created by infrastructure/bootstrap/github-oidc-role.yml. The
  # bucket, key and region are supplied at init time (see the deploy workflow):
  #   terraform init \
  #     -backend-config="bucket=campaignpulse-terraform-state-<account id>" \
  #     -backend-config="key=campaignpulse/<stage>.tfstate" \
  #     -backend-config="region=<region>"
  # Validate or plan without state with `terraform init -backend=false`.
  backend "s3" {
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      Stage     = var.stage
      ManagedBy = "terraform"
    }
  }
}
