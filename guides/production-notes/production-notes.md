# Production Checklist

To ensure MultiJuicer runs as smoothly during your CTF's / trainings / workshops, heres a list of things you might want to make sure is configured correctly before you run MultiJuicer in "production".

1. As you are running this with https (right?), you should set `cookie.secure` to `true`. This marks the cookie used to associate a browser with a team to transmitted via https only.
2. Make sure the value you have configured for `config.maxInstances` fits your CTF / training / whatever you are running. The default is set to only allow 10 instances. Set to -1 to remove any restrictions.
3. Set `replicas` to at least 2, so that you have at least one fall back MultiJuicer when one crashes or the node it lives on goes down.
4. When running a CTF with JuiceShop challenge flags, make sure to change `config.juiceShop.ctfKey` from the default. Otherwise users will be able to generate their own flags relatively easily. Additionally, include the `config.juiceShop.nodeEnv` value and specify it as "ctf". This way, it will generate flags for the CTF event. The default behavior is to not generate them.

## Signing keys (`cookieParserSecret`, `webhookSigningKey`)

The chart generates random values for `cookie.cookieParserSecret` and `webhook.signingKey` on first install and preserves them across subsequent `helm upgrade`s via Helm's `lookup` function. Under standard Helm, k3s' built-in `helm-controller`, or FluxCD's `HelmRelease`, you do **not** need to set these explicitly. A full `helm uninstall` deletes the Secret along with all Juice Shop deployments — on reinstall, fresh keys are generated, which is correct since the old keys would only sign URLs for instances that no longer exist.

If you deploy via **ArgoCD** (or any other tool that renders with `helm template` rather than `helm install`/`helm upgrade`), see the [ArgoCD deployment guide](../argocd/argocd.md). `lookup` doesn't work in that mode and you need to either set the values explicitly or configure `ignoreDifferences` on the `Application`.

## Security Consideration

Add SecurityContext and PodSecurityContext further isolate and secure your training platform.

## TLDR

Here's a example helm values file:

```yaml
replicas: 3
cookie:
  secure: true

config:
  maxInstances: 42
```

### When using a an external CTF Tool (e.g. CTFd)

```yaml
replicas: 3
cookie:
  cookieParserSecret: "THIS_IS_A_EXAMPLE_DONT_USE_THIS_AS_THE_ACTUAL_SECRET"
  secure: true

config:
  maxInstances: 42
  juiceShop:
    nodeEnv: "ctf"
    ctfKey: "DONT_LET_ME_FIND_YOU_USING_THIS_EXACT_VALUE"
```
