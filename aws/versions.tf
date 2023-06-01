terraform {
  required_version = "~> 1.1"

  required_providers {
    aws = {
      version = "~> 5.0"
    }
    random = {
      version = "~> 3.0"
    }
    http = {
      version = "~> 3.1"
    }
  }
}
