# Production Checklist

To ensure MultiJuicer runs as smoothly during your CTF's / trainings / workshops, heres a list of things you might want to make sure is configured correctly before you run MultiJuicer in "production".

1. Set `.balancer.cookie.cookieParserSecret` to a random alpha-numeric value (recommended length 24 chars), this value is used to sign cookies. If you don't set this, each `helm upgrade` you run will generate a new one, which invalidates all user sessions, forcing users to rejoin their team.
2. As you are running this with https (right?), you should set `balancer.cookie.secure` to `true`. This marks the cookie used to associate a browser with a team to transmitted via https only.
3. Make sure the value you have configured for `wrongsecrets.maxInstances` & `virtualdesktop.maxInstances` fits your CTF / training / whatever you are running. The default is set to only allow 10 instances. Set to -1 to remove any restrictions.
4. Set `balancer.replicas` to at least 2, so that you have at least one fall back JuiceBalancer when one crashes or the node it lives on goes down.
5. When running a CTF with JuiceShop challenge flags, make sure to change `juiceShop.ctfKey` from the default. Otherwise users will be able to generate their own flags relatively easily. See
6. When using prometheus metrics, e.g. when you have followed the [Monitoring SetUp Guide](https://github.com/iteratec/multi-juicer/blob/main/guides/monitoring-setup/monitoring.md) you'll want to change `balancer.metrics.basicAuth.password` to a non default values. Otherwise users can use the default value to access the technical metrics of the JuiceBalancer pods.
7. If you host this CTF in a public domain, change the `balancer.env.REACT_APP_ACCESS_PASSWORD` to a password you communicate to your users at the start of teh CTF.
8. Make sure to rotate the `balancer.env.REACT_APP_CREATE_TEAM_HMAC_KEY` HMAC key for anti-infra-creation-fuzzing as well into something else than 'hardcodedkey' when you see players generating 100s of instances in minutes.

## TLDR

Here's a example helm values file:

```yaml
balancer:
  replicas: 3
  cookie:
    cookieParserSecret: "THIS_IS_A_EXAMPLE_DONT_USE_THIS_AS_THE_ACTUAL_SECRET"
    secure: true
  metrics:
    basicAuth:
      password: "ROTATE_THIS_YOU_LAZY_ASS"
  env:
    REACT_APP_ACCESS_PASSWORD: 'CHANGE_THIS_ASS_WELL'
    REACT_APP_CREATE_TEAM_HMAC_KEY: 'PLEASE_CHANGE_ME'

juiceShop:
  maxInstances: 42
  ctfKey: "DONT_LET_ME_FIND_YOU_USING_THIS_EXACT_VALUE"
```
