# Wrongsecrets Monitoring Setups

This is a short and temporary guide on how to install Wrongsecrets together with Prometheus, Grafana & Grafana Loki to get nice monitoring setup for your Wrongsecrets installation.

The chart comes with dependency charts for Prometheus, Grafana & Grafana Loki. The default values for the charts are used, but you can overwrite them by adding `--set="key=value"` to the helm install command or by adding `key: value` to the [values file](../../helm/wrongsecrets-ctf-party/values.yaml) under the block `kube-prometheus-stack`. You can find the documentation of each dependency chart in the [chart.yaml file](../../helm/wrongsecrets-ctf-party/Chart.yaml) under `dependencies`.

After you have everything installed you can locally port forward the grafana port by running: `kubectl port-forward svc/wrongsecrets-grafana 8080:80` and access Grafana in your browser on [http://localhost:8080](http://localhost:8080). The default admin password for the Grafana Setup is: `prom-operator`. You can overwrite this by adding `set="kube-prometheus-stack.grafana.adminPassword=yourPasswordHere"` to the helm install command for the chart.

## Grafana Dashboards

The chart comes with a set of dashboards for Wrongsecrets. You can find them in the Grafana UI under `Dashboards -> Browse`.
