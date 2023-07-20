![WrongSecrets CTF Party, to use WrongSecrets for CTF or online Education](https://raw.githubusercontent.com/OWASP/wrongsecrets/master/icon.png)
_Powered by MultiJuicer_

Running CTFs and Security Trainings with [OWASP WrongSecrets](https://github.com/OWASP/wrongsecrets) is usually quite tricky, WrongSecrets can be used by multiple users at one time, but this can cause issues when people start fuzzing.
Instructing everybody how to start WrongSecrets on their own machine works ok, but takes away too much valuable time.
Next, installing the additional tools required to learn basics of reverse-engineering might take to much time as well.

WrongSecrets CTF Party gives you the ability to run separate WrongSecrets instances for every participant on a central kubernetes cluster, to run events without the need for local WrongSecrets instances.

**What it does:**

- dynamically create new WrongSecrets instance when needed
- dynamically create new WrongSecret virtual desktop instances with all the addiontal tooling required to do the CTF/training when needed
- runs on a single domain, comes with a LoadBalancer sending the traffic to the participants WrongSecrets instance
- backup and auto apply challenge progress in case of Juice Shop container restarts
- cleanup old & unused instances automatically

It follows the same architecture as MultiJuicer below:
![MultiJuicer, High Level Architecture Diagram](https://raw.githubusercontent.com/iteratec/multi-juicer/main/high-level-architecture.svg)

## Usage

[Helm](https://helm.sh) must be installed to use the charts.  Please refer to
Helm's [documentation](https://helm.sh/docs) to get started.

Once Helm has been set up correctly, add the repo as follows:

    helm repo add wrongsecrets https://wrongsecrets.github.io/wrongsecrets-ctf-party

If you had already added this repo earlier, run `helm repo update` to retrieve
the latest versions of the packages.  You can then run `helm search repo
wrongsecrets` to see the charts.

To install the wrongsecrets-ctf-party chart:

    helm install my-wrongsecrets-ctf-party wrongsecrets/wrongsecrets-ctf-party

To uninstall the chart:

    helm delete my-wrongsecrets-ctf-party

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| balancer.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the created wrongsecrets instances (see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| balancer.basicAuth | object | `{"username":"admin"}` | Credentials used in wrongsecrets-balancer-secret to authenticate with the wrongsecrets-api |
| balancer.basicAuth.username | string | `"admin"` | Username for the basic auth credentials |
| balancer.containerPort | int | `3000` | Port to expose on the balancer pods which the container listens on |
| balancer.containerSecurityContext.allowPrivilegeEscalation | bool | `false` |  |
| balancer.containerSecurityContext.capabilities.add[0] | string | `"CAP_NET_ADMIN"` |  |
| balancer.containerSecurityContext.capabilities.add[1] | string | `"CAP_NET_BIND_SERVICE"` |  |
| balancer.containerSecurityContext.capabilities.drop[0] | string | `"ALL"` |  |
| balancer.containerSecurityContext.enabled | bool | `true` | If true, sets the securityContext on the created containers. This is required for the podSecurityPolicy to work |
| balancer.containerSecurityContext.readOnlyRootFilesystem | bool | `true` |  |
| balancer.containerSecurityContext.runAsNonRoot | bool | `true` |  |
| balancer.containerSecurityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| balancer.cookie.cookieParserSecret | string | `nil` | Set this to a fixed random alpa-numeric string (recommended length 24 chars). If not set this get randomly generated with every helm upgrade, each rotation invalidates all active cookies / sessions requirering users to login again. |
| balancer.cookie.name | string | `"balancer"` | Changes the cookies name used to identify teams. Note will automatically be prefixed with "__Secure-" when balancer.cookie.secure is set to `true` |
| balancer.cookie.secure | bool | `false` | Sets the secure attribute on cookie so that it only be send over https |
| balancer.env.CHALLENGE33_VALUE | string | `"VkJVR2gzd3UvM0kxbmFIajFVZjk3WTBMcThCNS85MnExandwMy9hWVN3SFNKSThXcWRabllMajc4aEVTbGZQUEtmMVpLUGFwNHoyK3IrRzlOUndkRlUvWUJNVFkzY05ndU1tNUM2bDJwVEs5SmhQRm5VemVySXdNcm5odTlHanJxU0ZuL0J0T3ZMblFhL21TZ1hETkpZVU9VOGdDSEZzOUpFZVF2OWhwV3B5eGxCMk5xdTBNSHJQTk9EWTNab2hoa2pXWGF4YmpDWmk5U3BtSHlkVTA2WjdMcVd5RjM5RzZWOENGNkxCUGtkVW4zYUpBVisrRjBROUljU009Cg=="` |  |
| balancer.env.IRSA_ROLE | string | `"arn:aws:iam::233483431651:role/wrongsecrets-secret-manager"` |  |
| balancer.env.K8S_ENV | string | `"k8s"` |  |
| balancer.env.REACT_APP_ACCESS_PASSWORD | string | `""` |  |
| balancer.env.REACT_APP_CREATE_TEAM_HMAC_KEY | string | `"hardcodedkey"` |  |
| balancer.env.REACT_APP_CTFD_URL | string | `"https://ctfd.io"` |  |
| balancer.env.REACT_APP_HEROKU_WRONGSECRETS_URL | string | `"https://wrongsecrets-ctf.herokuapp.com"` |  |
| balancer.env.REACT_APP_MOVING_GIF_LOGO | string | `"https://i.gifer.com/9kGQ.gif"` |  |
| balancer.env.REACT_APP_S3_BUCKET_URL | string | `"s3://funstuff"` |  |
| balancer.env.SECRETS_MANAGER_SECRET_ID_1 | string | `"wrongsecret"` |  |
| balancer.env.SECRETS_MANAGER_SECRET_ID_2 | string | `"wrongsecret-2"` |  |
| balancer.livenessProbe | object | `{"httpGet":{"path":"/balancer/","port":"http"}}` | livenessProbe: Checks if the balancer pod is still alive |
| balancer.metrics.basicAuth.password | string | `"ERzCT4pwBDxfCKRGmfrMa8KQ8sXf8GKy"` | Should be changed when metrics are enabled. |
| balancer.metrics.basicAuth.username | string | `"prometheus-scraper"` |  |
| balancer.metrics.dashboards.enabled | bool | `false` | if true, creates a Grafana Dashboard Config Map. (also requires metrics.enabled to be true). These will automatically be imported by Grafana when using the Grafana helm chart, see: https://github.com/helm/charts/tree/main/stable/grafana#sidecar-for-dashboards |
| balancer.metrics.enabled | bool | `true` | enables prometheus metrics for the balancer. If set to true you should change the prometheus-scraper password |
| balancer.metrics.serviceMonitor.enabled | bool | `false` | If true, creates a Prometheus Operator ServiceMonitor (also requires metrics.enabled to be true). This will also deploy a servicemonitor which monitors metrics from the Wrongsecrets instances |
| balancer.metrics.serviceMonitor.path | string | `"/balancer/metrics"` | Path to scrape for metrics |
| balancer.metrics.serviceMonitor.targetPort | int | `3000` | Target port for the ServiceMonitor to scrape |
| balancer.podSecurityContext.enabled | bool | `true` | If true, sets the securityContext on the created pods. This is required for the podSecurityPolicy to work |
| balancer.podSecurityContext.fsGroup | int | `2000` |  |
| balancer.podSecurityContext.runAsGroup | int | `3000` |  |
| balancer.podSecurityContext.runAsUser | int | `1000` |  |
| balancer.podSecurityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| balancer.readinessProbe | object | `{"httpGet":{"path":"/balancer/","port":"http"}}` | readinessProbe: Checks if the balancer pod is ready to receive traffic |
| balancer.replicas | int | `2` | Number of replicas of the wrongsecrets-balancer deployment. Changing this in a commit? PLEASE UPDATE THE GITHUB WORKLFOWS THEN!(NUMBER OF "TRUE") |
| balancer.repository | string | `"jeroenwillemsen/wrongsecrets-balancer"` |  |
| balancer.resources | object | `{"limits":{"cpu":"1000m","memory":"1024Mi"},"requests":{"cpu":"400m","memory":"256Mi"}}` | Resource limits and requests for the balancer pods |
| balancer.service.clusterIP | string | `nil` | internal cluster service IP |
| balancer.service.externalIPs | string | `nil` | IP address to assign to load balancer (if supported) |
| balancer.service.loadBalancerIP | string | `nil` | IP address to assign to load balancer (if supported) |
| balancer.service.loadBalancerSourceRanges | string | `nil` | list of IP CIDRs allowed access to lb (if supported) |
| balancer.service.type | string | `"ClusterIP"` | Kubernetes service type |
| balancer.skipOwnerReference | bool | `false` | If set to true this skips setting ownerReferences on the teams wrongsecrets Deployment and Services. This lets MultiJuicer run in older kubernetes cluster which don't support the reference type or the app/v1 deployment type |
| balancer.tag | string | `"1.6.6aws"` |  |
| balancer.tolerations | list | `[]` | Optional Configure kubernetes toleration for the created wrongsecrets instances (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
| balancer.volumeMounts[0] | object | `{"mountPath":"/home/app/config/","name":"config-volume"}` | If true, creates a volumeMount for the created pods. This is required for the podSecurityPolicy to work |
| balancer.volumes[0] | object | `{"configMap":{"name":"wrongsecrets-balancer-config"},"name":"config-volume"}` | If true, creates a volume for the created pods. This is required for the podSecurityPolicy to work |
| imagePullPolicy | string | `"IfNotPresent"` |  |
| ingress.annotations | object | `{}` | Annotations to be added to the ingress object. |
| ingress.enabled | bool | `false` | If true, Wrongsecrets will create an Ingress object for the balancer service. Useful if you want to expose the balancer service externally for example with a loadbalancer in order to view any webpages that are hosted on the balancer service. |
| ingress.hosts | list | `[{"host":"wrongsecrets-ctf-party.local","paths":["/"]}]` | Hostnames to your Wrongsecrets balancer installation. |
| ingress.tls | list | `[]` | TLS configuration for Wrongsecrets balancer |
| nodeSelector | object | `{}` |  |
| service.port | int | `3000` |  |
| service.portName | string | `"web"` |  |
| service.type | string | `"ClusterIP"` |  |
| vaultContainer.affinity | object | `{}` |  |
| vaultContainer.envFrom | list | `[]` |  |
| vaultContainer.image | string | `"hashicorp/vault"` | Juice Shop Image to use |
| vaultContainer.maxInstances | int | `500` | Specifies how many JuiceShop instances MultiJuicer should start at max. Set to -1 to remove the max Juice Shop instance cap |
| vaultContainer.repository | string | `"commjoenie/wrongSecrets"` |  |
| vaultContainer.resources.limits.cpu | string | `"1200m"` |  |
| vaultContainer.resources.limits.memory | string | `"256mb"` |  |
| vaultContainer.resources.request.cpu | string | `"50m"` |  |
| vaultContainer.resources.request.memory | string | `"128mb"` |  |
| vaultContainer.runtimeClassName | object | `{}` |  |
| vaultContainer.securityContext.allowPrivilegeEscalation | bool | `false` |  |
| vaultContainer.securityContext.capabilities.drop[0] | string | `"ALL"` |  |
| vaultContainer.securityContext.readOnlyRootFilesystem | bool | `true` |  |
| vaultContainer.securityContext.runAsNonRoot | bool | `true` |  |
| vaultContainer.securityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| vaultContainer.tag | string | `"1.15.1"` |  |
| vaultContainer.tolerations | list | `[]` |  |
| virtualdesktop.affinity | object | `{}` |  |
| virtualdesktop.envFrom | list | `[]` |  |
| virtualdesktop.image | string | `"jeroenwillemsen/wrongsecrets-desktop-k8s"` | Wrongsecrets Image to use |
| virtualdesktop.maxInstances | int | `500` | Specifies how many Wrongsecrets instances balancer should start at max. Set to -1 to remove the max Wrongsecrets instance cap |
| virtualdesktop.repository | string | `"commjoenie/wrongSecrets"` |  |
| virtualdesktop.resources.limits.cpu | string | `"1200m"` |  |
| virtualdesktop.resources.limits.memory | string | `"2GB"` |  |
| virtualdesktop.resources.request.cpu | string | `"50m"` |  |
| virtualdesktop.resources.request.memory | string | `"1GB"` |  |
| virtualdesktop.runtimeClassName | object | `{}` |  |
| virtualdesktop.securityContext.allowPrivilegeEscalation | bool | `false` |  |
| virtualdesktop.securityContext.capabilities.drop[0] | string | `"ALL"` |  |
| virtualdesktop.securityContext.readOnlyRootFilesystem | bool | `true` |  |
| virtualdesktop.securityContext.runAsNonRoot | bool | `true` |  |
| virtualdesktop.securityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| virtualdesktop.tag | string | `"1.6.6"` |  |
| virtualdesktop.tolerations | list | `[]` |  |
| wrongsecrets.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the created Wrongsecrets instances (see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| wrongsecrets.config | string | See values.yaml for full details | Specify a custom Wrongsecrets config.yaml. See the Wrongsecrets Docs for any needed ENVs: https://github.com/OWASP/wrongsecrets |
| wrongsecrets.ctfKey | string | `"zLp@.-6fMW6L-7R3b!9uR_K!NfkkTr"` | Change the key when hosting a CTF event. This key gets used to generate the challenge flags. See: https://github.com/OWASP/wrongsecrets#ctf |
| wrongsecrets.env | list | `[{"name":"K8S_ENV","value":"k8s"},{"name":"SPECIAL_K8S_SECRET","valueFrom":{"configMapKeyRef":{"key":"funny.entry","name":"secrets-file"}}},{"name":"SPECIAL_SPECIAL_K8S_SECRET","valueFrom":{"secretKeyRef":{"key":"funnier","name":"funnystuff"}}}]` | Optional environment variables to set for each Wrongsecrets instance (see: https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/) |
| wrongsecrets.envFrom | list | `[]` | Optional mount environment variables from configMaps or secrets (see: https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/#configure-all-key-value-pairs-in-a-secret-as-container-environment-variables) |
| wrongsecrets.image | string | `"jeroenwillemsen/wrongsecrets"` | Wrongsecrets Image to use |
| wrongsecrets.maxInstances | int | `500` | Specifies how many Wrongsecrets instances should start at max. Set to -1 to remove the max Wrongsecrets instance cap |
| wrongsecrets.nodeEnv | string | `"wrongsecrets-ctf-party"` | Specify a custom NODE_ENV for Wrongsecrets. If value is changed to something other than 'wrongsecrets-ctf-party' it's not possible to set a custom config via `wrongsecrets-balancer-config`. |
| wrongsecrets.resources | object | `{"requests":{"cpu":"256Mi","memory":"300Mi"}}` | Optional resources definitions to set for each Wrongsecrets instance |
| wrongsecrets.runtimeClassName | string | `nil` | Optional Can be used to configure the runtime class for the Wrongsecrets instances pods to add an additional layer of isolation to reduce the impact of potential container escapes. (see: https://kubernetes.io/docs/concepts/containers/runtime-class/) |
| wrongsecrets.securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true,"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}` | Optional securityContext definitions to set for each Wrongsecrets instance |
| wrongsecrets.tag | string | `"1.6.7RC3-no-vault"` |  |
| wrongsecrets.tolerations | list | `[]` | Optional Configure kubernetes toleration for the created Wrongsecrets instances (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
| wrongsecrets.volumes | list | `[]` | Optional Volumes to set for each Wrongsecrets instance (see: https://kubernetes.io/docs/concepts/storage/volumes/) |
| wrongsecretsCleanup.affinity | object | `{}` | Optional Configure kubernetes scheduling affinity for the wrongsecretsCleanup Job(see: https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) |
| wrongsecretsCleanup.containerSecurityContext.allowPrivilegeEscalation | bool | `false` |  |
| wrongsecretsCleanup.containerSecurityContext.capabilities.drop[0] | string | `"ALL"` |  |
| wrongsecretsCleanup.containerSecurityContext.enabled | bool | `true` | If true, sets the securityContext on the created containers. This is required for the podSecurityPolicy to work |
| wrongsecretsCleanup.containerSecurityContext.readOnlyRootFilesystem | bool | `true` |  |
| wrongsecretsCleanup.containerSecurityContext.runAsNonRoot | bool | `true` |  |
| wrongsecretsCleanup.containerSecurityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| wrongsecretsCleanup.cron | string | `"0,15,30,45 * * * *"` | Cron in which the clean up job is run. Defaults to once in a quarter. Change this if your grace period if shorter than 15 minutes. See "https://crontab.guru/#0,15,30,45_*_*_*_*" for more details. |
| wrongsecretsCleanup.enabled | bool | `true` |  |
| wrongsecretsCleanup.env.MAX_INACTIVE_DURATION | string | `"2d"` |  |
| wrongsecretsCleanup.env.SHOULD_DELETE | bool | `false` |  |
| wrongsecretsCleanup.failedJobsHistoryLimit | int | `1` |  |
| wrongsecretsCleanup.podSecurityContext.enabled | bool | `true` | If true, sets the securityContext on the created pods. This is required for the podSecurityPolicy to work |
| wrongsecretsCleanup.podSecurityContext.fsGroup | int | `2000` |  |
| wrongsecretsCleanup.podSecurityContext.runAsGroup | int | `3000` |  |
| wrongsecretsCleanup.podSecurityContext.runAsUser | int | `1000` |  |
| wrongsecretsCleanup.repository | string | `"jeroenwillemsen/wrongsecrets-ctf-cleaner"` |  |
| wrongsecretsCleanup.resources.limits.memory | string | `"256Mi"` |  |
| wrongsecretsCleanup.resources.requests.memory | string | `"256Mi"` |  |
| wrongsecretsCleanup.successfulJobsHistoryLimit | int | `1` |  |
| wrongsecretsCleanup.tag | float | `0.4` |  |
| wrongsecretsCleanup.tolerations | list | `[]` | Optional Configure kubernetes toleration for the wrongsecretsCleanup Job (see: https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/) |
