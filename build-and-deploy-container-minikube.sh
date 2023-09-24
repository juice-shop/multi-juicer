#!/usr/bin/env bash

source ./scripts/check-available-commands.sh
checkCommandsAvailable helm docker kubectl yq minikube

minikube delete
minikube start  --cpus=6 --memory=8000MB --network-plugin=cni --cni=calico --driver=docker --kubernetes-version=1.25.6
eval $(minikube docker-env)
./build-and-deploy-container.sh

sleep 5

echo "let's go!"

wait 10

kubectl port-forward service/wrongsecrets-balancer 3000:3000 &

echo "Balancer is running on http://localhost:3000"

wait 10

kubectl port-forward svc/wrongsecrets-grafana 8080:80 &

echo "Grafana is running on http://localhost:8080"
