workflow "Build docker images" {
  resolves = [
    "Build'n Push Balancer",
    "Build'n Push Cleaner",
  ]
  on = "push"
}

action "Build'n Push Balancer" {
  uses = "pangzineng/Github-Action-One-Click-Docker@bfb4a810c8cb823f4a87c24da145caa707e297e9"
  secrets = ["DOCKER_PASSWORD", "DOCKER_USERNAME"]
  env = {
    DOCKER_IMAGE_NAME = "balancer"
    DOCKER_REGISTRY_URL = "docker.pkg.github.com"
    DOCKER_NAMESPACE = "j12934/juicy-ctf"
  }
  args = "./juice-balancer/"
}

action "Build'n Push Cleaner" {
  uses = "pangzineng/Github-Action-One-Click-Docker@bfb4a810c8cb823f4a87c24da145caa707e297e9"
  secrets = ["DOCKER_PASSWORD", "DOCKER_USERNAME"]
  env = {
    DOCKER_IMAGE_NAME = "cleaner"
    DOCKER_REGISTRY_URL = "docker.pkg.github.com"
    DOCKER_NAMESPACE = "j12934/juicy-ctf"
  }
  args = "./cleaner/"
}
