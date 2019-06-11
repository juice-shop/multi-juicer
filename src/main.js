const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);

const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => res.send('JuiceBalancer 🎉🎢🚀'));
app.post('/balancer/join', async (req, res) => {
  const { teamname } = req.body;

  const startTime = new Date();
  console.log('Creating deployment 🎢');
  await createDeploymentForTeam(teamname);
  console.log('Created deployment ✅. Waiting for JuiceShop to boot.');

  for (const _ of Array.from({ length: 100 })) {
    const res = await k8sAppsApi.readNamespacedDeployment(
      `t-${teamname}-juiceshop`,
      'default'
    );

    if (res.body.status.availableReplicas === 1) {
      break;
    }

    await sleep(250);
  }
  console.log('All Started Up 👌');

  const endTime = new Date();
  const differenceMs = endTime.getTime() - startTime.getTime();
  console.log(`Juice Shop StartUp Time: ${differenceMs.toLocaleString()}ms`);

  await createServiceForTeam(teamname).catch(console.error);

  res.send('Started 🎉🎢🚀');
});

app.listen(port, () => console.log(`JuiceBalancer listening on port ${port}!`));

setInterval(async () => {
  const res = await k8sAppsApi.listNamespacedDeployment(
    'default',
    true,
    undefined,
    undefined,
    undefined,
    'app=juice-shop'
  );

  console.log(`Current Deployments:`);
  for (const deployment of res.body.items) {
    console.log(` - ${deployment.metadata.name}`);
  }
}, 5000);

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
