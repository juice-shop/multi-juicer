# Example Setup with OpenShift

**NOTE:** This Guide was tested with OpenShift 3.11, if this doesn't work with newer OpenShift versions please open up an issue. Thank you! 👏

## Prerequisites

This example expects you to have the following prerequisites.

1. A running OpenShift Cluster
2. [oc](https://github.com/openshift/origin/releases), OpenShift CLI
3. [helm](https://helm.sh), helm3 recommended, to avoid tiller headache

## Step 1. Log into the OpenShift cluster

```bash
# Log in with your OpenShift CLI
# You can copy the login command including your token from the web ui
oc login https://console.openshift.example.com --token=****

# Create a new project to hold the juicy-ctf resources
oc new-project juicy-ctf
```

## Step 2. Installing JuicyCTF via helm

```bash
# You'll need to add the juicy-ctf helm repo to your helm repos
helm repo add juicy-ctf https://iteratec.github.io/juicy-ctf/

# Before we can install the cluster we need to change one config option, which clashes with OpenShifts security context
# For that download the OpenShift overrides config file
wget https://raw.githubusercontent.com/iteratec/juicy-ctf/master/guides/openshift/openshift-helm-overrides.yaml

# for helm 2
helm install juicy-ctf/juicy-ctf --name juicy-ctf -f openshift-helm-overrides.yaml ./juicy-ctf/helm/juicy-ctf/

# for helm 3
helm install juicy-ctf juicy-ctf/juicy-ctf -f openshift-helm-overrides.yaml ./juicy-ctf/helm/juicy-ctf/
```

## Step 3. Verify the app is running correctly

This step is optional, but helpful to catch errors quicker.

```bash
# lets test out if the app is working correctly before proceeding
# for that we can port forward the JuiceBalancer service to your local machine
oc port-forward service/juice-balancer 3000:3000

# Open up your browser for localhost:3000
# You should be able to see the JuicyCTF Balancer UI

# Try to create a team and see if everything works correctly
# You should be able to access a JuiceShop instances after a few seconds after creating a team,
# and after clicking the "Start Hacking" Button

# You can also try out if the admin UI works correctly
# Go back to localhost:3000/balancer
# To log in as the admin log in as the team "admin"
# The password for the team gets auto generated if not specified, you can extract it from the kubernetes secret:
oc get secrets juice-balancer-secret -o=jsonpath='{.data.adminPassword}' | base64 --decode
```

## Step 4. Add a route to expose the app to the world

OpenShift lets you create routes to expose your app to the internet.

```bash
# Create the route.
# Make sure to adjust the hostname to match the one of your org.
# You can also perform this step easily via the OpenShift web ui.
oc create route edge juice-balancer --service juice-balancer --hostname juicy-ctf.cloudapps.example.com
```

## Step 4. Deinstallation

```bash
helm delete juicy-ctf
# helm will not delete the persistent volumes for redis!
# delete them by running:
oc delete persistentvolumeclaims redis-data-juicy-ctf-redis-master-0 redis-data-juicy-ctf-redis-slave-0

# Delete the route
oc delete route edge juice-balancer
```
