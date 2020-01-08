# [WIP] Example Setup with Microsoft Azure

**NOTE:** This Guide is still a "Work in Progress", if you got any recommendations or issues with it, please post them into the related issue: https://github.com/iteratec/multi-juicer/issues/16

**WARNING:** The resources created in this guid will cost about \$??/month.
Make sure to delete the resources as described in Step 5 Deinstallation when you do not need them anymore.

## 1. Starting the cluster

```sh
# Before we can do anything we need a resource group
az group create --location westeurope --name multi-juicer

# let's create the cluster now
# I decreased the node count to 2, to dodge the default core limit
az aks create --resource-group multi-juicer --name juicy-k8s --node-count 2

# now to authenticate fetch the credentials for the new cluster
az aks get-credentials --resource-group multi-juicer --name juicy-k8s

# verify by running
# should print "juicy-k8s"
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

Hoping for https://docs.microsoft.com/en-us/azure/aks/load-balancer-standard to come soon. I don't want to explain how to configure k8s ingress.
