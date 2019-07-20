workflow "Build docker image" {
  resolves = [
    "Build Balancer Image",
    "Push Balancer Image",
    "Push Cleaner Image",
  ]
  on = "push"
}

action "Login to Github Docker Registry" {
  uses = "actions/docker/login@8cdf801b322af5f369e00d85e9cf3a7122f49108"
  secrets = ["DOCKER_USERNAME", "DOCKER_PASSWORD"]
  env = {
    DOCKER_REGISTRY_URL = "docker.pkg.github.com"
  }
}

action "Build Balancer Image" {
  uses = "actions/docker/cli@8cdf801b322af5f369e00d85e9cf3a7122f49108"
  args = "build -t docker.pkg.github.com/j12934/juicy-ctf/balancer ./juice-balancer/"
  needs = ["Login to Github Docker Registry"]
}

action "Push Balancer Image" {
  uses = "actions/docker/cli@8cdf801b322af5f369e00d85e9cf3a7122f49108"
  needs = ["Build Balancer Image"]
  args = "push docker.pkg.github.com/j12934/juicy-ctf/balancer"
}

action "Build Cleaner Image" {
  uses = "actions/docker/cli@86ff551d26008267bb89ac11198ba7f1d807b699"
  needs = ["Login to Github Docker Registry"]
  args = "build -t docker.pkg.github.com/j12934/juicy-ctf/cleaner ./cleaner/"
}

action "Push Cleaner Image" {
  uses = "actions/docker/cli@86ff551d26008267bb89ac11198ba7f1d807b699"
  args = "push docker.pkg.github.com/j12934/juicy-ctf/cleaner"
  needs = ["Build Cleaner Image"]
}
