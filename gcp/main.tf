terraform {
  # For shared state:
  # Set the resource group in the backend configuration below, then uncomment and apply!
  # Note that you probably already create a resource group. Don't forget to set that correctly in this file.
  backend "gcs" {
    bucket = ""
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}


provider "random" {}

provider "http" {}

data "http" "ip" {
  url = "http://ipecho.net/plain"
}


resource "google_container_cluster" "gke" {
  name               = var.cluster_name
  location           = var.region
  initial_node_count = 1

  min_master_version = var.cluster_version

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.node_subnet.name

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  node_config {
    # Google recommends custom service accounts that have cloud-platform scope and permissions granted via IAM Roles.
    service_account = google_service_account.wrongsecrets_cluster.email
    machine_type    = "e2-standard-2"
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    labels = {
      application = "wrongsecrets"
    }
    tags = ["wrongsecrets"]
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = "${data.http.ip.response_body}/32"
      display_name = "user origin"
    }
  }

  cluster_autoscaling {
    enabled = true
    resource_limits {
      resource_type = "cpu"
      minimum       = 2  # 1 node * 2 vCPU (e2-standard-2)
      maximum       = 20 # 10 nodes * 2 vCPU (e2-standard-2)

    }

    resource_limits {
      resource_type = "memory"
      minimum       = 8  # 1 node * 8 GB (e2-standard-2)
      maximum       = 80 # 10 nodes * 8 GB (e2-standard-2)

    }

  }

  addons_config {
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
  }

  timeouts {
    create = "30m"
    update = "40m"
  }
}
