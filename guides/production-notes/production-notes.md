# Production Checklist

To ensure MultiJuicer runs as smoothly during your CTF's / trainings / workshops, heres a list of things you might want to make sure is configured correctly before you run MultiJuicer in "production".

1. As you are running this with https (right?), you should set `cookie.secure` to `true`. This marks the cookie used to associate a browser with a team to transmitted via https only.
2. Make sure the value you have configured for `juiceShop.maxInstances` fits your CTF / training / whatever you are running. The default is set to only allow 10 instances. Set to -1 to remove any restrictions.
3. Set `replicas` to at least 2, so that you have at least one fall back MultiJuicer when one crashes or the node it lives on goes down.
4. When running a CTF with JuiceShop challenge flags, make sure to change `juiceShop.ctfKey` from the default. Otherwise users will be able to generate their own flags relatively easily. Additionally, include the `juiceShop.nodeEnv` value and specify it as "ctf". This way, it will generate flags for the CTF event. The default behavior is to not generate them.

## Signing keys & admin password

The chart manages a `multi-juicer-secret` Kubernetes Secret holding the cookie signing key, the webhook signing key, and the admin password. On first install it fills the Secret with random values; on subsequent `helm upgrade`s it preserves the existing values via Helm's `lookup` function. Under standard Helm, k3s' built-in `helm-controller`, or FluxCD's `HelmRelease`, you do **not** need to configure anything here.

If you want to manage the Secret yourself (e.g. via Sealed Secrets, External Secrets Operator, or `kubectl` out-of-band), set `existingSecret.name` to its name. The Secret must contain three keys: `cookieParserSecret`, `webhookSigningKey`, and `adminPassword`.

If you deploy via **ArgoCD** (or any other tool that renders with `helm template` rather than `helm install`/`helm upgrade`), see the [ArgoCD deployment guide](../argocd/argocd.md) — `lookup` doesn't work in that mode.

## Security Consideration

Add SecurityContext and PodSecurityContext further isolate and secure your training platform.

## TLDR

Here's a example helm values file:

```yaml
replicas: 3
cookie:
  secure: true

juiceShop:
  maxInstances: 42
  nodeEnv: "ctf"
  ctfKey: "DONT_LET_ME_FIND_YOU_USING_THIS_EXACT_VALUE"
```
