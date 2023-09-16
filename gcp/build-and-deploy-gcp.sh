#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to an GCP Kubernetes cluster"
echo "Make sure you have updated your GCP credentials and your kubeconfig prior to executing this!"
echo "For this to work the GCP kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "NOTE: WE ARE WORKING HERE WITH LOAD BALANCERS on GCP which costs money by themselves!"

echo "NOTE 2: You can replace balancer.cookie.cookieParserSecret with a value you fancy."
echo "Note 3: Ensure you turn TLS on :)."

echo "Usage: ./build-and-deploy-gcp.sh "

source ../scripts/check-available-commands.sh

checkCommandsAvailable helm jq sed grep cat gcloud envsubst


echo "Checking for compatible shell"
case "$SHELL" in
*bash*)
    echo "BASH detected"
    ;;
*zsh*)
    echo "ZSH detected"
    ;;
*)
    echo "🛑🛑 Unknown shell $SHELL, this script has only been tested on BASH and ZSH. Please be aware there may be some issues 🛑🛑"
    sleep 2
    ;;
esac

echo "This is a script to bootstrap the configuration. You need to have installed: helm, kubectl, jq, grep, cat, sed, envsubst, and google cloud cli, and is only tested on mac, Debian and Ubuntu"

export GCP_PROJECT=$(gcloud config list --format 'value(core.project)' 2>/dev/null)

# Patch the default namespace to use the secrets store CSI driver

echo "Setting up workspace PSA to restricted for default"
kubectl apply -f k8s/workspace-psa.yml


echo "Add secrets manager driver to repo"
helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts

helm list --namespace kube-system | grep 'csi-secrets-store' &>/dev/null
if [ $? == 0 ]; then
  echo "CSI driver is already installed"
else
  helm install -n kube-system csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver --set enableSecretRotation=true --set rotationPollInterval=60s
fi

kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/secrets-store-csi-driver-provider-gcp/main/deploy/provider-gcp-plugin.yaml

echo "Generate secret manager challenge secret 2"
echo -n "$(openssl rand -base64 16)" |
  gcloud secrets versions add wrongsecret-2 --data-file=-

echo "Generate secret manager challenge secret 3"
echo -n "$(openssl rand -base64 16)" |
  gcloud secrets versions add wrongsecret-3 --data-file=-

echo "Fill-out the secret volume manifest template"
envsubst <./k8s/secret-volume.yml.tpl >./k8s/secret-volume.yml

echo "Apply secretsmanager storage volume"
kubectl apply -f./k8s/secret-volume.yml


envsubst <./k8s/secret-challenge-vault-deployment.yml.tpl >./k8s/secret-challenge-vault-deployment.yml

echo "Installing metrics api-server"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

wait


# if passed as arguments, use those
# otherwise, create new default values

if [[ -z $APP_PASSWORD ]]; then
  echo "No app password passed, creating a new one"
  APP_PASSWORD="$( uuidgen | sed 's/[-]//g')"
else
  echo "App password already set to ${APP_PASSWORD}"
fi

if [[ -z $CREATE_TEAM_HMAC ]]; then
  CREATE_TEAM_HMAC="$(openssl rand -base64 24)"
else
  echo "Create team HMAC already set"
fi

if [[ -z $COOKIE_PARSER_SECRET ]]; then
  COOKIE_PARSER_SECRET="$(openssl rand -base64 24)"
else
  echo "Cookie parser secret already set"
fi

echo "App password is ${APP_PASSWORD}" > password.txt

echo "You can find the app password in password.txt"

helm upgrade --install mj ../helm/wrongsecrets-ctf-party \
  --set="balancer.env.K8S_ENV=gcp" \
  --set="balancer.env.REACT_APP_ACCESS_PASSWORD=${APP_PASSWORD}" \
  --set="balancer.env.REACT_APP_CREATE_TEAM_HMAC_KEY=${CREATE_TEAM_HMAC}" \
  --set="balancer.cookie.cookieParserSecret=${COOKIE_PARSER_SECRET}" \
  --set="balancer.env.GCP_PROJECT_ID=${GCP_PROJECT}" \
  --set="balancer.repository=osamamagdy/wrongsecrets-balancer" \

kubectl annotate serviceaccount \
  --namespace default wrongsecrets-balancer \
  "iam.gke.io/gcp-service-account=wrongsecrets-workload-sa@${GCP_PROJECT}.iam.gserviceaccount.com"

# Install CTFd
echo "Installing CTFd"

export HELM_EXPERIMENTAL_OCI=1
kubectl create namespace ctfd

# Double base64 encoding to prevent weird character errors in ctfd
helm upgrade --install ctfd -n ctfd oci://ghcr.io/bman46/ctfd/ctfd --version 0.6.3 \
  --values ./k8s/ctfd-values.yaml \
  --set="redis.auth.password=$(openssl rand -base64 24 | base64)" \
  --set="mariadb.auth.rootPassword=$(openssl rand -base64 24 | base64)" \
  --set="mariadb.auth.password=$(openssl rand -base64 24 | base64)" \
  --set="mariadb.auth.replicationPassword=$(openssl rand -base64 24 | base64)" \
  --set="env.open.SECRET_KEY=test" # this key isn't actually necessary in a setup with CTFd
