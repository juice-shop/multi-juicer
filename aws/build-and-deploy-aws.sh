#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to an AWS cluster cluster"
echo "Make sure you have updated your AWS credentials and your kubeconfig prior to executing this!"
echo "For this to work the AWS kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "NOTE: WE ARE WORKING HERE WITH A 5 LEGGED LOAD BALANCER on AWS which costs money by themselves!"

echo "NOTE 2: You can replace balancer.cookie.cookieParserSecret with a value you fancy."
echo "Note 3: Ensure you turn TLS on :)."

echo "Usage: ./build-and-deploy-aws.sh "

source ./../scripts/check-available-commands.sh
checkCommandsAvailable helm aws kubectl eksctl sed

if test -n "${AWS_REGION-}"; then
  echo "AWS_REGION is set to <$AWS_REGION>"
else
  export AWS_REGION=eu-west-1
  echo "AWS_REGION is not set or empty, defaulting to ${AWS_REGION}"
fi

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

ACCOUNT_ID=$(aws sts get-caller-identity | jq '.Account' -r)
echo "ACCOUNT_ID=${ACCOUNT_ID}"

CLUSTERNAME="$(terraform output -raw cluster_name)"
STATE_BUCKET="$(terraform output -raw state_bucket_name)"
IRSA_ROLE_ARN="$(terraform output -raw irsa_role_arn)"
EBS_ROLE_ARN="$(terraform output -raw ebs_role_arn)"
CLUSTER_AUTOSCALER_ROLE_ARN="$(terraform output -raw cluster_autoscaler_role_arn)"

echo "CLUSTERNAME=${CLUSTERNAME}"
echo "STATE_BUCKET=${STATE_BUCKET}"
echo "IRSA_ROLE_ARN=${IRSA_ROLE_ARN}"
echo "EBS_ROLE_ARN=${EBS_ROLE_ARN}"
echo "CLUSTER_AUTOSCALER_ROLE_ARN=${CLUSTER_AUTOSCALER_ROLE_ARN}"

version="$(uuidgen)"

aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTERNAME --kubeconfig ~/.kube/wrongsecrets

export KUBECONFIG=~/.kube/wrongsecrets

echo "If the below output is different than expected: please hard stop this script (running aws sts get-caller-identity first)"

aws sts get-caller-identity

echo "Giving you 4 seconds before we add autoscaling"

sleep 4

echo "Deploying the k8s autoscaler for eks through kubectl"

curl -o cluster-autoscaler-autodiscover.yaml https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
sed -i -e "s|<YOUR CLUSTER NAME>|$CLUSTERNAME|g" cluster-autoscaler-autodiscover.yaml

kubectl apply -f cluster-autoscaler-autodiscover.yaml

echo "annotating service account for cluster-autoscaler"
kubectl annotate serviceaccount cluster-autoscaler \
  -n kube-system --overwrite \
  eks.amazonaws.com/role-arn=${CLUSTER_AUTOSCALER_ROLE_ARN}

kubectl patch deployment cluster-autoscaler \
  -n kube-system \
  -p '{"spec":{"template":{"metadata":{"annotations":{"cluster-autoscaler.kubernetes.io/safe-to-evict": "false"}}}}}'

kubectl set image deployment cluster-autoscaler \
  -n kube-system \
  cluster-autoscaler=k8s.gcr.io/autoscaling/cluster-autoscaler:v1.25.0

helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm list --namespace kube-system | grep 'csi-secrets-store' &>/dev/null
if [ $? == 0 ]; then
  echo "CSI driver is already installed"
else
  helm upgrade --install -n kube-system csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver --set enableSecretRotation=true --set rotationPollInterval=60s
fi

echo "Patching default namespace"
kubectl apply -f k8s/workspace-psa.yml

echo "Install ACSP"
kubectl apply -f https://raw.githubusercontent.com/aws/secrets-store-csi-driver-provider-aws/main/deployment/aws-provider-installer.yaml

echo "preparing calico via Helm"
helm repo add projectcalico https://docs.projectcalico.org/charts
helm upgrade --install calico projectcalico/tigera-operator --version v3.21.4

echo "Generate secrets manager challenge secret 2"
aws secretsmanager put-secret-value --secret-id wrongsecret-2 --secret-string "$(openssl rand -base64 24)" --region $AWS_REGION --output json --no-cli-pager

echo "Generate Parameter store challenge secret"
aws ssm put-parameter --name wrongsecretvalue --overwrite --type SecureString --value "$(openssl rand -base64 24)" --region $AWS_REGION --output json --no-cli-pager

echo "Installing metrics api-server"
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

wait

# if passed as arguments, use those
# otherwise, create new default values

if [[ -z $APP_PASSWORD ]]; then
  echo "No app password passed, creating a new one"
  APP_PASSWORD="$(uuidgen)"
else
  echo "App password already set"
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
  --set="balancer.env.K8S_ENV=aws" \
  --set="balancer.env.IRSA_ROLE=${IRSA_ROLE_ARN}" \
  --set="balancer.env.REACT_APP_ACCESS_PASSWORD=${APP_PASSWORD}" \
  --set="balancer.env.REACT_APP_S3_BUCKET_URL=s3://${STATE_BUCKET}" \
  --set="balancer.env.REACT_APP_CREATE_TEAM_HMAC_KEY=${CREATE_TEAM_HMAC}" \
  --set="balancer.cookie.cookieParserSecret=${COOKIE_PARSER_SECRET}"

# Install CTFd
echo "Installing CTFd"

export HELM_EXPERIMENTAL_OCI=1
kubectl create namespace ctfd

# Double base64 encoding to prevent weird character errors in ctfd
helm upgrade --install ctfd -n ctfd oci://ghcr.io/bman46/ctfd/ctfd \
  --set="redis.auth.password=$(openssl rand -base64 24 | base64)" \
  --set="mariadb.auth.rootPassword=$(openssl rand -base64 24 | base64)" \
  --set="mariadb.auth.password=$(openssl rand -base64 24 | base64)" \
  --set="mariadb.auth.replicationPassword=$(openssl rand -base64 24 | base64)" \
  --set="env.open.SECRET_KEY=test" # this key isn't actually necessary in a setup with CTFd
