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

## Alternative — set the signing keys explicitly

If your team already has a setup for delivering encrypted secrets into ArgoCD Helm values at render time (e.g. [helm-secrets](https://github.com/jkroepke/helm-secrets) + [SOPS](https://github.com/getsops/sops), or the [ArgoCD Vault Plugin](https://argocd-vault-plugin.readthedocs.io/)), you can instead provide `cookie.cookieParserSecret`, `webhook.signingKey`, and `adminPassword` explicitly. Only go this route if that infrastructure is already in place, plaintext values in Git are not acceptable, and standing up SOPS/AVP just for MultiJuicer is probably more work than the `ignoreDifferences` approach above.

## Further reading

- [ArgoCD: Helm chart user guide](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/) — official notes on `randAlphaNum` and explicit-value overrides.
- [ArgoCD: Diffing](https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/) — the `ignoreDifferences` reference.
- [ArgoCD: Sync options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/) — including `RespectIgnoreDifferences`.
