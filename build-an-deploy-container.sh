#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all WrongSecrets CTF party Components and install them to a local kubernetes cluster"
echo "For this to work the local kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "Usage: ./build-an-deploy.sh"

source ./scripts/check-available-commands.sh
checkCommandsAvailable helm docker kubectl yq

version="$(uuidgen)"
docker login
WRONGSECRETS_IMAGE=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.wrongsecrets.image')
WRONGSECRETS_TAG=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.wrongsecrets.tag')
WEBTOP_IMAGE=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.virtualdesktop.image')
WEBTOP_TAG=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.virtualdesktop.tag')
WRONGSECRETS_BALANCER_IMAGE=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.balancer.repository')
WRONGSECRETS_BALANCER_TAG=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.balancer.tag')
WRONGSECRETS_CLEANER_IMAGE=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.wrongsecretsCleanup.repository')
WRONGSECRETS_CLEANER_TAG=$(cat helm/wrongsecrets-ctf-party/values.yaml| yq '.wrongsecretsCleanup.tag')
echo "Pulling in required images to actually run $WRONGSECRETS_IMAGE:$WRONGSECRETS_TAG & $WEBTOP_IMAGE:$WEBTOP_TAG."
echo "If you see an authentication failure: pull them manually by the following 2 commands"
echo "'docker pull $WRONGSECRETS_IMAGE:$WRONGSECRETS_TAG'"
echo "'docker pull $WEBTOP_IMAGE:$WEBTOP_TAG'"
echo "'docker pull $WRONGSECRETS_BALANCER_IMAGE:$WRONGSECRETS_BALANCER_TAG'" &
echo "'docker pull $WRONGSECRETS_CLEANER_IMAGE:$WRONGSECRETS_CLEANER_TAG'" &
docker pull $WRONGSECRETS_IMAGE:$WRONGSECRETS_TAG &
docker pull $WEBTOP_IMAGE:$WEBTOP_TAG &
docker pull $WRONGSECRETS_BALANCER_IMAGE:$WRONGSECRETS_BALANCER_TAG &
docker pull $WRONGSECRETS_CLEANER_IMAGE:$WRONGSECRETS_CLEANER_TAG
wait

helm upgrade --install mj ./helm/wrongsecrets-ctf-party --set="imagePullPolicy=IfNotPresent"
