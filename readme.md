# WrongSecrets CTF Party
_Powered by MultiJuicer_
[![CodeQL](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/codeql-analysis.yml)
[![Pre-commit check](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/pre-commit.yml/badge.svg)](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/pre-commit.yml)
[![Run Tests](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/test.yml/badge.svg)](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/test.yml)
[![Test minikube script (k8s)](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/minikube-k8s-test.yml/badge.svg)](https://github.com/commjoen/wrongsecrets-ctf-party/actions/workflows/minikube-k8s-test.yml)

Want to play OWASP WrongSecrets in a large group in CTF mode, but not go over all the hassle of setting up local copies of OWASP WrongSecrets? Here is OWASP WrongSecrets CTF Party! This is a fork of OWASP MultiJuicer, which is adapted to become a dynamic multi-tenant setup for doing a CTF together!

Note that we:
- have a [Webtop](https://docs.linuxserver.io/images/docker-webtop) integrated for each player
- have a WrongSecrets instance integrated for each player
- A working admin interface which can restart both or delete both (by deleting the full namespace)
- Do not support any progress watchdog as you will have access to it, we therefore disabled it.
- It can cleanup old & unused namespaces automatically.

## Special thanks
Special thanks to [@madhuakula](https://github.com/madhuakula), [@bendehaan](https://github.com/bendehaan) , and [@mikewoudenberg](https://github.com/mikewoudenberg) for making this port a reality!


## What you need to know
This environment uses a webtop and an instance of wrongsecrets per user. This means that you need per user:
- 2.5 CPU (min = 0.5 , limit = 2.5)
- 3.5 GB RAM (min 1 GB, limit = 3.5GB)
- 8GB HD (min 3 GB, limit = 8GB)


### Running this on minikube
A 3-6 contestant game can be played on a local minikube with updated cpu & memory settings (e.g. 6 virtual CPUs, 9 GB ram).

### Running this on AWS EKS with larger groups
A 100 contestant game can be played on the AWS setup, which will require around 200 (100-250) CPUs, 300 (250-350) GB Ram, and 800 GB of storage available in the cluster. Note that we have configured everything based on autoscaling in AWS. This means that you can often start with a cluster about 20% of the size of the "limit" numbers and then see how things evolve. You will hardly hit those limits, unless all players are very actively fuzzing the WrongSecrets app, while runnign heavy appss on their Webtops. Instead, you will see that you are using just 25% of what is provided in numbers here. So, by using our terraform (including an autoscaling managed nodegroup), you can reduce the cost of your CTF by a lot!

## Status - Experimental release

This is an experimental release. It showed to work at 2 CTFs already, we just did not complete the documentation and the cleaning up of the Helm chart yet. However: it is working in its basis, and can support a good crowd. Currently, we only support using Minikube and AWS EKS (_**Please follow the readme in the AWS folder if you want to use EKS, as the guides section is not updated yet**_).

## How to use it

The different setups are explained in [OWASP WrongSecrets CTF-instructions](https://github.com/commjoen/wrongsecrets/blob/master/ctf-instructions.md). With the 3-domain approach you generate flags for CTFD automatically, while with the 2-domain setup you need to set it up manually.

### Approach 1: 3-domain setup

You need 3 things:
- This infrastructure
- The actual place where correct answers are exchanged for CTFD-flags. This can be your fly.dev/heroku/etc. or local container of WrongSecrets running in CTF mode with the additional key setup for challenge 8.
- A CTFD/Facebook-CTF host which is populated with the challenges based on your secondary hosted WrongSecrets application.

### Approach 2: 2-domain setup

You need 2 things:
- This infrastructure
- A CTFD/Facebook-CTF host which is populated with the challenges based on your secondary hosted WrongSecrets application.


### General Helm usage

This setup works best if you have Calico installed as your CNI, if you want to use the helm directly, without the AWS Challenges, do:

```shell

helm upgrade --install mj ./helm/wrongsecrets-ctf-party 

```
from this repo. We will host the helm chart soon for you.

### Play with Minikube:

For minikube, run:

```shell

minikube start  --cpus=6 --memory=10000MB --network-plugin=cni --cni=calico
eval $(minikube docker-env)
./build-an-deploy.sh
kubectl port-forward service/wrongsecrets-balancer 3000:3000

```
Want to know whether your system is holding up? use

```shell
minikube addons enable metrics-server
kubectl top nodes
kubectl top pods
```

### Play with AWS EKS:

** NOTE: SEE SECTIONS ABOVE ABOUT WHAT YOU NEED AND THE COST OF THINGS: This project is not responsible, and will not pay for any part of your AWS bill. **

For AWS EKS follow the instrucrtions in the `/aws` folder.

Then open a browser and go to [localhost:3000](http:localhost:3000) and have fun :D .


### Some production notes

See [production notes](./guides/production-notes/production-notes.md) for a checklist of values you'll likely need to configure before using Wrongsecrets-ctf-party in proper events.

### Customizing the Setup

You got some options on how to setup the stack, with some option to customize the WrongSecrets and Virtual desktop instances to your own liking.
You can find the default config values under: [helm/wrongsecrets-ctf-party/values.yaml](helm/wrongsecrets-ctf-party/values.yaml)

Download & Save the file and tell helm to use your config file over the default by running:

```sh
helm install -f values.yaml wrongsecrets-ctf-party ./wrongsecrets-ctf-party/helm/wrongsecrets-ctf-party/
```

### Deinstallation

```sh
helm delete wrongsecrets-ctf-party
```

## FAQ

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

### How to manage WrongSecrets easily using `kubectl`?

You can list all WrongSecrets with relevant information using the custom-columns feature of kubectl.
You'll need to down load the wrongsecrets.txt from the repository first:

```bash
kubectl get -l app=wrongsecrets -o custom-columns-file=wrongsecrets.txt deployments
```

There are a few more ways how you can check whether all is going well: have a look in the [/scripts](/scripts/) folder for various tools that can help you to see if there are too many namespaces created for instance. This does require you to export the teams and players from ctfd.


### Did somebody actually ask any of these questions?

No 😉

## Talk with Us!

You can reach us in the `#project-wrongsecrets` channel of the OWASP Slack Workspace. We'd love to hear any feedback or usage reports you got. If you are not already in the OWASP Slack Workspace, you can join via [this link](https://owasp.slack.com/join/shared_invite/enQtNjExMTc3MTg0MzU4LWQ2Nzg3NGJiZGQ2MjRmNzkzN2Q4YzU1MWYyZTdjYjA2ZTA5M2RkNzE2ZjdkNzI5ZThhOWY5MjljYWZmYmY4ZjM)
