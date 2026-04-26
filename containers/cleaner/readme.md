# Cleaner

![Cleaner Cover](./cleaner-cover.svg)

Cleaner is a sub component of MultiJuicer.
Cleaner runs via a Kubernetes CronJob, which looks up JuiceShop deployments in it's namespace and deletes the ones which have been unused for longer than a configurable duration (default 24 hours).
