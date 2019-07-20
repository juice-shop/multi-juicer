workflow "Build docker image" {
  resolves = [
    "Build Balacer",
    "Build Cleaner",
  ]
  on = "push"
}

action "Build Balacer" {
  uses = "pangzineng/Github-Action-One-Click-Docker@bfb4a810c8cb823f4a87c24da145caa707e297e9"
  secrets = ["DOCKER_NAMESPACE", "DOCKER_PASSWORD", "DOCKER_REGISTRY_URL", "DOCKER_USERNAME"]
  env = {
    DOCKER_IMAGE_NAME = "balancer"
  }
  args = "./balancer/."
}

action "Build Cleaner" {
  uses = "pangzineng/Github-Action-One-Click-Docker@bfb4a810c8cb823f4a87c24da145caa707e297e9"
  secrets = ["DOCKER_NAMESPACE", "DOCKER_PASSWORD", "DOCKER_REGISTRY_URL", "DOCKER_USERNAME"]
  env = {
    DOCKER_IMAGE_NAME = "cleaner"
  }
}
