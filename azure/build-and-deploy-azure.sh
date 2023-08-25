#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to an Azure Kubernetes cluster"
echo "Make sure you have updated your Azure credentials and your kubeconfig prior to executing this!"
echo "For this to work the Azure kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "NOTE: WE ARE WORKING HERE WITH LOAD BALANCERS on Azure which costs money by themselves!"

echo "NOTE 2: You can replace balancer.cookie.cookieParserSecret with a value you fancy."
echo "Note 3: Ensure you turn TLS on :)."

echo "Usage: ./build-and-deploy-azure.sh "

source ../scripts/check-available-commands.sh

checkCommandsAvailable helm vault jq sed grep cat az envsubst

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

echo "This is a script to bootstrap the configuration. You need to have installed: helm, kubectl, vault, grep, cat, sed, envsubst, and azure cli, and is only tested on mac, Debian and Ubuntu"

# The storage account to store the terraform state file
export AZ_STORAGE_ACCOUNT="$(terraform -chdir=./shared-state output -raw storage_account_name)"


# Most of the variables below are used in envsubst later.
export AZURE_SUBSCRIPTION_ID="$(az account show --query id --output tsv)"
export AZURE_TENANT_ID="$(az account show --query tenantId --output tsv)"

export RESOURCE_GROUP="$(terraform output -raw resource_group)"
export CLUSTER_NAME="$(terraform output -raw cluster_name)"

# for this demo, we will be deploying a user-assigned identity to the AKS node resource group
export IDENTITY_RESOURCE_GROUP="$(az aks show -g ${RESOURCE_GROUP} -n ${CLUSTER_NAME} --query nodeResourceGroup -otsv)"
export IDENTITY_NAME="wrongsecrets-identity"

export AZ_POD_RESOURCE_ID="$(terraform output -raw aad_pod_identity_resource_id)"
export AZ_POD_CLIENT_ID="$(terraform output -raw aad_pod_identity_client_id)"

export AZ_EXTRA_POD_RESOURCE_ID="$(terraform output -raw aad_extra_pod_identity_resource_id)"
export AZ_EXTRA_POD_CLIENT_ID="$(terraform output -raw aad_extra_pod_identity_client_id)"

export AZ_VAULT_URI="$(terraform output -raw vault_uri)"
export AZ_KEY_VAULT_TENANT_ID="$(terraform output -raw tenant_id)"
export AZ_KEY_VAULT_NAME="$(terraform output -raw vault_name)"

# Set the kubeconfig
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME


# Install the secrets store CSI driver
helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm list --namespace kube-system | grep 'csi-secrets-store' &>/dev/null
if [ $? == 0 ]; then
  echo "CSI driver is already installed"
else
  helm upgrade --install -n kube-system csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver --set enableSecretRotation=true --set rotationPollInterval=60s
fi

# Patch the default namespace to use the secrets store CSI driver
echo "Patching default namespace"
kubectl apply -f k8s/workspace-psa.yml


# Install the secrets store CSI driver provider for Azure Key Vault
helm repo add csi-secrets-store-provider-azure https://azure.github.io/secrets-store-csi-driver-provider-azure/charts

helm list --namespace kube-system | grep 'csi-secrets-store' &>/dev/null
if [ $? == 0 ]; then
  echo "CSI driver is already installed"
else
  echo "Installing CSI driver"
  helm install csi csi-secrets-store-provider-azure/csi-secrets-store-provider-azure --namespace kube-system
fi

#TO BE REPLACED WITH https://azure.github.io/azure-workload-identity/docs/installation.html
echo "Add Azure pod identity to repo"
helm repo add aad-pod-identity https://raw.githubusercontent.com/Azure/aad-pod-identity/master/charts

helm list --namespace kube-system | grep 'aad-pod-identity' &>/dev/null
if [ $? == 0 ]; then
  echo "Azure pod identity chart already installed"
else
  helm upgrade --install aad-pod-identity aad-pod-identity/aad-pod-identity #NO LONGER WORKS BECAUSE OF OUR CONFIUGRATION (RESTRICTED IN DEFAULT)
fi

#END TO BE REPLACED WITH https://azure.github.io/azure-workload-identity/docs/installation.html


# Preparing calico via Helm
echo "preparing calico via Helm"
helm repo add projectcalico https://docs.projectcalico.org/charts
helm upgrade --install calico projectcalico/tigera-operator


echo "Generate secret manager challenge secret 2"
az keyvault secret set --name wrongsecret-2 --vault-name "${AZ_KEY_VAULT_NAME}" --value "$(openssl rand -base64 16)" >/dev/null

echo "Generate secret manager challenge secret 3"
az keyvault secret set --name wrongsecret-3 --vault-name "${AZ_KEY_VAULT_NAME}" --value "$(openssl rand -base64 16)" >/dev/null

echo "Fill-out the secret volume manifest template"
envsubst <./k8s/secret-volume.yml.tpl >./k8s/secret-volume.yml

echo "Apply secretsmanager storage volume"
kubectl apply -f./k8s/secret-volume.yml

envsubst <./k8s/pod-id.yml.tpl >./k8s/pod-id.yml
envsubst <./k8s/secret-challenge-vault-deployment.yml.tpl >./k8s/secret-challenge-vault-deployment.yml

kubectl apply -f./k8s/pod-id.yml

while [[ $(kubectl --namespace=default get pods -l "app.kubernetes.io/component=mic" -o 'jsonpath={..status.conditions[?(@.type=="Ready")].status}') != "True True" ]]; do echo "waiting for component=mic" && sleep 2; done
while [[ $(kubectl --namespace=default get pods -l "app.kubernetes.io/component=nmi" -o 'jsonpath={..status.conditions[?(@.type=="Ready")].status}') != "True True True" ]]; do echo "waiting for component=nmi" && sleep 2; done


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

echo "App password is ${APP_PASSWORD}"
helm upgrade --install mj ../helm/wrongsecrets-ctf-party \
  --set="balancer.env.K8S_ENV=azure" \
  --set="balancer.env.REACT_APP_S3_BUCKET_URL='Azure Storage Account: ${AZ_STORAGE_ACCOUNT}'" \
  --set="balancer.env.REACT_APP_ACCESS_PASSWORD=${APP_PASSWORD}" \
  --set="balancer.env.REACT_APP_CREATE_TEAM_HMAC_KEY=${CREATE_TEAM_HMAC}" \
  --set="balancer.cookie.cookieParserSecret=${COOKIE_PARSER_SECRET}"

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
