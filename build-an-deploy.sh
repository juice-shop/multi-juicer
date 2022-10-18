#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to a local kubernetes cluster"
echo "For this to work the local kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "Usage: ./build-an-deploy.sh"

source ./scripts/check-available-commands.sh
checkCommandsAvailable helm docker kubectl

version="$(uuidgen)"

docker build -t local/wrongsecrets-balancer:$version ./wrongsecrets-balancer &
docker build -t local/cleaner:$version ./cleaner &
docker pull jeroenwillemsen/wrongsecrets:1.5.8-no-vault 
wait

helm upgrade --install mj ./helm/wrongsecrets-ctf-party --set="imagePullPolicy=Never" --set="balancer.repository=local/wrongsecrets-balancer" --set="balancer.tag=$version" --set="wrongsecretsCleanup.repository=local/cleaner" --set="wrongsecretsCleanup.tag=$version"
