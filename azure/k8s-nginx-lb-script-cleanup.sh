#!/bin/bash
# set -o errexit
# set -o pipefail
# set -o nounset
source ../scripts/check-available-commands.sh
checkCommandsAvailable helm az kubectl

export RESOURCE_GROUP="$(terraform output -raw resource_group)"
export CLUSTER_NAME="$(terraform output -raw cluster_name)"

echo "cleanup k8s ingress and service. This may take a while"
kubectl delete service wrongsecrets-balancer
kubectl delete ingress wrongsecrets-balancer

kubectl delete service ctfd


echo "If you applied the ctfd ingress, you need to delete it manually"

# kubectl delete ingress ctfd -n ctfd

# Give some time for the controller to remove cleaned ingresses
sleep 5

echo "Cleanup helm chart"
helm uninstall ingress-nginx \
  -n ingress-nginx

echo "Delete the namespace"

kubectl delete namespace ingress-nginx

echo "You can now delete the resource group $RESOURCE_GROUP and the cluster $CLUSTER_NAME"
