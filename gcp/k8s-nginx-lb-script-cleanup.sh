#!/bin/bash
# set -o errexit
# set -o pipefail
# set -o nounset
source ../scripts/check-available-commands.sh
checkCommandsAvailable gcloud kubectl

export GCP_PROJECT=$(gcloud config list --format 'value(core.project)' 2>/dev/null)

echo "cleanup k8s ingress and service. This may take a while"

kubectl delete service wrongsecrets-balancer

kubectl delete ingress wrongsecrets-balancer

kubectl delete service ctfd

echo "If you applied the ctfd ingress, you need to delete it manually"

# kubectl delete ingress ctfd -n ctfd

# Give some time for the controller to remove cleaned ingresses
sleep 5

echo "Delete the nginx-ingress namespace"

kubectl delete namespace ingress-nginx

echo "Fecthing network endpoint groups. If this yields results, clean them up:"
gcloud compute network-endpoint-groups list

echo "Finished Cleaning ingress, you can now delete everything else using terraform destroy"
