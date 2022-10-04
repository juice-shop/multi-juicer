#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to an AWS cluster cluster"
echo "Make sure you have updated your AWS credentials and your kubeconfig prior to executing this!"
echo "For this to work the AWS kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "NOTE: WE ARE WORKING HERE WITH A 5 LEGGED BALANCER on aWS which costs money by themselves!"

echo "NOTE2: please replace balancer.cookie.cookieParserSecret witha value you fanchy and ensure you have TLS on (see outdated guides)."

echo "Usage: ./build-an-deploy-aws.sh "

source ./../scripts/check-available-commands.sh
checkCommandsAvailable helm aws kubectl eksctl sed

if test -n "${AWS_REGION-}"; then
  echo "AWS_REGION is set to <$AWS_REGION>"
else
  AWS_REGION=eu-west-1
  echo "AWS_REGION is not set or empty, defaulting to ${AWS_REGION}"
fi

if test -n "${CLUSTERNAME-}"; then
  secho "CLUSTERNAME is set to <$CLUSTERNAME> which is different than the default. Please update the cluster-autoscaler-policy.json."
else
  CLUSTERNAME=wrongsecrets-exercise-cluster
  echo "CLUSTERNAME is not set or empty, defaulting to ${CLUSTERNAME}"
fi

ACCOUNT_ID=$(aws sts get-caller-identity | jq '.Account' -r)
echo "ACCOUNT_ID=${ACCOUNT_ID}"


version="$(uuidgen)"

AWS_REGION="eu-west-1"

echo "Install autoscaler first!"
echo "If the below output is different than expected: please hard stop this script (running aws sts get-caller-identity first)"

aws sts get-caller-identity

echo "Giving you 4 seconds before we add autoscaling"

sleep 4

echo "Installing policies and service accounts"

aws iam create-policy \
    --policy-name AmazonEKSClusterAutoscalerPolicy \
    --policy-document file://cluster-autoscaler-policy.json

echo "Installing iamserviceaccount"

eksctl create iamserviceaccount \
  --cluster=$CLUSTERNAME \
  --region=$AWS_REGION \
  --namespace=kube-system \
  --name=cluster-autoscaler \
  --attach-policy-arn=arn:aws:iam::${ACCOUNT_ID}:policy/AmazonEKSClusterAutoscalerPolicy \
  --override-existing-serviceaccounts \
  --approve

echo "Deploying the k8s autoscaler for eks through kubectl"

curl -o cluster-autoscaler-autodiscover.yaml https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
sed -i -e "s|<YOUR CLUSTER NAME>|$CLUSTERNAME|g" cluster-autoscaler-autodiscover.yaml

kubectl apply -f cluster-autoscaler-autodiscover.yaml

echo "annotating service account for cluster-autoscaler"
kubectl annotate serviceaccount cluster-autoscaler \
  -n kube-system \
  eks.amazonaws.com/role-arn=arn:aws:iam::${ACCOUNT_ID}:role/AmazonEKSClusterAutoscalerRole

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

DEFAULT_PASSWORD=thankyou
#TODO: REWRITE ABOVE, REWRITE THE HARDCODED DEPLOYMENT VALS INTO VALUES AND OVERRIDE THEM HERE!
echo "default password is ${DEFAULT_PASSWORD}"
helm upgrade --install mj ../helm/wrongsecrets-ctf-party --set="imagePullPolicy=Always" --set="balancer.env.K8S_ENV=aws" --set"balancer.env.IRSA_ROLE=arn:aws:iam::${ACCOUNT_ID}:role/wrongsecrets-secret-manager" --set="balancer.env.REACT_APP_ACCESS_PASSWORD=${DEFAULT_PASSWORD}" --set="balancer.cookie.cookieParserSecret=thisisanewrandomvaluesowecanworkatit" --set="balancer.repository=jeroenwillemsen/wrongsecrets-balancer" --set="balancer.tag=1.0aws" --set="balancer.replicas=4" --set="wrongsecretsCleanup.repository=jeroenwillemsen/wrongsecrets-ctf-cleaner" --set="wrongsecretsCleanup.tag=0.2"
