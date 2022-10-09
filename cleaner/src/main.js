const { KubeConfig, AppsV1Api, CoreV1Api } = require('@kubernetes/client-node');

const { parseTimeDurationString, msToHumanReadable } = require('./time');

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
    `Looking for Instances & namespaces which have been inactive for more than ${MaxInactiveDuration}.`
  );
  const instances = await k8sAppsApi.listDeploymentForAllNamespaces(
    true,
    undefined,
    undefined,
    'app in (wrongsecrets, virtualdesktop)',
    200
  );

  console.log(`Found ${instances.body.items.length} instances. Checking their activity.`);

  for (const instance of instances.body.items) {
    const instanceName = instance.metadata.name;
    const lastConnectTimestamps = parseInt(
      instance.metadata.annotations['wrongsecrets-ctf-party/lastRequest'],
      10
    );

    console.log(`Checking instance: '${instanceName}'.`);

    const currentTime = new Date().getTime();

    const timeDifference = currentTime - lastConnectTimestamps;

    if (timeDifference > MaxInactiveDurationInMs) {
      console.log(
        `Instance: '${instanceName}'. Instance hasn't been used in ${msToHumanReadable(
          timeDifference
        )}.`
      );
      var teamname = instance.metadata.labels.team;
      console.log(`Instance belongs to namespace ${teamname}`);
      s
      try {
        console.log(`not yet implemented, but would be deleting namespace ${teamname} now`)
        // await k8sAppsApi.deleteNamespacedDeployment(instanceName, teamname);
        counts.successful.deployments++;
      } catch (error) {
        counts.failed.deployments++;
        console.error(
          `Failed to delete namespace '${teamname}'`
        );
        console.error(error);
      }
    } else {
      console.log(
        `Not deleting Instance: '${instanceName}' from '${teamname}'. Been last active ${msToHumanReadable(
          timeDifference
        )} ago.`
      );
    }
  }

  return counts;
}

main()
  .then((counts) => {
    console.log('Finished WrongSecrets Instance Cleanup');
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
