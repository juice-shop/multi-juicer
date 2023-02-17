const { parseTimeDurationString, msToHumanReadable } = require('./time');

const {
  getTeamInstances,
  getTeamJuiceShopInstances,
  getNamespaces,
  deleteNamespaceForTeam,
} = require('./kubernetes');

const MaxInactiveDuration = process.env['MAX_INACTIVE_DURATION'];
const ShouldDelete = process.env['SHOULD_DELETE'];
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
/**
 * The approach is simple:
 * 1. Get all namespaces and loop over them
 * 2. For each namespace, get all wrongsecrets deployments and loop over them
 * 3. For each deployment, check if it has been inactive for more than the configured duration
 * 4. If it has, count it
 * 5. If it hasn't, skip it
 * 6. Repeat for all deployments
 * 7. If the number of inactive deployments equals the number of all deployments, delete the namespace
 * 8. Repeat for all namespaces
 * 9. Print out some stats
 * 10. Exit
 */
async function main() {
  console.log('Starting WrongSecrets Instance Cleanup');
  console.log('');
  console.log('Configuration:');
  console.log(`  MAX_INACTIVE_DURATION: ${MaxInactiveDuration}`);
  console.log(`  SHOULD_DELETE: ${ShouldDelete}`);
  console.log('');
  const namespacesNames = await listOldNamespaces();
  const counts = await deleteNamespaces(namespacesNames);
  console.log('');
  console.log('Finished WrongSecrets Instance Cleanup');
  console.log('');
  console.log('Successful deletions:');
  console.log(`  Namespaces: ${counts.successful.namespaces}`);
  console.log('Failed deletions:');
  console.log(`  Namespaces: ${counts.failed.namespaces}`);
}

async function listOldNamespaces() {
  var namespacesNames = [];
  // Get all namespaces
  const namespaces = await getNamespaces();
  console.log(`Found ${namespaces.body.items.length} namespaces. Checking their activity.`);
  // Loop over all namespaces
  for (const namespace of namespaces.body.items) {
    console.log(`Checking ${namespace.metadata.name} namespaces activity.`);
    // Get the name of the namespace
    const namespaceName = namespace.metadata.name;
    console.log('Looking for deployments in namespace ' + namespaceName);
    // Get all deployments in the namespace
    const deployments = await getTeamJuiceShopInstances(namespaceName);
    // Check if deployments exist, if not, skip the namespace
    // IMPORTANT: In case the namespace is completely empty, it will not be deleted as the user might want it as a playground
    if (deployments === undefined || deployments.body.items.length === 0) {
      console.log(`No wrongsecrets deployments found in namespace ${namespaceName}. Skipping...`);
      continue;
    }
    // Check if the namespace is only used by the wrongsecrets instance. If not, skip the namespace
    const AllDeployments = await getTeamInstances(namespaceName);
    if (AllDeployments.body.items.length > deployments.body.items.length) {
      console.log(`Namespace ${namespaceName} is used by other deployments. Skipping...`);
      continue;
    }
    console.log(`Found ${deployments.body.items.length} wrongsecrets deployments
     in namespace ${namespaceName}.`);
    //Assume all deployments are active at first
    var numberOfActiveDeployments = deployments.body.items.length;
    // Loop over all deployments
    for (const deployment of deployments.body.items) {
      // Get the name of the deployment
      const deploymentName = deployment.metadata.name;
      const lastConnectTimestamps = parseInt(
        deployment.metadata.annotations['wrongsecrets-ctf-party/lastRequest'],
        10
      );

      console.log(`Checking deployment: '${deploymentName}'.`);

      const currentTime = new Date().getTime();

      const timeDifference = currentTime - lastConnectTimestamps;
      var teamname = deployment.metadata.labels.team;
      if (timeDifference > MaxInactiveDurationInMs) {
        console.log(
          `Instance: '${deploymentName}'. Instance hasn't been used in ${msToHumanReadable(
            timeDifference
          )}.`
        );
        console.log(`Considered inactive.`);
        numberOfActiveDeployments--;
      } else {
        console.log(
          `Instance: '${deploymentName}' from '${teamname}'. Been last active ${msToHumanReadable(
            timeDifference
          )} ago.`
        );
        console.log(`Considered active. The namespace will not be deleted.`);
        // If the deployment is active, we can break the loop
        break;
      }
    }
    // If all deployments are inactive, add the namespace to the list
    if (numberOfActiveDeployments === 0) {
      console.log(`All deployments in namespace ${namespaceName} are inactive. Should be deleted.`);
      namespacesNames.push(namespaceName);
    }
  }
  return namespacesNames;
}

async function deleteNamespaces(namespaceNames) {
  const counts = {
    successful: {
      namespaces: 0,
    },
    failed: {
      namespaces: 0,
    },
  };
  // Check if the list is empty
  if (namespaceNames === undefined || namespaceNames.length === 0) {
    console.log('No namespaces to delete.');
    return counts;
  }
  // Check for the SHOULD_DELETE environment variable
  if (ShouldDelete === 'false') {
    console.log('SHOULD_DELETE is set to false. Skipping deletion.');
    return counts;
  }
  // Loop over all namespaces
  for (const namespaceName of namespaceNames) {
    console.log(`Deleting namespace ${namespaceName}...`);
    try {
      await deleteNamespaceForTeam(namespaceName);
      counts.successful.namespaces++;
    } catch (err) {
      counts.failed.namespaces++;
      console.error(`Failed to delete namespace ${namespaceName}.`);
      // console.error(err);
    }
  }
  return counts;
}
module.exports = {
  listOldNamespaces,
  deleteNamespaces,
};

main().catch((err) => {
  console.error('Failed deletion tasks');
  console.error(err);
});
