# MultiJuicer Monitoring Setups

This is a short guide on how to install MultiJuicer together with Prometheus, Grafana to get a nice monitoring setup for your MultiJuicer installation.

After you have everything installed you can locally port forward the grafana port by running: `kubectl -n monitoring port-forward service/monitoring-grafana 8080:80` and access Grafana in your browser on [http://localhost:8080](http://localhost:8080).

The default credentials for grafana are username: `admin`, password: `prom-operator`.
You can overwrite these by adding `set="grafana.adminPassword=yourPasswordHere"` to the helm install command for the `kube-prometheus-stack`.

```sh
# Install Prometheus and Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

echo "Installing Prometheus Operator & Grafana"
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --values https://raw.githubusercontent.com/juice-shop/multi-juicer/main/guides/monitoring-setup/prometheus-operator-config.yaml

echo "Installing MultiJuicer"
helm install multi-juicer oci://ghcr.io/juice-shop/multi-juicer/helm/multi-juicer \
  --set="balancer.metrics.enabled=true" --set="balancer.metrics.dashboards.enabled=true" --set="balancer.metrics.serviceMonitor.enabled=true"
```

The Grafana instance automatically includes a MultiJuicer Dashboard.
This dashboard also includes a panel to view JuiceShop logs.
However, this panel is currently not working properly with the current setup.
To view the logs in the dashboard, you'll need to install Grafana Loki as a log collector.
Note that the setup for Grafana Loki has been removed from this guide due to its increasingly tedious maintenance requirements and increasingly complicated configuration.
