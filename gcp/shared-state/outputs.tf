output "bucket" {
  value       = google_storage_bucket.state_bucket.name
  description = "Terraform backend storage bucket"
}
