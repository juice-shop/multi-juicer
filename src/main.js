const k8s = require('@kubernetes/client-node');
const ms = require('ms');

const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

const createDeploymentForTeam = teamname =>
  k8sAppsApi.createNamespacedDeployment('default', {
    metadata: {
      name: `t-${teamname}-juiceshop`,
      labels: {
        app: 'juice-shop',
        team: teamname,
      },
    },
    spec: {
      selector: {
        matchLabels: {
          app: 'juice-shop',
          team: teamname,
        },
      },
      template: {
        metadata: {
          labels: {
            app: 'juice-shop',
            team: teamname,
          },
        },
        spec: {
          automountServiceAccountToken: false,
          containers: [
            {
              name: 'juice-shop',
              image: 'bkimminich/juice-shop:v8.7.1',
              ports: [
                {
                  containerPort: 3000,
                },
              ],
            },
          ],
        },
      },
    },
  });

const createServiceForTeam = teamname =>
  k8sCoreApi.createNamespacedService('default', {
    metadata: {
      name: `t-${teamname}-juiceshop`,
      labels: {
        app: 'juice-shop',
        team: teamname,
      },
    },
    spec: {
      selector: {
        app: 'juice-shop',
        team: teamname,
      },
      ports: [
        {
          port: 3000,
        },
      ],
    },
  });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const teamname = 'team42';

  const startTime = new Date();
  console.log('Creating deployment 🎢');
  await createDeploymentForTeam(teamname);
  console.log('Created deployment ✅. Waiting for JuiceShop to boot.');

  for (const _ of Array.from({ length: 100 })) {
    const res = await k8sAppsApi.readNamespacedDeployment(
      `t-${teamname}-juiceshop`,
      'default'
    );

    console.log(`Available Replicas: ${res.body.status.availableReplicas}`);
    if (res.body.status.availableReplicas === 1) {
      break;
    }

    await sleep(100);
  }
  console.log('All Started Up 👌');

  const endTime = new Date();
  const differenceMs = endTime.getTime() - startTime.getTime();
  console.log(`Juice Shop StartUp Time: ${ms(differenceMs)}`);

  const res = await createServiceForTeam(teamname).catch(console.error);
}

main();

setTimeout(() => {
  console.log('finished');
}, 10000 * 1000);
