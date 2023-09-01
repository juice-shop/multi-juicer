#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to a local kubernetes cluster"
echo "For this to work the local kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "Usage: ./build-and-deploy.sh"

source ./scripts/check-available-commands.sh
checkCommandsAvailable helm docker kubectl yq

version="$(uuidgen)"
eval $(minikube docker-env)
docker login
WRONGSECRETS_IMAGE=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.wrongsecrets.image')
WRONGSECRETS_TAG=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.wrongsecrets.tag')
WEBTOP_IMAGE=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.virtualdesktop.image')
WEBTOP_TAG=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.virtualdesktop.tag')
echo "Pulling in required images to actually run $WRONGSECRETS_IMAGE:$WRONGSECRETS_TAG & $WEBTOP_IMAGE:$WEBTOP_TAG."
echo "If you see an authentication failure: pull them manually by the following 2 commands"
echo "'docker pull $WRONGSECRETS_IMAGE:$WRONGSECRETS_TAG'"
echo "'docker pull $WEBTOP_IMAGE:$WEBTOP_TAG'" &
docker pull $WRONGSECRETS_IMAGE:$WRONGSECRETS_TAG &
docker pull $WEBTOP_IMAGE:$WEBTOP_TAG &
docker build -t local/wrongsecrets-balancer:$version ./wrongsecrets-balancer &
docker build -t local/cleaner:$version ./cleaner &
wait

helm upgrade --install mj ./helm/wrongsecrets-ctf-party --set="imagePullPolicy=Never" --set="balancer.repository=local/wrongsecrets-balancer" --set="balancer.tag=$version" --set="wrongsecretsCleanup.repository=local/cleaner" --set="wrongsecretsCleanup.tag=$version"
