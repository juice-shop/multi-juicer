#!/usr/bin/env bash

echo "This Script can be used to 'easily' build all MultiJuicer components and install them to a local kubernetes cluster"
echo "For this to work the local kubernetes cluster must have access to the same local registry / image cache which 'docker build ...' writes its image to"
echo "For example docker-desktop with its included k8s cluster"

echo "Usage: ./build-and-deploy.sh"

version="$(uuidgen)"

docker build --progress plain -f containers/cleaner/Dockerfile -t local/cleaner:$version . &
docker build --progress plain -f containers/progress-watchdog/Dockerfile -t local/progress-watchdog:$version . &
docker build --progress plain -f containers/balancer/Dockerfile -t local/balancer:$version . &

wait

if [ "$(kubectl config current-context)" = "kind-kind" ]; then
  kind load docker-image "local/progress-watchdog:$version" &
  kind load docker-image "local/cleaner:$version" &
  kind load docker-image "local/balancer:$version" &

  wait
fi

helm upgrade --install multi-juicer ./helm/multi-juicer \
  --set="imagePullPolicy=IfNotPresent" \
  --set="balancer.repository=local/balancer" \
  --set="balancer.tag=$version" \
  --set="progressWatchdog.repository=local/progress-watchdog" \
  --set="progressWatchdog.tag=$version" \
  --set="juiceShopCleanup.repository=local/cleaner" \
  --set="juiceShopCleanup.tag=$version" \
  --set="balancer.cookie.cookieParserSecret=dev-secret"

