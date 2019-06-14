kubectl delete -f juice-balancer-k8.yml
docker build -t juice-balancer:latest .
kubectl apply -f juice-balancer-k8.yml
sleep 5
kubectl port-forward service/juice-balancer 3000:3000