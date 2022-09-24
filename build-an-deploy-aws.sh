#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to an AWS cluster cluster"
echo "Make sure you have updated your AWS credentials and your kubeconfig prior to executing this!"
echo "For this to work the AWS kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "NOTE: WE ARE WORKING HERE WITH A 5 LEGGED BALANCER on aWS which costs money by themselves!"

echo "NOTE2: please replace balancer.cookie.cookieParserSecret witha value you fanchy and ensure you have TLS on (see outdated guides)."

echo "Usage: ./build-an-deploy-aws.sh"

source ./scripts/check-available-commands.sh
checkCommandsAvailable helm aws kubectl

version="$(uuidgen)"

AWS_REGION="eu-west-1"

helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm list --namespace kube-system | grep 'csi-secrets-store' &>/dev/null
if [ $? == 0 ]; then
  echo "CSI driver is already installed"
else
  helm upgrade --install -n kube-system csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver --set enableSecretRotation=true --set rotationPollInterval=60s
fi

echo "Install ACSP"
kubectl apply -f https://raw.githubusercontent.com/aws/secrets-store-csi-driver-provider-aws/main/deployment/aws-provider-installer.yaml

echo "preparing calico via Helm"
helm repo add projectcalico https://docs.projectcalico.org/charts
helm upgrade --install calico projectcalico/tigera-operator --version v3.21.4

echo "Generate secrets manager challenge secret 2"
aws secretsmanager put-secret-value --secret-id wrongsecret-2 --secret-string "$(openssl rand -base64 24)" --region $AWS_REGION --output json --no-cli-pager

echo "Generate Parameter store challenge secret"
aws ssm put-parameter --name wrongsecretvalue --overwrite --type SecureString --value "$(openssl rand -base64 24)" --region $AWS_REGION --output json --no-cli-pager


wait

#TODO: REWRITE ABOVE, REWRITE THE HARDCODED DEPLOYMENT VALS INTO VALUES AND OVERRIDE THEM HERE!
helm upgrade --install mj ./helm/wrongsecrets-ctf-party --set="imagePullPolicy=Always" --set="balancer.env.K8S_ENV=aws" --set="balancer.cookie.cookieParserSecret=thisisanewrandomvaluesowecanworkatit" --set="balancer.repository=jeroenwillemsen/wrongsecrets-balancer" --set="balancer.tag=0.86aws" --set="balancer.replicas=4" --set="wrongsecretsCleanup.repository=jeroenwillemsen/wrongsecrets-ctf-cleaner" --set="wrongsecretsCleanup.tag=0.2"
