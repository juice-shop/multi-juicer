# Example Setup with Digital Ocean

## Prerequisites

This example expects you to have the following prerequisites.

1. A running OpenShift Cluster
2. [oc OpenShift CLI](https://github.com/openshift/origin/releases)
3. [helm](https://helm.sh) helm3 recommended, to avoid tiller headache

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
# We'll need to clone this git repo for the moment, as the helm chart isn't pushed to any registry
git clone git@github.com:iteratec/juicy-ctf.git

# First we'll need to fetch the charts JuicyCTF depends on
helm dependency update ./juicy-ctf/helm/juicy-ctf/

# Before we can install the cluster we need to change one config option, which clashes with OpenShifts security context
# For that download the OpenShift overrides config file
wget https://raw.githubusercontent.com/iteratec/juicy-ctf/master/guides/openshift/openshift-helm-overrides.yaml

# Now we can install the helm chart
# The first juicy-ctf part is the release name, safe to change to whatever you like, but the examples in the guide are written for 'juicy-ctf'
helm install juicy-ctf -f openshift-helm-overrides.yaml ./juicy-ctf/helm/juicy-ctf/

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
