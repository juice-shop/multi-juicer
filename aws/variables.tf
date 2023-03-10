variable "region" {
  description = "The AWS region to use"
  type        = string
  default     = "eu-west-1"
}

variable "cluster_version" {
  description = "The EKS cluster version to use"
  type        = string
  default     = "1.25"
}

variable "cluster_name" {
  description = "The EKS cluster name"
  type        = string
  default     = "wrongsecrets-exercise-cluster"
}

variable "extra_allowed_ip_ranges" {
  description = "Allowed IP ranges in addition to creator IP"
  type        = list(string)
  default     = []
}

variable "state_bucket_arn" {
  description = "ARN of the state bucket to grant access to the s3 user"
  type        = string
}
