# Example Setup with kubernetes(k8s)

**WARNING:** It takes into account that you already have k8s cluster setup.

## Prerequisites

This example expects you to have the following cli tools setup.

1. [helm](https://helm.sh)
2. [kubectl](https://kubernetes.io/docs/tasks/tools/)

## Step 1. Starting the cluster

```bash
# First we'll need to confirm things are running
# This should be instant, and return something along the lines of "Kubernetes control-plane is running at https://localhost:6443"
kubectl cluster-info
```

## Step 2. Installing MultiJuicer via helm

```bash
helm install multi-juicer oci://ghcr.io/juice-shop/multi-juicer/helm/multi-juicer

# kubernetes will now spin up the pods
# to verify every thing is starting up, run:
kubectl get pods

# This should show you two pods a balancer pod and a progress-watchdog pod
# Wait until both pods are ready
```

## Step 3. Verify the app is running correctly

This step is optional, but helpful to catch errors quicker.

```bash
# lets test out if the app is working correctly before proceeding
# for that we can port forward the JuiceBalancer service to your local machine
kubectl port-forward service/balancer 8080:8080

# Open up your browser for localhost:8080
# You should be able to see the MultiJuicer Balancer UI

# Try to create a team and see if everything works correctly
# You should be able to access a JuiceShop instances after a few seconds after creating a team,
# and after clicking the "Start Hacking" Button

# You can also try out if the admin UI works correctly
# Go back to localhost:8080/balancer
# To log in as the admin log in as the team "admin"
# The password for the team gets auto generated if not specified, you can extract it from the kubernetes secret:
kubectl get secrets balancer-secret -o=jsonpath='{.data.adminPassword}' | base64 --decode
```

## Step 4. Make a service to expose multi-juicer outside of the cluster

```bash
# make sure the balancer is running without errors.
kubectl get pods

# We got a example loadbalancer yaml for this example in the repository
wget https://raw.githubusercontent.com/juice-shop/multi-juicer/main/guides/k8s/k8s-juice-service.yaml

# Create the loadbalancer
# This might take a couple of minutes
kubectl apply -f k8s-juice-service.yaml

# If it takes longer than a few minutes take a detailed look at the loadbalancer
kubectl describe svc multi-juicer-loadbalancer
```

## Step 5. Deinstallation

```bash
helm uninstall multi-juicer

# Delete the loadbalancer
kubectl delete -f k8s-juice-service.yaml
```
