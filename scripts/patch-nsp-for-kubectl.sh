#!/bin/bash
# Deployiong for 1-20 
echo "This script will patch the networkpolicies for every ns starting with 't-', and patch it to use a new cidr block."
echo "You can use this to patch the ns when autoscaling and rebalancing kubelets breaks the network of the pods "
for NAMESPACE in `kubectl get ns | grep t- |  awk '{print $1;}'`
do
  sleep 1;
  echo "Deployoing fix for $NAMESPACE 🚀"
  CIDR = "172.16.0.0/16"
  echo "IP whitelist set to cidr = $CIDR"
  kubectl delete networkpolicy access-kubectl-from-virtualdeskop -n $NAMESPACE 
  cat <<EOF | kubectl create -f - 
  apiVersion: networking.k8s.io/v1
  kind: NetworkPolicy
  metadata:
    name: access-kubectl-from-virtualdeskop
    namespace: $NAMESPACE
  spec:
    egress:
    - ports:
      - port: 443
        protocol: TCP
      - port: 8443
        protocol: TCP
      - port: 80
        protocol: TCP
      - port: 10250
        protocol: TCP
      - port: 53
        protocol: UDP
      to:
      - ipBlock:
          cidr: $CIDR
    podSelector:
      matchLabels:
        app: virtualdesktop
    policyTypes:
    - Ingress
    - Egress
EOF
  echo "Updated the fix for $NAMESPACE 🎉"
done
