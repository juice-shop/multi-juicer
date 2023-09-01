#!/usr/bin/env bash

source ./scripts/check-available-commands.sh
checkCommandsAvailable helm docker kubectl yq minikube

minikube delete
minikube start  --cpus=6 --memory=8000MB --network-plugin=cni --cni=calico --driver=docker --kubernetes-version=1.25.6
eval $(minikube docker-env)
./build-and-deploy-container.sh

sleep 5

echo "let's go!"

kubectl port-forward service/wrongsecrets-balancer 3000:3000
