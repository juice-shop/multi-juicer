# MultiJuicer Monitoring Setups

This is a short and temporary guide on how to install MultiJuicer together with Prometheus, Grafana & Grafana Loki to get nice monitoring setup for your MultiJuicer installation.

After you have everything installed you can locally port forward the grafana port by running: `kubectl -n monitoring port-forward service/monitoring-grafana 8080:80` and access Grafana in your browser on [http://localhost:8080](http://localhost:8080). The default admin password for the Grafana Setup is: `prom-operator`. You can overwrite this by adding `set="grafana.adminPassword=yourPasswordHere"` to the helm install command for the prometheus-operator.

```sh
# Install Prometheus, Grafana & Grafana Loki

helm repo add grafana https://grafana.github.io/helm-charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

kubectl create namespace monitoring

echo "Installing prometheus-operator"
wget https://raw.githubusercontent.com/juice-shop/multi-juicer/main/guides/monitoring-setup/prometheus-operator-config.yaml

echo "Installing Prometheus Operator & Grafana"
helm --namespace monitoring upgrade --install monitoring prometheus-community/kube-prometheus-stack --version 13.3.0 --values prometheus-operator-config.yaml

echo "Installing loki"
helm --namespace monitoring upgrade --install loki grafana/loki --version 2.3.0 --set="serviceMonitor.enabled=true"

echo "Installing loki/promtail"
helm --namespace monitoring upgrade --install promtail grafana/promtail --version 3.0.4 --set "config.lokiAddress=http://loki:3100/loki/api/v1/push" --set="serviceMonitor.enabled=true"

echo "Installing MultiJuicer"
helm repo add multi-juicer https://juice-shop.github.io/multi-juicer/

# for helm >= 3
helm install multi-juicer multi-juicer/multi-juicer --set="balancer.metrics.enabled=true" --set="balancer.metrics.dashboards.enabled=true" --set="balancer.metrics.serviceMonitor.enabled=true"
```
