const express = require('express');
const {
  createDeploymentForTeam,
  createServiceForTeam,
  getJuiceShopInstances,
  getJuiceShopInstanceForTeamname,
} = require('./kubernetes/kubernetes');

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
    const res = await getJuiceShopInstanceForTeamname(teamname);

    if (res.body.status.availableReplicas === 1) {
      break;
    }

    await sleep(250);
  }
  console.log('All Started Up 👌');

  const endTime = new Date();
  const differenceMs = endTime.getTime() - startTime.getTime();
  console.log(`Juice Shop StartUp Time: ${differenceMs.toLocaleString()}ms`);

  await createServiceForTeam(teamname);

  res.send('Started 🎉🎢🚀');
});

app.listen(port, () => console.log(`JuiceBalancer listening on port ${port}!`));

setInterval(async () => {
  const res = await getJuiceShopInstances();
  console.log(`Current Deployments:`);
  for (const deployment of res.body.items) {
    console.log(` ∙ ${deployment.metadata.name}`);
  }
}, 5000);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
