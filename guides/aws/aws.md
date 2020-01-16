# [WIP] Example Setup with AWS

**NOTE:** This Guide is still a "Work in Progress", if you got any recommendations or issues with it, please post them into the related issue: https://github.com/iteratec/multi-juicer/issues/15

**WARNING:** The resources created in this guide will cost about \$70.00/month. The actual price might depend on its usage, but make sure to delete the resources as described in Step 5 Deinstallation when you do not need them anymore.

## Prerequisites

This example expects you to have the following cli tools setup.

1. [awscli](https://aws.amazon.com/cli/)
2. [eksctl](https://docs.aws.amazon.com/eks/latest/userguide/getting-started-eksctl.html)
3. [helm](https://helm.sh)
4. [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/#install-kubectl-on-macos)

```sh
# First we'll need a cluster, you can create one using the DigitalOcean cli.
# This will take a couple of minutes
eksctl create cluster \
--name multi-juicer \
--version 1.13 \
--nodegroup-name standard-workers \
--node-type t3.medium \
--nodes 2 \
--nodes-min 1 \
--nodes-max 4 \
--node-ami auto

# After completion verify that your kubectl context has been updated:
# Should print something like: Administrator@multi-juicer.eu-central-1.eksctl.io
kubectl config current-context
```

## Step 2. Prepare EKS for ALB and externalDNS

Before running the following commands make sure that the EKS worker nodes have been associated with the relevant IAM roles
to be able to create and delete Route53 and ALB resources.

Further information can be found here: 
- https://kubernetes-sigs.github.io/aws-alb-ingress-controller/guide/controller/setup
- https://kubernetes-sigs.github.io/aws-alb-ingress-controller/guide/external-dns/setup
- https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html
- https://www.phillipsj.net/posts/aws-eks-and-kubernetes-external-dns

> ALBIngressControllerIAMPolicy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:GetCertificate"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:CreateSecurityGroup",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:DeleteSecurityGroup",
        "ec2:DescribeAccountAttributes",
        "ec2:DescribeAddresses",
        "ec2:DescribeInstances",
        "ec2:DescribeInstanceStatus",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeTags",
        "ec2:DescribeVpcs",
        "ec2:ModifyInstanceAttribute",
        "ec2:ModifyNetworkInterfaceAttribute",
        "ec2:RevokeSecurityGroupIngress"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "elasticloadbalancing:AddListenerCertificates",
        "elasticloadbalancing:AddTags",
        "elasticloadbalancing:CreateListener",
        "elasticloadbalancing:CreateLoadBalancer",
        "elasticloadbalancing:CreateRule",
        "elasticloadbalancing:CreateTargetGroup",
        "elasticloadbalancing:DeleteListener",
        "elasticloadbalancing:DeleteLoadBalancer",
        "elasticloadbalancing:DeleteRule",
        "elasticloadbalancing:DeleteTargetGroup",
        "elasticloadbalancing:DeregisterTargets",
        "elasticloadbalancing:DescribeListenerCertificates",
        "elasticloadbalancing:DescribeListeners",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeLoadBalancerAttributes",
        "elasticloadbalancing:DescribeRules",
        "elasticloadbalancing:DescribeSSLPolicies",
        "elasticloadbalancing:DescribeTags",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetGroupAttributes",
        "elasticloadbalancing:DescribeTargetHealth",
        "elasticloadbalancing:ModifyListener",
        "elasticloadbalancing:ModifyLoadBalancerAttributes",
        "elasticloadbalancing:ModifyRule",
        "elasticloadbalancing:ModifyTargetGroup",
        "elasticloadbalancing:ModifyTargetGroupAttributes",
        "elasticloadbalancing:RegisterTargets",
        "elasticloadbalancing:RemoveListenerCertificates",
        "elasticloadbalancing:RemoveTags",
        "elasticloadbalancing:SetIpAddressType",
        "elasticloadbalancing:SetSecurityGroups",
        "elasticloadbalancing:SetSubnets",
        "elasticloadbalancing:SetWebACL"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateServiceLinkedRole",
        "iam:GetServerCertificate",
        "iam:ListServerCertificates"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "waf-regional:GetWebACLForResource",
        "waf-regional:GetWebACL",
        "waf-regional:AssociateWebACL",
        "waf-regional:DisassociateWebACL"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "tag:GetResources",
        "tag:TagResources"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "waf:GetWebACL"
      ],
      "Resource": "*"
    }
  ]
}
```


> Route53IAMPolicy
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "route53:ListHostedZones",
                "route53:ListResourceRecordSets"
            ],
            "Resource": ["*"]
        },
        {
            "Effect": "Allow",
            "Action": [
                "route53:ChangeResourceRecordSets"
            ],
            "Resource": ["*"]
        }
    ]
}
```

Create the service account, cluster role, and cluster role binding for the ALB Ingress Controller.
```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/v1.1.3/docs/examples/rbac-role.yaml
```

Download the AWS ALB Ingress Controller config yaml.
```sh
wget https://github.com/kubernetes-sigs/aws-alb-ingress-controller/raw/master/docs/examples/alb-ingress-controller.yaml
```

Edit alb-ingress-controller.yaml and update with your `cluster-name`, `aws-vpc-id` and `region`.  
Now deploy ALB Ingress Controller.
```sh
kubectl apply -f alb-ingress-controller.yaml
```
Download the AWS external-dns config yaml.
```sh
wget https://github.com/kubernetes-sigs/aws-alb-ingress-controller/raw/master/docs/examples/external-dns.yaml
```

Edit external-dns.yaml and update with your `domain-filter` (i.e. your Route53 Hosted Zone) and `txt-owner-id` (optional). 
Now deploy external-dns Daemon Set.
```sh
kubectl apply -f external-dns.yaml
```

## Step 3. Installing MultiJuicer via helm

**NOTE: To make this work with the ALB Ingress Controller the following needs to be added to the helm/multi-juicer/templates/juice-balancer-service.yaml**
```sh
  type: NodePort
```
**Currently this requires manually downloading the helm chart, updating the file as above and applying.**

```sh
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

## Step 4. Verify the app is running correctly

This step is optional, but helpful to catch errors quicker.

```sh
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
# The password for the team gets autogenerated if not specified, you can extract it from the kubernetes secret:
kubectl get secrets juice-balancer-secret -o=jsonpath='{.data.adminPassword}' | base64 --decode
```

## Step 5. Create ALB Ingress and Route53 record for MultiJuicer deployment

Download the MultiJuicer Ingress controller 
```sh
wget https://raw.githubusercontent.com/iteratec/multi-juicer/master/guides/aws/aws-ingress.yaml
```

Edit aws-ingress.yaml and update `external-dns.alpha.kubernetes.io/hostname` (i.e. your Route53 Hosted Zone FQDN) 
and `alb.ingress.kubernetes.io/inbound-cidrs` (optional Security Group lockdown). Now deploy the ALB Ingress controller.
```sh
kubectl apply -f aws-ingress.yaml
```

## Step 5. Deinstallation

helm delete multi-juicer

```sh
# helm will not delete the persistent volumes for redis!
# delete them by running:
kubectl delete persistentvolumeclaims redis-data-multi-juicer-redis-master-0 redis-data-multi-juicer-redis-slave-0

# Delete the loadbalancer
kubectl delete -f aws-ingress.yaml

# Delete the kubernetes cluster
eksctl delete cluster multi-juicer
```
