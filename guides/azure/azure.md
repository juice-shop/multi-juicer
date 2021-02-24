# Example Setup with Microsoft Azure

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
# This should show you two pods a juice-balancer pod and a progress-watchdog pod
# Wait until both pods are ready
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



## Step 4. Allow for ingress traffic 

This step allows for external traffic to talk to your app

First, we'll install nginx-ingress


```bash
# Create a namespace for your ingress resources
kubectl create namespace ingress-basic

# Add the ingress-nginx repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# Use Helm to deploy an NGINX ingress controller
# Note, if you used a different namespace above, change it to match below

helm install nginx-ingress ingress-nginx/ingress-nginx \
    --namespace default \
    --set controller.replicaCount=2 \
    --set controller.nodeSelector."beta\.kubernetes\.io/os"=linux \
    --set defaultBackend.nodeSelector."beta\.kubernetes\.io/os"=linux \
    --set controller.admissionWebhooks.patch.nodeSelector."beta\.kubernetes\.io/os"=linux

```
Using the CLI, touch this file as `ingress.yml`

```yml

apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: hello-world-ingress
  namespace: default
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/use-regex: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  rules:
  - http:
      paths:
      - backend:
          serviceName: juice-balancer
          servicePort: 3000
        path: /(.*)
---
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: hello-world-ingress-static
  namespace: default
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/rewrite-target: /static/$2
spec:
  rules:
  - http:
      paths:
      - backend:
          serviceName: juice-balancer
          servicePort: 3000
        path: /static(/|$)(.*)s
```

Finally, apply this config to configure nginx-ingress to handle your traffic appropriately.

```bash
kubectl apply -f hello-world-ingress.yaml
```

If all has worked well, you should see

```bash
ingress.extensions/hello-world-ingress created
ingress.extensions/hello-world-ingress-static created
```

For testing

```bash
kubectl --namespace ingress-basic get services -o wide -w nginx-ingress-ingress-nginx-controller
```

Run this to see the public IP for your ingress controller, visit it to check if your app is running correctly.

Remember, by default the allowed traffic source is 'ANY' meaning it is open to the world, if you want to restrict this, change the inbound security rules in the NSG for your K8S cluster.

Check here for further information on ingress routing in Azure https://docs.microsoft.com/en-us/azure/aks/ingress-basic

