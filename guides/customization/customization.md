# Customizing the Juice Shop Instances

JuiceShop comes with a wide range of configuration options that let you tailor the application to your event: switching the visual theme, swapping the logo, toggling hints, restricting which challenges are shown, and much more.

For the full list of available options, see the official JuiceShop customization docs: <https://help.owasp-juice.shop/part1/customization.html>

MultiJuicer applies the same configuration to every JuiceShop instance it spawns. You configure it through the `config.juiceShop.config` value in your Helm values file, which is rendered into JuiceShop's `config.yaml` and mounted into each instance.

> Note: `config.juiceShop.nodeEnv` must remain `multi-juicer` (the default) for `config.juiceShop.config` to take effect. Setting `nodeEnv` to anything else tells JuiceShop to load one of its built-in configs instead.

## Example: Switching to the `neon-fire` theme

The following `values.yaml` switches every JuiceShop instance to the [`neon-fire` theme](https://help.owasp-juice.shop/part1/customization.html#_theming):

```yaml
config:
  juiceShop:
    config:
      application:
        theme: neon-fire
```

Apply it with:

```sh
helm upgrade --install -f values.yaml multi-juicer oci://ghcr.io/juice-shop/multi-juicer/helm/multi-juicer
```

Newly created JuiceShop instances will pick up the change immediately. Existing instances need to be restarted (e.g. via the admin page) to load the new config.
