# Example Setup with Digital Ocean

**WARNING:** The resources created in this guide will cost about \$45.00/month.
Make sure to delete the resources as described in "Step 5 Deinstallation" when you do not need them anymore.

## Prerequisites

This example expects you to have the following cli tools setup.

1. [doctl](https://github.com/digitalocean/doctl)
2. [helm](https://helm.sh)
3. [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/#install-kubectl-on-macos)

## Step 1. Starting the cluster

```bash
# First we'll need a cluster, you can create one using the DigitalOcean cli.
# This will take a couple of minutes
doctl kubernetes cluster create juicy-k8s

# After completion verify that your kubectl context has been updated:
# Should print something like: do-nyc1-juicy-k8s
kubectl config current-context
```

## Step 2. Installing MultiJuicer via helm

```bash
# You'll need to add the multi-juicer helm repo to your helm repos
helm repo add multi-juicer https://iteratec.github.io/multi-juicer/

# for helm <= 2
helm install multi-juicer/multi-juicer --name multi-juicer

# for helm >= 3
helm install multi-juicer multi-juicer/multi-juicer

# kubernetes will now spin up the pods
# to verify every thing is starting up, run:
kubectl get pods
# This should show you three pods a juice-balancer pod and two redis pods
# Wait until all 3 pods are ready
```

## Step 3. Verify the app is running correctly

This step is optional, but helpful to catch errors quicker.

```bash
# lets test out if the app is working correctly before proceeding
# for that we can port forward the JuiceBalancer service to your local machine
kubectl port-forward service/juice-balancer 3000:3000

# Open up your browser for localhost:3000
# You should be able to see the MultiJuicer Balancer UI

# Try to create a team and see if everything works correctly
# You should be able to access a JuiceShop instances after a few seconds after creating a team,
# and after clicking the "Start Hacking" Button

# You can also try out if the admin UI works correctly
# Go back to localhost:3000/balancer
# To log in as the admin log in as the team "admin"
# The password for the team gets auto generated if not specified, you can extract it from the kubernetes secret:
kubectl get secrets juice-balancer-secret -o=jsonpath='{.data.adminPassword}' | base64 --decode
```

## Step 4. Add a LoadBalancer to expose the app to the world

DigitalOcean lets you create a DigitalOcean Loadbalancer to expose your kubernetes deployment without having to setup the whole kubernetes ingress stuff. This makes it especially easy if you also manage your domains in DigitalOcean as DigitalOcean will also be able to provide you with the tls certificates.

```bash

# Get you digitalocean cert id
doctl compute certificate list

# We got a example loadbalancer yaml for this example in the repository
# Edit the cert id in do-lb.yaml to the cert id of your domain
wget https://raw.githubusercontent.com/iteratec/multi-juicer/master/guides/digital-ocean/do-lb.yaml
vim do-lb.yaml

# Create the loadbalancer
# This might take a couple of minutes
kubectl create -f do-lb.yaml

# If it takes longer than a few minutes take a detailed look at the loadbalancer
kubectl describe services multi-juicer-loadbalancer
```

## Step 5. Deinstallation

```bash
helm delete multi-juicer
# helm will not delete the persistent volumes for redis!
# these cost $1.60/month ($0.10/GB/month)
# delete them by running:
kubectl delete persistentvolumeclaims redis-data-multi-juicer-redis-master-0 redis-data-multi-juicer-redis-slave-0

# Delete the loadbalancer
kubectl delete -f do-lb.yaml

# Delete the kubernetes cluster
doctl kubernetes cluster delete juicy-k8s
```
