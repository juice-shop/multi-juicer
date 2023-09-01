terraform {
  required_version = "~> 1.1"

  required_providers {
    random = {
      version = "~> 3.5.1"
      source  = "hashicorp/random"
    }
    azurerm = {
      version = "~> 3.67.0"
      source  = "hashicorp/azurerm"
    }
    http = {
      version = "~> 3.4.0"
      source  = "hashicorp/http"
    }
  }
}
