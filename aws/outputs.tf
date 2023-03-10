output "cluster_endpoint" {
  description = "Endpoint for EKS control plane."
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ids attached to the cluster control plane."
  value       = module.eks.cluster_security_group_id
}

output "irsa_role_arn" {
  description = "The role ARN used in the IRSA setup"
  value       = aws_iam_role.irsa_role.arn
}

output "irsa_role" {
  description = "The role name used in the IRSA setup"
  value       = aws_iam_role.irsa_role.name
}

output "secrets_manager_secret_name" {
  description = "The name of the secrets manager secret"
  value       = aws_secretsmanager_secret.secret.name
}


output "cluster_id" {
  description = "The id of the cluster"
  value       = module.eks.cluster_id
}

output "cluster_name" {
  description = "The EKS cluster name"
  value       = module.eks.cluster_name
}

output "ebs_role" {
  description = "EBS CSI driver role"
  value       = module.ebs_csi_irsa_role.iam_role_name
}

output "ebs_role_arn" {
  description = "EBS CSI driver role"
  value       = module.ebs_csi_irsa_role.iam_role_arn
}

output "cluster_autoscaler_role" {
  description = "Cluster autoscaler role"
  value       = module.cluster_autoscaler_irsa_role.iam_role_name
}

output "cluster_autoscaler_role_arn" {
  description = "Cluster autoscaler role arn"
  value       = module.cluster_autoscaler_irsa_role.iam_role_arn
}

output "load_balancer_controller_role" {
  description = "Load balancer controller role"
  value       = module.load_balancer_controller_irsa_role.iam_role_name
}

output "load_balancer_controller_role_arn" {
  description = "Load balancer controller role arn"
  value       = module.load_balancer_controller_irsa_role.iam_role_arn
}

output "state_bucket_name" {
  description = "Terraform s3 state bucket name"
  value       = split(":", var.state_bucket_arn)[length(split(":", var.state_bucket_arn)) - 1]
}
