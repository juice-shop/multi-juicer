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

# Create a new project to hold the wrongsecrets-ctf-party resources
oc new-project wrongsecrets-ctf-party
```

## Step 2. Installing MultiJuicer via helm

```bash
# You'll need to add the wrongsecrets-ctf-party helm repo to your helm repos
helm repo add wrongsecrets-ctf-party https://iteratec.github.io/multi-juicer/

helm install wrongsecrets-ctf-party wrongsecrets-ctf-party/wrongsecrets-ctf-party ./wrongsecrets-ctf-party/helm/wrongsecrets-ctf-party/
```

## Step 3. Verify the app is running correctly

This step is optional, but helpful to catch errors quicker.

```bash
# lets test out if the app is working correctly before proceeding
# for that we can port forward the JuiceBalancer service to your local machine
oc port-forward service/wrongsecrets-balancer 3000:3000

# Open up your browser for localhost:3000
# You should be able to see the MultiJuicer Balancer UI

# Try to create a team and see if everything works correctly
# You should be able to access a JuiceShop instances after a few seconds after creating a team,
# and after clicking the "Start Hacking" Button

# You can also try out if the admin UI works correctly
# Go back to localhost:3000/balancer
# To log in as the admin log in as the team "admin"
# The password for the team gets auto generated if not specified, you can extract it from the kubernetes secret:
oc get secrets wrongsecrets-balancer-secret -o=jsonpath='{.data.adminPassword}' | base64 --decode
```

## Step 4. Add a route to expose the app to the world

OpenShift lets you create routes to expose your app to the internet.

```bash
# Create the route.
# Make sure to adjust the hostname to match the one of your org.
# You can also perform this step easily via the OpenShift web ui.
oc create route edge wrongsecrets-balancer --service wrongsecrets-balancer --hostname wrongsecrets-ctf-party.cloudapps.example.com
```

## Step 4. Deinstallation

```bash
helm delete wrongsecrets-ctf-party

# Delete the route
oc delete route edge wrongsecrets-balancer
```
