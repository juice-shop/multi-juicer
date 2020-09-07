const { KubeConfig, AppsV1Api, CoreV1Api } = require('@kubernetes/client-node');

const { parseTimeDurationString, msToHumanReadable } = require('./time');

const Namespace = process.env['NAMESPACE'];

const kc = new KubeConfig();
kc.loadFromCluster();

const k8sAppsApi = kc.makeApiClient(AppsV1Api);
const k8sCoreApi = kc.makeApiClient(CoreV1Api);

const MaxInactiveDuration = process.env['MAX_INACTIVE_DURATION'];
const MaxInactiveDurationInMs = parseTimeDurationString(MaxInactiveDuration);

if (MaxInactiveDurationInMs === null) {
  throw new Error(`
    Could not parse configured MAX_INACTIVE_DURATION.
    Duration has to formatted like the following examples:
    "3d" for 3 days,
    "12h" for 12 hours,
    "30m" for 30 minutes.
  `);
}

async function main() {
  const counts = {
    successful: {
      deployments: 0,
      services: 0,
    },
    failed: {
      deployments: 0,
      services: 0,
    },
  };

  console.log(
    `Looking for Juice Shop Instances which have been inactive for more than ${MaxInactiveDuration}.`
  );
  const instances = await k8sAppsApi.listNamespacedDeployment(
    Namespace,
    true,
    undefined,
    undefined,
    undefined,
    'app=juice-shop'
  );

  console.log(`Found ${instances.body.items.length} instances. Checking their activity.`);

  for (const instance of instances.body.items) {
    const instanceName = instance.metadata.name;
    const lastConnectTimestamps = parseInt(
      instance.metadata.annotations['multi-juicer.iteratec.dev/lastRequest'],
      10
    );

    console.log(`Checking instance: "${instanceName}".`);

    const currentTime = new Date().getTime();

    const timeDifference = currentTime - lastConnectTimestamps;

    if (timeDifference > MaxInactiveDurationInMs) {
      console.log(
        `Deleting Instance: "${instanceName}". Instance hasn't been used in ${msToHumanReadable(
          timeDifference
        )}.`
      );
      try {
        await k8sAppsApi.deleteNamespacedDeployment(instanceName, Namespace);
        counts.successful.deployments++;
      } catch (error) {
        counts.failed.deployments++;
        console.error(
          `Failed to delete deployment: "${instanceName}" from namespace "${Namespace}"`
        );
        console.error(error);
      }
      try {
        await k8sCoreApi.deleteNamespacedService(instanceName, Namespace);
        counts.successful.services++;
      } catch (error) {
        counts.failed.services++;
        console.error(`Failed to delete service: "${instanceName}" from namespace "${Namespace}"`);
      }
    } else {
      console.log(
        `Not deleting Instance: "${instanceName}". Been last active ${msToHumanReadable(
          timeDifference
        )} ago.`
      );
    }
  }

  return counts;
}

main()
  .then((counts) => {
    console.log('Finished Juice Shop Instance Cleanup');
    console.log('');
    console.log('Successful deletions:');
    console.log(`  Deployments: ${counts.successful.deployments}`);
    console.log(`  Services: ${counts.successful.services}`);
    console.log('Failed deletions:');
    console.log(`  Deployments: ${counts.failed.deployments}`);
    console.log(`  Services: ${counts.failed.services}`);
  })
  .catch((err) => {
    console.error('Failed deletion tasks');
    console.error(err);
  });
