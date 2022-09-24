# WrongSecrets CTF Party
_Powered by MultiJuicer_

This is a fork of MultiJuicer, which is now being rebuilt in order to server WrongSecret in creating CTFs. The tracking isssue of the first endavour can be found at https://github.com/commjoen/wrongsecrets/issues/403 .

Note that we:
- have a Webtop integrated
- have a WrongSecrets instance integrated
- A working admin interface which can restart both or delete both (by deleting the full namespace)
- Do not support any progress watchdog as you will have access to it, we therefore disabled it.


## Special thanks
Special thanks to Madhu Akula, Ben de Haan, and Mike Woudenberg for making this port a reality!


## What you need to know
This environment uses a webtop and an instance of wrongsecrets per user. This means that you need per user:
- 2.5 CPU (min = 1 , limit = 2.5)
- 3.5 GB RAM (min 2.5GB, limit = 3.5GB)
- 8GB HD (min 3 GB, limit = 8GB)

A 6 contestant game can be played on a local minikube with updated cpu & memory settings.
A 100 contestant game can be played on the AWS setup, which will require at least 200 CPUs, 3500 GB Ram, and 800 GB of storage available in the cluster. 

## Status

**This is by no means ready for anything, and work in progress.**

Still want to play? Ok, here we go:

We currently only support minikube and AWS EKS (_**Please follow the readme in the aws folder, as the guides section is not updated yet**_).

## How to use it

You need 3 things:
- This infrastructure
- The actual place where correct answers are exchanged for CTFD-flags. This can be your fly.dev/heroku/etc. or local container of WrongSecrets running in CTF mode with the additional key setup for challenge 8.
- A CTFD/Facebook-CTF host which is populated with the challenges based on your secondary hosted WrongSecrets application.

### Action with Minikube:

For minikube, run:

```shell

minikube start  --cpus=6 --memory=10000MB --network-plugin=cni --cni=calico
eval $(minikube docker-env)
./build-an-deploy.sh
kubectl port-forward service/wrongsecrets-balancer 3000:3000

```

### Action with AWS EKSS:

** NOTE: SEE SECTIONS ABOVE ABOUT WHAT YOU NEED AND THE COST OF THINGS: This project is not responsible, and will not pay for any part of your AWS bill. **

For AWS EKS follow the instrucrtions in the `/eks` folder.

Then open a browser and go to [localhost:3000](http:localhost:3000) and have fun :D .












Original readme:



![MultiJuicer, Multi User Juice Shop Platform](./images/multijuicer-cover.svg)

Running CTFs and Security Trainings with [OWASP Juice Shop](https://github.com/bkimminich/juice-shop) is usually quite tricky, Juice Shop just isn't intended to be used by multiple users at a time.
Instructing everybody how to start Juice Shop on their own machine works ok, but takes away too much valuable time.

MultiJuicer gives you the ability to run separate Juice Shop instances for every participant on a central kubernetes cluster, to run events without the need for local Juice Shop instances.

**What it does:**

- dynamically create new Juice Shop instances when needed
- runs on a single domain, comes with a LoadBalancer sending the traffic to the participants Juice Shop instance
- backup and auto apply challenge progress in case of Juice Shop container restarts
- cleanup old & unused instances automatically

![MultiJuicer, High Level Architecture Diagram](./images/high-level-architecture.svg)

## Installation

MultiJuicer runs on kubernetes, to install it you'll need [helm](https://helm.sh).

```sh
helm repo add wrongsecrets-ctf-party https://iteratec.github.io/multi-juicer/

helm install wrongsecrets-ctf-party wrongsecrets-ctf-party/wrongsecrets-ctf-party
```

See [production notes](./guides/production-notes/production-notes.md) for a checklist of values you'll likely need to configure before using MultiJuicer in proper events.

### Installation Guides for specific Cloud Providers / Environments

Generally MultiJuicer runs on pretty much any kubernetes cluster, but to make it easier for anybody who is new to kubernetes we got some guides on how to setup a kubernetes cluster with MultiJuicer installed for some specific Cloud providers.

- [Digital Ocean](./guides/digital-ocean/digital-ocean.md)
- [AWS](./guides/aws/aws.md)
- [OpenShift](./guides/openshift/openshift.md)
- [Plain Kubernetes](./guides/k8s/k8s.md)
- [Azure](./guides/azure/azure.md)

### Customizing the Setup

You got some options on how to setup the stack, with some option to customize the JuiceShop instances to your own liking.
You can find the default config values under: [helm/multi-juicer/values.yaml](helm/wrongsecrets-ctf-party/values.yaml)

Download & Save the file and tell helm to use your config file over the default by running:

```sh
helm install -f values.yaml wrongsecrets-ctf-party ./wrongsecrets-ctf-party/helm/wrongsecrets-ctf-party/
```

### Deinstallation

```sh
helm delete wrongsecrets-ctf-party
```

## FAQ

### How much compute resources will the cluster require?

To be on the safe side calculate with:

- _1GB memory & 1CPU overhead_, for the balancer & co
- _200MB & 0.2CPU \* number of participants_, for the individual JuiceShop Instances

The numbers above reflect the default resource limits. These can be tweaked, see: [Customizing the Setup](#customizing-the-setup)

### How many users can MultiJuicer handle?

There is no real fixed limit. (Even thought you can configure one 😉)
The custom LoadBalancer, through which all traffic for the individual Instances flows, can be replicated as much as you'd like.
You can also attach a [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/) to automatically scale the LoadBalancer.

### Why a custom LoadBalancer?

There are some special requirements which we didn't find to be easily solved with any pre build load balancer:

- Restricting the number of users for a deployment to only the members of a certain team.
- The load balancers cookie must be save and not easy to spoof to access another instance.
- Handling starting of new instances.

If you have awesome ideas on how to overcome these issues without a custom load balancer, please write us, we'd love to hear from you!

### Why a separate kubernetes deployment for every team?

There are some pretty good reasons for this:

- The ability delete the instances of a team separately. Scaling down safely, without removing instances of active teams, is really tricky with a scaled deployment. You can only choose the desired scale not which pods to keep and which to throw away.
- To ensure that pods are still properly associated with teams after a pod gets recreated. This is a non problem with separate deployment and really hard with scaled deployments.
- The ability to embed the team name in the deployment name. This seems like a stupid reason but make debugging SOOO much easier, with just using `kubectl`.

### How to manage JuiceShop easily using `kubectl`?

You can list all JuiceShops with relevant information using the custom-columns feature of kubectl.
You'll need to down load the juiceShop.txt from the repository first:

```bash
kubectl get -l app=wrongsecrets -o custom-columns-file=juiceShop.txt deployments
```

### Did somebody actually ask any of these questions?

No 😉

## Talk with Us!

You can reach us in the `#project-juiceshop` channel of the OWASP Slack Workspace. We'd love to hear any feedback or usage reports you got. If you are not already in the OWASP Slack Workspace, you can join via [this link](https://owasp.slack.com/join/shared_invite/enQtNjExMTc3MTg0MzU4LWQ2Nzg3NGJiZGQ2MjRmNzkzN2Q4YzU1MWYyZTdjYjA2ZTA5M2RkNzE2ZjdkNzI5ZThhOWY5MjljYWZmYmY4ZjM)
