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
    DOCKER_IMAGE_NAME = "juice-balancer"
    DOCKER_NAMESPACE = "iteratec"
  }
  args = "./juice-balancer/"
}

action "Build'n Push Cleaner" {
  uses = "pangzineng/Github-Action-One-Click-Docker@bfb4a810c8cb823f4a87c24da145caa707e297e9"
  secrets = ["DOCKER_PASSWORD", "DOCKER_USERNAME"]
  env = {
    DOCKER_NAMESPACE = "iteratec"
    DOCKER_IMAGE_NAME = "juice-cleaner"
  }
  args = "./cleaner/"
}
