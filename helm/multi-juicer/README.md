![MultiJuicer, Multi User Juice Shop Platform](https://raw.githubusercontent.com/iteratec/multi-juicer/master/cover.svg)

Running CTFs and Security Trainings with [OWASP Juice Shop](https://github.com/bkimminich/juice-shop) is usually quite tricky, Juice Shop just isn't intended to be used by multiple users at a time.
Instructing everybody how to start Juice Shop on their own machine works ok, but takes away too much valuable time.

MultiJuicer gives you the ability to run separate Juice Shop instances for every participant on a central kubernetes cluster, to run events without the need for local Juice Shop instances.

> **Note:** This project was called JuicyCTF until recently. This was changed to avoid confusions with the [juice-shop-ctf](https://github.com/bkimminich/juice-shop-ctf) project.

**What it does:**

- dynamically create new Juice Shop instances when needed
- runs on a single domain, comes with a LoadBalancer sending the traffic to the participants Juice Shop instance
- backup and auto apply challenge progress in case of Juice Shop container restarts
- cleanup old & unused instances automatically

![MultiJuicer, High Level Architecture Diagram](https://raw.githubusercontent.com/iteratec/multi-juicer/master/high-level-architecture.svg)

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| balancer.affinity | object | `{}` |  |
| balancer.cookie.name | string | `"balancer"` | Changes the cookies name used to identify teams. Note will automatically be prefixed with "__Secure-" when balancer.cookie.secure is set to `true` |
| balancer.cookie.secure | bool | `false` | Sets the secure attribute on cookie so that it only be send over https |
| balancer.metrics.basicAuth.password | string | `"ERzCT4pwBDxfCKRGmfrMa8KQ8sXf8GKy"` |  |
| balancer.metrics.basicAuth.username | string | `"prometheus-scraper"` |  |
| balancer.metrics.dashboards.enabled | bool | `false` |  |
| balancer.metrics.enabled | bool | `false` |  |
| balancer.metrics.serviceMonitor.enabled | bool | `false` |  |
| balancer.replicas | int | `1` |  |
| balancer.repository | string | `"iteratec/juice-balancer"` |  |
| balancer.resources.limits.cpu | string | `"400m"` |  |
| balancer.resources.limits.memory | string | `"256Mi"` |  |
| balancer.resources.requests.cpu | string | `"400m"` |  |
| balancer.resources.requests.memory | string | `"256Mi"` |  |
| balancer.service.clusterIP | string | `nil` |  |
| balancer.service.externalIPs | string | `nil` |  |
| balancer.service.loadBalancerIP | string | `nil` |  |
| balancer.service.loadBalancerSourceRanges | string | `nil` |  |
| balancer.service.type | string | `"ClusterIP"` |  |
| balancer.skipOwnerReference | bool | `false` |  |
| balancer.tag | string | `"latest"` |  |
| balancer.tolerations | list | `[]` |  |
| imagePullPolicy | string | `"Always"` |  |
| ingress.annotations | object | `{}` |  |
| ingress.enabled | bool | `false` |  |
| ingress.hosts[0].host | string | `"multi-juicer.local"` |  |
| ingress.hosts[0].paths[0] | string | `"/"` |  |
| ingress.tls | list | `[]` |  |
| juiceShop.config | string | See values.yaml for full details | See the JuiceShop Config Docs for more detail: https://pwning.owasp-juice.shop/part1/customization.html#yaml-configuration-file |
| juiceShop.ctfKey | string | `"zLp@.-6fMW6L-7R3b!9uR_K!NfkkTr"` | Change the key when hosting a CTF event. This key gets used to generate the challenge flags. See: https://pwning.owasp-juice.shop/part1/ctf.html#overriding-the-ctfkey |
| juiceShop.image | string | `"bkimminich/juice-shop"` |  |
| juiceShop.maxInstances | int | `10` | Specifies how many JuiceShop instances MultiJuicer should start at max. Set to -1 to remove the max Juice Shop instance cap |
| juiceShop.nodeEnv | string | `"multi-juicer"` | Specify a custom NODE_ENV for JuiceShop. If value is changed to something other than 'multi-juicer' it's not possible to set a custom config via `juiceShop.config`. |
| juiceShop.resources.limits.cpu | string | `"200m"` |  |
| juiceShop.resources.limits.memory | string | `"200Mi"` |  |
| juiceShop.resources.requests.cpu | string | `"200m"` |  |
| juiceShop.resources.requests.memory | string | `"200Mi"` |  |
| juiceShop.tag | string | `"v10.3.1"` |  |
| juiceShopCleanup.affinity | object | `{}` |  |
| juiceShopCleanup.cron | string | `"0 * * * *"` | Cron in which the clean up job is run. Defaults to once in an hour. Change this if your grace period if shorter than 1 hour |
| juiceShopCleanup.enabled | bool | `true` |  |
| juiceShopCleanup.failedJobsHistoryLimit | int | `1` |  |
| juiceShopCleanup.gracePeriod | string | `"1d"` | Specifies when Juice Shop instances will be deleted when unused for that period. |
| juiceShopCleanup.repository | string | `"iteratec/juice-cleaner"` |  |
| juiceShopCleanup.resources.limits.memory | string | `"256Mi"` |  |
| juiceShopCleanup.resources.requests.memory | string | `"256Mi"` |  |
| juiceShopCleanup.successfulJobsHistoryLimit | int | `1` |  |
| juiceShopCleanup.tag | string | `"latest"` |  |
| juiceShopCleanup.tolerations | list | `[]` |  |
| nodeSelector | object | `{}` |  |
| progressWatchdog.repository | string | `"iteratec/juice-progress-watchdog"` |  |
| progressWatchdog.resources.limits.cpu | string | `"20m"` |  |
| progressWatchdog.resources.limits.memory | string | `"48Mi"` |  |
| progressWatchdog.resources.requests.cpu | string | `"20m"` |  |
| progressWatchdog.resources.requests.memory | string | `"48Mi"` |  |
| progressWatchdog.tag | string | `"latest"` |  |
| service.port | int | `3000` |  |
| service.type | string | `"ClusterIP"` |  |