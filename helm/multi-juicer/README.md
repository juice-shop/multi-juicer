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
| affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| config.juiceShop.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| config.juiceShop.config | object | See values.yaml for full details | Specify a custom Juice Shop config.yaml. See the JuiceShop Config Docs for more detail: https://pwning.owasp-juice.shop/companion-guide/latest/part4/customization.html#_yaml_configuration_file |
| config.juiceShop.containerSecurityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}}` | Optional securityContext on container level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#securitycontext-v1-core |
| config.juiceShop.ctfKey | string | `"zLp@.-6fMW6L-7R3b!9uR_K!NfkkTr"` | Change the key when hosting a CTF event. This key gets used to generate the challenge flags. See: https://pwning.owasp-juice.shop/companion-guide/latest/part4/ctf.html#_overriding_the_ctf_key |
| config.juiceShop.deleteInactiveAfter | string | `"24h"` | How long a Juice Shop instance may sit idle (no end-user requests) before MultiJuicer deletes it. Accepts Go duration strings, e.g. "24h", "30m", "90m". |
| config.juiceShop.env | list | `[]` | Optional environment variables to set for each JuiceShop instance (see: https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/) |
| config.juiceShop.envFrom | list | `[]` | Optional mount environment variables from configMaps or secrets (see: https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/#configure-all-key-value-pairs-in-a-secret-as-container-environment-variables) |
| config.juiceShop.image | string | `"bkimminich/juice-shop"` | Juice Shop Image to use |
| config.juiceShop.imagePullPolicy | string | `"IfNotPresent"` |  |
| config.juiceShop.imagePullSecrets | list | `[]` |  |
| config.juiceShop.llm | object | `{"apiUrl":"","enabled":false,"existingSecret":{"key":"token","name":"multi-juicer-llm"},"model":""}` | Optional LLM / AI chatbot gateway configuration. When enabled, MultiJuicer proxies LLM requests from JuiceShop instances through an internal gateway, keeping the real API key out of JuiceShop pods. |
| config.juiceShop.llm.apiUrl | string | `""` | The upstream OpenAI-compatible API base URL, including the path prefix (e.g. https://api.openai.com/v1, https://openrouter.ai/api/v1, http://ollama:11434/v1) |
| config.juiceShop.llm.enabled | bool | `false` | Set to true to enable the LLM gateway |
| config.juiceShop.llm.existingSecret | object | `{"key":"token","name":"multi-juicer-llm"}` | Reference to an existing Kubernetes Secret containing the LLM API key |
| config.juiceShop.llm.existingSecret.key | string | `"token"` | Key within the secret that holds the API key |
| config.juiceShop.llm.existingSecret.name | string | `"multi-juicer-llm"` | Name of the secret |
| config.juiceShop.llm.model | string | `""` | The model identifier passed to JuiceShop's chatBot config, e.g. "qwen/qwen3.5-9b" |
| config.juiceShop.nodeEnv | string | `"multi-juicer"` | Specify a custom NODE_ENV for JuiceShop. If value is changed to something other than 'multi-juicer' it's not possible to set a custom config via `juiceShop.config`. |
| config.juiceShop.pod.annotations | object | `{}` | Optional Additional annotations for the Juice Shop pods. |
| config.juiceShop.pod.labels | object | `{}` | Optional Additional labels for the Juice Shop pods. |
| config.juiceShop.podSecurityContext | object | `{"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}` | Optional securityContext on pod level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#podsecuritycontext-v1-core |
| config.juiceShop.resources | object | `{"requests":{"cpu":"150m","memory":"300Mi"}}` | Optional resources definitions to set for each JuiceShop instance |
| config.juiceShop.runtimeClassName | string | `nil` | Optional Can be used to configure the runtime class for the JuiceShop pods to add an additional layer of isolation to reduce the impact of potential container escapes. (see: https://kubernetes.io/docs/concepts/containers/runtime-class/) |
| config.juiceShop.tag | string | `"v20.0.0"` |  |
| config.juiceShop.tolerations | list | `[]` | Optional Configure kubernetes toleration for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
| config.juiceShop.volumeMounts | list | `[]` | Optional VolumeMounts to set for each JuiceShop instance (see: https://kubernetes.io/docs/concepts/storage/volumes/) |
| config.juiceShop.volumes | list | `[]` | Optional Volumes to set for each JuiceShop instance (see: https://kubernetes.io/docs/concepts/storage/volumes/) |
| config.maxInstances | int | `10` | Specifies how many JuiceShop instances MultiJuicer should start at max. Set to -1 to remove the max Juice Shop instance cap |
| config.teamPasscodeLength | int | `12` | Passcode length for the team passcode, needs to be at least 8 characters long and a multiple of 4. e.g 8, 12, 16. |
| config.theme.faviconUrl | string | `""` | Optional URL to a custom favicon for the MultiJuicer balancer UI (the team join, scoreboard and admin pages), e.g. `http://example.com/favicon.svg`. An `.svg` is the preferred format; raster formats (`.ico`/`.png`) also work for the regular favicon, might come with issues in some browsers. This does NOT theme the Juice Shop instances themselves — use `config.juiceShop.config.application.favicon` for that. If this points to an external host, update `contentSecurityPolicy` to allow that image source. |
| config.theme.logoUrl | string | `""` | Optional URL to a custom logo for the MultiJuicer balancer UI (the team join, scoreboard and admin pages), e.g. `http://example.com/logo.svg`. A horizontally-oriented logo is preferred, as the default MultiJuicer logo combines an icon with the "MultiJuicer" wordmark. This does NOT theme the Juice Shop instances themselves — use `config.juiceShop.config.application.logo` for that. If this points to an external host, update `contentSecurityPolicy` to allow that image source. |
| containerSecurityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Optional securityContext on container level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#securitycontext-v1-core |
| contentSecurityPolicy | string | `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"` | Content Security Policy header configuration for index.html responses. Set to empty string to disable CSP header. |
| cookie.cookieParserSecret | string | `nil` | Set this to a fixed random alpha-numeric string (recommended length 24 chars). If not set this gets randomly generated with every helm upgrade, each rotation invalidates all active cookies / sessions requiring users to login again. |
| cookie.name | string | `"multi-juicer"` | Changes the cookies name used to identify teams. |
| cookie.secure | bool | `false` | Sets the secure attribute on cookie so that it only be send over https |
| imagePullPolicy | string | `"IfNotPresent"` |  |
| imagePullSecrets | list | `[]` | imagePullSecrets used for the multi-juicer image. You'll also need to set `config.juiceShop.imagePullSecrets` to set the imagePullSecrets if you are using a private registry for all images |
| ingress.annotations | object | `{}` |  |
| ingress.enabled | bool | `false` |  |
| ingress.hosts[0].host | string | `"multi-juicer.local"` |  |
| ingress.hosts[0].paths[0] | string | `"/"` |  |
| ingress.ingressClassName | string | `"nginx"` |  |
| ingress.tls | list | `[]` |  |
| logLevel | string | `"info"` | Log level for the multi-juicer service. One of: debug, info, warn, error |
| metrics.dashboards.enabled | bool | `false` | if true, creates a Grafana Dashboard Config Map. These will automatically be imported by Grafana when using the Grafana helm chart, see: https://github.com/grafana/helm-charts/tree/main/charts/grafana#sidecar-for-datasources |
| metrics.serviceMonitor.enabled | bool | `false` | If true, creates a Prometheus Operator ServiceMonitor. This will also deploy a servicemonitor which monitors metrics from the Juice Shop instances |
| metrics.serviceMonitor.labels | object | `{}` | If you use the kube-prometheus-stack helm chart, the default label looked for is `release=<kube-prometheus-release-name> |
| nodeSelector | object | `{}` |  |
| pod.annotations | object | `{}` | Optional Additional annotations for the multi-juicer pods. |
| pod.labels | object | `{}` | Optional Additional labels for the multi-juicer pods. |
| podSecurityContext | object | `{"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}` | Optional securityContext on pod level: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.28/#podsecuritycontext-v1-core |
| replicas | int | `1` | Number of replicas of the multi-juicer deployment |
| repository | string | `"ghcr.io/juice-shop/multi-juicer/multi-juicer"` |  |
| resources.limits.cpu | string | `"400m"` |  |
| resources.limits.memory | string | `"256Mi"` |  |
| resources.requests.cpu | string | `"400m"` |  |
| resources.requests.memory | string | `"256Mi"` |  |
| service.clusterIP | string | `nil` | internal cluster service IP |
| service.externalIPs | string | `nil` | IP address to assign to load balancer (if supported) |
| service.loadBalancerIP | string | `nil` | IP address to assign to load balancer (if supported) |
| service.loadBalancerSourceRanges | string | `nil` | list of IP CIDRs allowed access to lb (if supported) |
| service.port | int | `8080` | Service port for the multi-juicer service |
| service.type | string | `"ClusterIP"` | Kubernetes service type |
| tag | string | `nil` |  |
| tolerations | list | `[]` | Optional Configure kubernetes toleration for the created JuiceShops (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
