const k8s = require('@kubernetes/client-node');

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

const getJuiceShopInstances = () =>
  k8sAppsApi.listNamespacedDeployment(
    'default',
    true,
    undefined,
    undefined,
    undefined,
    'app=juice-shop'
  );

const getJuiceShopInstanceForTeamname = teamname =>
  k8sAppsApi.readNamespacedDeployment(`t-${teamname}-juiceshop`, 'default');

module.exports.createDeploymentForTeam = createDeploymentForTeam;
module.exports.createServiceForTeam = createServiceForTeam;
module.exports.getJuiceShopInstances = getJuiceShopInstances;
module.exports.getJuiceShopInstanceForTeamname = getJuiceShopInstanceForTeamname;
