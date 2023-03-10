#!/bin/bash
# set -o errexit
# set -o pipefail
# set -o nounset

source ../scripts/check-available-commands.sh

checkCommandsAvailable helm jq vault sed grep docker grep cat aws curl eksctl kubectl

if test -n "${AWS_REGION-}"; then
  echo "AWS_REGION is set to <$AWS_REGION>"
else
  AWS_REGION=eu-west-1
  echo "AWS_REGION is not set or empty, defaulting to ${AWS_REGION}"
fi

if test -n "${CLUSTERNAME-}"; then
  echo "CLUSTERNAME is set to <$CLUSTERNAME>"
else
  CLUSTERNAME=wrongsecrets-exercise-cluster
  echo "CLUSTERNAME is not set or empty, defaulting to ${CLUSTERNAME}"
fi

ACCOUNT_ID=$(aws sts get-caller-identity | jq '.Account' -r)
echo "ACCOUNT_ID=${ACCOUNT_ID}"

echo "cleanup k8s ingress and service. This may take a while"
kubectl delete service wrongsecrets-balancer
kubectl delete ingress wrongsecrets-balancer

kubectl delete ingress ctfd -n ctfd

# Give some time for the controller to remove cleaned ingresses
sleep 5

echo "Cleanup helm chart"
helm uninstall aws-load-balancer-controller \
  -n kube-system

echo "Cleanup k8s ALB"
kubectl delete -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller//crds?ref=master"
