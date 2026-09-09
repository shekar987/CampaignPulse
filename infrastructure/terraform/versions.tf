terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Keep state remote for anything beyond a personal sandbox, e.g.:
  # backend "s3" {
  #   bucket = "my-terraform-state"
  #   key    = "campaignpulse/dev.tfstate"
  #   region = "eu-west-2"
  # }
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
