# Deploying MultiJuicer with ArgoCD

MultiJuicer's Helm chart generates random signing keys on first install. On a normal `helm install`/`helm upgrade` (helm CLI, k3s' built-in `helm-controller`, FluxCD's `HelmRelease`), the chart calls Helm's [`lookup`](https://helm.sh/docs/chart_template_guide/functions_and_pipelines/#using-the-lookup-function) function to read the existing `multi-juicer-secret` and re-use the values across upgrades, so the keys stay stable.

**ArgoCD renders manifests with `helm template`, which has no cluster context, so `lookup` returns `nil` on every sync.** Without one of the workarounds below, every ArgoCD sync would generate fresh random values, ArgoCD would observe a diff against the live Secret, and (with self-healing enabled) would "correct" the live values — invalidating every active user session and breaking every running Juice Shop pod's webhook URL.

This is a [known, long-standing ArgoCD limitation](https://github.com/argoproj/argo-cd/issues/5202) with an [in-progress enhancement proposal](https://github.com/argoproj/argo-cd/issues/21745) to add cluster-aware rendering via `helm template --dry-run=server`. Until that ships, configure your `Application` as below.

## Tell ArgoCD to ignore the Secret's `/data` fields

Let the chart generate the values on first sync, and tell ArgoCD to leave them alone afterwards:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
spec:
  ignoreDifferences:
    - group: ""
      kind: Secret
      name: multi-juicer-secret
      jsonPointers:
        - /data/cookieParserSecret
        - /data/webhookSigningKey
        - /data/adminPassword
  syncPolicy:
    automated:
      selfHeal: true
    syncOptions:
      - RespectIgnoreDifferences=true
```

Notes:

- `RespectIgnoreDifferences=true` is required when `selfHeal: true` is set, otherwise ArgoCD will fight `ignoreDifferences` and keep trying to re-apply the rendered (random) values. See [ArgoCD sync options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/#respect-ignore-difference-configs).
- The first sync still generates random values via `randAlphaNum`. After that, `ignoreDifferences` keeps them stable.

## Alternative — manage the Secret yourself

If your team already has tooling for delivering Kubernetes Secrets into the cluster out-of-band — [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets), the [External Secrets Operator](https://external-secrets.io/), Vault sidecar injection, or just `kubectl apply` — you can manage the `multi-juicer-secret` yourself and point the chart at it:

```yaml
# Application -> spec.source.helm.values
existingSecret:
  name: my-multi-juicer-secret
```

The Secret must contain three keys: `cookieParserSecret`, `webhookSigningKey`, and `adminPassword`. When `existingSecret.name` is set, the chart skips its own Secret template entirely, so `lookup`'s ArgoCD limitation no longer applies.

## Further reading

- [ArgoCD: Helm chart user guide](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/) — official notes on `randAlphaNum` and explicit-value overrides.
- [ArgoCD: Diffing](https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/) — the `ignoreDifferences` reference.
- [ArgoCD: Sync options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/) — including `RespectIgnoreDifferences`.
