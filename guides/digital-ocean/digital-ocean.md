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
helm install multi-juicer oci://ghcr.io/juice-shop/multi-juicer/helm/multi-juicer

# kubernetes will now spin up the pods
# to verify every thing is starting up, run:
kubectl get pods
# This should show you two pods a juice-balancer pod and a progress-watchdog pod
# Wait until both pods are ready
```

If the juice-balancer pod is still pending status after a couple of minutes, the cluster may not have the necessary resources to provision the pod.

```bash
# This show details about the juice-balancer pod. Warnings can be found under Events, and the cluster 
# does not have the necessary resources if theres is a warning about insufficient CPU or memory.
kubectl describe pods juice-balancer
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
wget https://raw.githubusercontent.com/juice-shop/multi-juicer/main/guides/digital-ocean/do-lb.yaml
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

# Delete the loadbalancer
kubectl delete -f do-lb.yaml

# Delete the kubernetes cluster
doctl kubernetes cluster delete juicy-k8s
```
