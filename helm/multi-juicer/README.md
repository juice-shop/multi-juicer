![MultiJuicer, Multi User Juice Shop Platform](https://raw.githubusercontent.com/juice-shop/multi-juicer/main/images/multijuicer-cover.svg)

Running CTFs and Security Trainings with [OWASP Juice Shop](https://github.com/bkimminich/juice-shop) is usually quite tricky, Juice Shop just isn't intended to be used by multiple users at a time.
Instructing everybody how to start Juice Shop on their own machine works ok, but takes away too much valuable time.

MultiJuicer gives you the ability to run separate Juice Shop instances for every participant on a central kubernetes cluster, to run events without the need for local Juice Shop instances.

**What it does:**

- dynamically create new Juice Shop instances when needed
- runs on a single domain, comes with a LoadBalancer sending the traffic to the participants Juice Shop instance
- backup and auto apply challenge progress in case of Juice Shop container restarts
- cleanup old & unused instances automatically

![MultiJuicer, High Level Architecture Diagram](https://raw.githubusercontent.com/juice-shop/multi-juicer/main/images/high-level-architecture.svg)

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| balancer.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| balancer.containerSecurityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Optional securityContext on container level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#securitycontext-v1-core |
| balancer.cookie.cookieParserSecret | string | `nil` | Set this to a fixed random alpha-numeric string (recommended length 24 chars). If not set this gets randomly generated with every helm upgrade, each rotation invalidates all active cookies / sessions requiring users to login again. |
| balancer.cookie.name | string | `"balancer"` | Changes the cookies name used to identify teams. |
| balancer.cookie.secure | bool | `false` | Sets the secure attribute on cookie so that it only be send over https |
| balancer.metrics.dashboards.enabled | bool | `false` | if true, creates a Grafana Dashboard Config Map. These will automatically be imported by Grafana when using the Grafana helm chart, see: https://github.com/helm/charts/tree/main/stable/grafana#sidecar-for-dashboards |
| balancer.metrics.serviceMonitor.enabled | bool | `false` | If true, creates a Prometheus Operator ServiceMonitor. This will also deploy a servicemonitor which monitors metrics from the Juice Shop instances |
| balancer.metrics.serviceMonitor.labels | object | `{}` | If you use the kube-prometheus-stack helm chart, the default label looked for is `release=<kube-prometheus-release-name> |
| balancer.pod.annotations | object | `{}` | Optional Additional annotations for the balancer pods. |
| balancer.pod.labels | object | `{}` | Optional Additional labels for the balancer pods. |
| balancer.podSecurityContext | object | `{"runAsNonRoot":true}` | Optional securityContext on pod level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#podsecuritycontext-v1-core |
| balancer.replicas | int | `1` | Number of replicas of the balancer deployment |
| balancer.repository | string | `"ghcr.io/juice-shop/multi-juicer/balancer"` |  |
| balancer.resources.limits.cpu | string | `"400m"` |  |
| balancer.resources.limits.memory | string | `"256Mi"` |  |
| balancer.resources.requests.cpu | string | `"400m"` |  |
| balancer.resources.requests.memory | string | `"256Mi"` |  |
| balancer.service.clusterIP | string | `nil` | internal cluster service IP |
| balancer.service.externalIPs | string | `nil` | IP address to assign to load balancer (if supported) |
| balancer.service.loadBalancerIP | string | `nil` | IP address to assign to load balancer (if supported) |
| balancer.service.loadBalancerSourceRanges | string | `nil` | list of IP CIDRs allowed access to lb (if supported) |
| balancer.service.type | string | `"ClusterIP"` | Kubernetes service type |
| balancer.tag | string | `nil` |  |
| balancer.tolerations | list | `[]` | Optional Configure kubernetes toleration for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
| config.juiceShop.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| config.juiceShop.config | object | See values.yaml for full details | Specify a custom Juice Shop config.yaml. See the JuiceShop Config Docs for more detail: https://pwning.owasp-juice.shop/companion-guide/latest/part4/customization.html#_yaml_configuration_file |
| config.juiceShop.containerSecurityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}}` | Optional securityContext on container level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#securitycontext-v1-core |
| config.juiceShop.ctfKey | string | `"zLp@.-6fMW6L-7R3b!9uR_K!NfkkTr"` | Change the key when hosting a CTF event. This key gets used to generate the challenge flags. See: https://pwning.owasp-juice.shop/companion-guide/latest/part4/ctf.html#_overriding_the_ctf_key |
| config.juiceShop.env | list | `[]` | Optional environment variables to set for each JuiceShop instance (see: https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/) |
| config.juiceShop.envFrom | list | `[]` | Optional mount environment variables from configMaps or secrets (see: https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/#configure-all-key-value-pairs-in-a-secret-as-container-environment-variables) |
| config.juiceShop.image | string | `"bkimminich/juice-shop"` | Juice Shop Image to use |
| config.juiceShop.imagePullPolicy | string | `"IfNotPresent"` |  |
| config.juiceShop.imagePullSecrets | list | `[]` |  |
| config.juiceShop.nodeEnv | string | `"multi-juicer"` | Specify a custom NODE_ENV for JuiceShop. If value is changed to something other than 'multi-juicer' it's not possible to set a custom config via `juiceShop.config`. |
| config.juiceShop.pod.annotations | object | `{}` | Optional Additional annotations for the Juice Shop pods. |
| config.juiceShop.pod.labels | object | `{}` | Optional Additional labels for the Juice Shop pods. |
| config.juiceShop.podSecurityContext | object | `{"runAsNonRoot":true}` | Optional securityContext on pod level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#podsecuritycontext-v1-core |
| config.juiceShop.resources | object | `{"requests":{"cpu":"150m","memory":"300Mi"}}` | Optional resources definitions to set for each JuiceShop instance |
| config.juiceShop.runtimeClassName | string | `nil` | Optional Can be used to configure the runtime class for the JuiceShop pods to add an additional layer of isolation to reduce the impact of potential container escapes. (see: https://kubernetes.io/docs/concepts/containers/runtime-class/) |
| config.juiceShop.tag | string | `"v17.2.0"` |  |
| config.juiceShop.tolerations | list | `[]` | Optional Configure kubernetes toleration for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
| config.juiceShop.volumeMounts | list | `[]` | Optional VolumeMounts to set for each JuiceShop instance (see: https://kubernetes.io/docs/concepts/storage/volumes/) |
| config.juiceShop.volumes | list | `[]` | Optional Volumes to set for each JuiceShop instance (see: https://kubernetes.io/docs/concepts/storage/volumes/) |
| config.maxInstances | int | `10` | Specifies how many JuiceShop instances MultiJuicer should start at max. Set to -1 to remove the max Juice Shop instance cap |
| imagePullPolicy | string | `"IfNotPresent"` |  |
| imagePullSecrets | list | `[]` | imagePullSecrets used for balancer, progress-watchdog and cleaner. You'll also need to set `config.juiceShop.imagePullSecrets`` to set the imagePullSecrets if you are using a private registry for all images |
| ingress.annotations | object | `{}` |  |
| ingress.enabled | bool | `false` |  |
| ingress.hosts[0].host | string | `"multi-juicer.local"` |  |
| ingress.hosts[0].paths[0] | string | `"/"` |  |
| ingress.ingressClassName | string | `"nginx"` |  |
| ingress.tls | list | `[]` |  |
| juiceShopCleanup.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the JuiceShopCleanup Job(see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| juiceShopCleanup.containerSecurityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Optional securityContext on container level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#securitycontext-v1-core |
| juiceShopCleanup.cron | string | `"0 * * * *"` | Cron in which the clean up job is run. Defaults to once in an hour. Change this if your grace period if shorter than 1 hour |
| juiceShopCleanup.enabled | bool | `true` |  |
| juiceShopCleanup.failedJobsHistoryLimit | int | `1` |  |
| juiceShopCleanup.gracePeriod | string | `"24h"` | Specifies when Juice Shop instances will be deleted when unused for that period. |
| juiceShopCleanup.podSecurityContext | object | `{"runAsNonRoot":true}` | Optional securityContext on pod level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#podsecuritycontext-v1-core |
| juiceShopCleanup.repository | string | `"ghcr.io/juice-shop/multi-juicer/cleaner"` |  |
| juiceShopCleanup.resources.limits.memory | string | `"256Mi"` |  |
| juiceShopCleanup.resources.requests.memory | string | `"256Mi"` |  |
| juiceShopCleanup.successfulJobsHistoryLimit | int | `1` |  |
| juiceShopCleanup.tag | string | `nil` |  |
| juiceShopCleanup.tolerations | list | `[]` | Optional Configure kubernetes toleration for the JuiceShopCleanup Job (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
| nodeSelector | object | `{}` |  |
| progressWatchdog.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the ProgressWatchdog (see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| progressWatchdog.containerSecurityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Optional securityContext on container level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#securitycontext-v1-core |
| progressWatchdog.podSecurityContext | object | `{"runAsNonRoot":true}` | Optional securityContext on pod level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#podsecuritycontext-v1-core |
| progressWatchdog.repository | string | `"ghcr.io/juice-shop/multi-juicer/progress-watchdog"` |  |
| progressWatchdog.resources.limits.cpu | string | `"20m"` |  |
| progressWatchdog.resources.limits.memory | string | `"48Mi"` |  |
| progressWatchdog.resources.requests.cpu | string | `"20m"` |  |
| progressWatchdog.resources.requests.memory | string | `"48Mi"` |  |
| progressWatchdog.tag | string | `nil` |  |
| progressWatchdog.tolerations | list | `[]` | Optional Configure kubernetes toleration for the ProgressWatchdog (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
| service.port | int | `8080` |  |
| service.type | string | `"ClusterIP"` |  |
