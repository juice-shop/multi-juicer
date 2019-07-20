workflow "Build docker image" {
  resolves = [
    "Build Balacer",
    "Build Cleaner",
  ]
  on = "push"
}

action "Build Balacer" {
  uses = "pangzineng/Github-Action-One-Click-Docker@bfb4a810c8cb823f4a87c24da145caa707e297e9"
  secrets = ["DOCKER_PASSWORD", "DOCKER_USERNAME"]
  env = {
    DOCKER_IMAGE_NAME = "balancer"
    DOCKER_REGISTRY_URL = "docker.pkg.github.com"
    DOCKER_NAMESPACE = "j12934/juicy-ctf"
  }
  args = "./balancer/."
}

action "Build Cleaner" {
  uses = "pangzineng/Github-Action-One-Click-Docker@bfb4a810c8cb823f4a87c24da145caa707e297e9"
  secrets = ["DOCKER_PASSWORD", "DOCKER_USERNAME"]
  env = {
    DOCKER_IMAGE_NAME = "cleaner"
    DOCKER_REGISTRY_URL = "docker.pkg.github.com"
    DOCKER_NAMESPACE = "j12934/juicy-ctf"
  }
  args = "./cleaner/."
}
