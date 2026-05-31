# Customizing

## Customizing the Juice Shop Instances

JuiceShop comes with a wide range of configuration options that let you tailor the application to your event: switching the visual theme, swapping the logo, toggling hints, restricting which challenges are shown, and much more.

For the full list of available options, see the official JuiceShop customization docs: <https://help.owasp-juice.shop/part1/customization.html>

MultiJuicer applies the same configuration to every JuiceShop instance it spawns. You configure it through the `config.juiceShop.config` value in your Helm values file, which is rendered into JuiceShop's `config.yaml` and mounted into each instance.

> Note: `config.juiceShop.nodeEnv` must remain `multi-juicer` (the default) for `config.juiceShop.config` to take effect. Setting `nodeEnv` to anything else tells JuiceShop to load one of its built-in configs instead.

### Example: Switching to the `neon-fire` theme

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

## Customizing the MultiJuicer Balancer UI

The options above only theme the JuiceShop instances. The MultiJuicer balancer UI itself — the team join, scoreboard and admin pages — has its own logo and favicon, configured separately under `config.theme`.

### Example: Setting a custom logo and favicon

The following `values.yaml` points both the logo and favicon at an externally hosted image:

```yaml
config:
  theme:
    logoUrl: "https://raw.githubusercontent.com/juice-shop/juice-shop/refs/heads/master/frontend/src/assets/public/images/JuiceShop_Logo.svg"
    faviconUrl: "https://raw.githubusercontent.com/juice-shop/juice-shop/refs/heads/master/frontend/src/assets/public/images/JuiceShop_Logo.svg"

# The default Content Security Policy only allows images from MultiJuicer itself.
# When loading the logo/favicon from another host you must add it to `img-src`,
# otherwise the browser will block the image.
contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://raw.githubusercontent.com; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
```

> Note: the example above uses the square-ish JuiceShop logo for both values. It works fine as a favicon, but looks cramped in the logo slot — the default MultiJuicer logo combines an icon with the "MultiJuicer" wordmark, so a horizontally-oriented logo fills that space much better.

For the favicon, an `.svg` is the preferred format. Raster formats (`.ico`/`.png`) also work but might come with issues in some browsers.

Apply it the same way:

```sh
helm upgrade --install -f values.yaml multi-juicer oci://ghcr.io/juice-shop/multi-juicer/helm/multi-juicer
```
