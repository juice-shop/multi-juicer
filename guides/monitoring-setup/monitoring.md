# MultiJuicer Monitoring Setups

This is a short and temporary guide on how to install MultiJuicer together with Prometheus, Grafana & Grafana Loki to get nice monitoring setup for your MultiJuicer installation.

This Guide is considered temporary as it is intended to be replaced by fully featured Terraform Modules which will install everything for you 🚀

The default admin password for the Grafana Setup is: `prom-operator`. You can overwrite this by adding `set="grafana.adminPassword=yourPasswordHere"` to the helm install command for the prometheus-operator.

```sh
# Install Prometheus, Grafana & Grafana Loki

helm repo add loki https://grafana.github.io/loki/charts

kubectl create namespace monitoring

echo "Installing prometheus-operator"
wget https://raw.githubusercontent.com/iteratec/multi-juicer/master/guides/monitoring-setup/prometheus-operator-config.yaml

# If you do not already have the stable helm repo installed you will have to add it:
helm repo add stable https://kubernetes-charts.storage.googleapis.com

helm --namespace monitoring upgrade --install prometheus stable/prometheus-operator --version 8.12.12 --values ./prometheus-operator-config.yaml

echo "Installing loki"
helm --namespace monitoring upgrade --install loki loki/loki --version 0.26.1 --set="serviceMonitor.enabled=true"

echo "Installing loki/promtail"
helm --namespace monitoring upgrade --install promtail loki/promtail --version 0.20.1 --set "loki.serviceName=loki" --set="serviceMonitor.enabled=true"

echo "Installing MultiJuicer"
helm repo add multi-juicer https://iteratec.github.io/multi-juicer/

# for helm >= 3
helm install multi-juicer multi-juicer/multi-juicer --set="balancer.metrics.enabled=true" --set="balancer.metrics.dashboards.enabled=true" --set="balancer.metrics.serviceMonitor.enabled=true"
```
