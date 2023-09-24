source ../scripts/check-available-commands.sh

checkCommandsAvailable helm gcloud kubectl


echo "Make sure you have updated your GCP credentials and your kubeconfig prior to executing this!"


echo "Installing the nginx ingress controller"

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.3.0/deploy/static/provider/cloud/deploy.yaml


echo "apply -f k8s/wrongsecrets-balancer-ingress.yml in 10 s"
sleep 10
kubectl apply -f k8s/wrongsecrets-balancer-ingress.yml

kubectl apply -f k8s/ctfd-service.yaml

echo "Ingress for Ctfd is not supported by default as it needs to have a sub-domain with root path. Do kubectl port-forward svc/ctfd 8000:8000 to access it locally"

echo "Go to the file at k8s/ctfd-ingress.yaml and change the host to your own domain name"
# kubectl apply -f k8s/ctfd-ingress.yaml

echo "Ingress for Grafana is not supported by default as it needs to have a sub-domain with root path. Do kubectl port-forward svc/wrongsecrets-grafana 8080:80 to access it locally"

echo "Go to the file at k8s/grafana-ingress.yaml and change the host to your own domain name"
# kubectl apply -f k8s/grafana-ingress.yaml

IP_ADDRESS="$(kubectl get service ingress-nginx-controller --namespace=ingress-nginx --output jsonpath='{.status.loadBalancer.ingress[0].ip}')"

echo "IP_ADDRESS for the entrypoint is $IP_ADDRESS"

echo "You can now access the Wrongsecrets ingress at http://$IP_ADDRESS"

echo "You can assign a DNS name to the IP_ADDRESS and access the ingress at http://<DNS_NAME>"

echo "Do not forget to cleanup afterwards! Run k8s-nginx-lb-script-cleanup.sh"
