# Example Setup with Digital Ocean

**WARNING:** The resources created in this guide will cost about \$45.00/month.
Make sure to delete the resources as described in "Step 5 Deinstallation" when you do not need them anymore.

## Prerequisites

This example expects you to have the following cli tools setup.

1. [doctl](https://github.com/digitalocean/doctl)
2. [helm](https://helm.sh)
3. [kubectl](https://kubernetes.io/docs/tasks/tools/)

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
# This should show you two pods a balancer pod and a progress-watchdog pod
# Wait until both pods are ready
```

If the balancer pods is still pending status after a couple of minutes, the cluster may not have the necessary resources to provision the pods.

```bash
# This show details about the balancer pods. Warnings can be found under Events, and the cluster
# does not have the necessary resources if theres is a warning about insufficient CPU or memory.
# In this case you would need to increase resources
kubectl describe pods balancer-<postfix>
# e.g. kubectl describe pods balancer-7d57fff697-4r8lv

# To see the different size options for compute resources run the following command:
doctl kubernetes options sizes

# To run an instace with 2 vcpu and 4gb memory, add the --size flag to the cluster create command as follows.
# note that this will increase the cost of the k8s cluster. Make sure you understand the costs of every option size.
doctl kubernetes cluster create juicy-k8s --size s-2vcpu-4gb
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

## Step 4. Add a LoadBalancer to expose the app to the world

DigitalOcean lets you create a DigitalOcean Loadbalancer to expose your kubernetes deployment without having to setup the whole kubernetes ingress stuff. This makes it especially easy if you also manage your domains in DigitalOcean as DigitalOcean will also be able to provide you with the tls certificates.

To use with a domain and TLS certificate, you first need to purchase a domain from a domain registrar (GoDaddy, NameCheap, etc.)
and allow DigitalOcean to manage the domain by pointing it's NS records to the DigitalOcean nameservers
Note that this may take between 30 minutes to several hours for the change to propogate cross the internet. See
[Point to DigitalOcean Name Servers From Common Domain Registrars](https://docs.digitalocean.com/products/networking/dns/getting-started/dns-registrars/)

```bash
# Create the certificate in digital ocean (after purchasing a domain and letting DigitalOcean handle it)
doctl compute certificate create --type lets_encrypt --name your_certificate_name --dns-names yourdomain.com

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
