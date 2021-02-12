const { KubeConfig, AppsV1Api, CoreV1Api } = require('@kubernetes/client-node');
const kc = new KubeConfig();
kc.loadFromCluster();

const k8sAppsApi = kc.makeApiClient(AppsV1Api);
const k8sCoreApi = kc.makeApiClient(CoreV1Api);

const { get } = require('./config');

const lodashGet = require('lodash/get');
const once = require('lodash/once');

// Gets the Deployment uid for the JuiceBalancer
// This is required to set the JuiceBalancer as owner of the created JuiceShop Instances
const getJuiceBalancerDeploymentUid = once(async () => {
  const deployment = await k8sAppsApi.readNamespacedDeployment('juice-balancer', get('namespace'));
  return lodashGet(deployment, ['body', 'metadata', 'uid'], null);
});

const createDeploymentForTeam = async ({ team, passcodeHash }) => {
  const deploymentConfig = {
    metadata: {
      name: `t-${team}-juiceshop`,
      labels: {
        app: 'juice-shop',
        team,
        'deployment-context': get('deploymentContext'),
      },
      annotations: {
        'multi-juicer.iteratec.dev/lastRequest': `${new Date().getTime()}`,
        'multi-juicer.iteratec.dev/lastRequestReadable': new Date().toString(),
        'multi-juicer.iteratec.dev/passcode': passcodeHash,
        'multi-juicer.iteratec.dev/challengesSolved': '0',
        'multi-juicer.iteratec.dev/continueCode': '',
      },
      ...(await getOwnerReference()),
    },
    spec: {
      selector: {
        matchLabels: {
          app: 'juice-shop',
          team,
          'deployment-context': get('deploymentContext'),
        },
      },
      template: {
        metadata: {
          labels: {
            app: 'juice-shop',
            team,
            'deployment-context': get('deploymentContext'),
          },
        },
        spec: {
          automountServiceAccountToken: false,
          securityContext: get('juiceShop.securityContext'),
          containers: [
            {
              name: 'juice-shop',
              image: `${get('juiceShop.image')}:${get('juiceShop.tag')}`,
              imagePullPolicy: get('juiceShop.imagePullPolicy'),
              resources: get('juiceShop.resources'),
              env: [
                {
                  name: 'NODE_ENV',
                  value: get('juiceShop.nodeEnv'),
                },
                {
                  name: 'CTF_KEY',
                  value: get('juiceShop.ctfKey'),
                },
                ...get('juiceShop.env', []),
              ],
              envFrom: get('juiceShop.envFrom'),
              ports: [
                {
                  containerPort: 3000,
                },
              ],
              readinessProbe: {
                httpGet: {
                  path: '/rest/admin/application-version',
                  port: 3000,
                },
                initialDelaySeconds: 5,
                periodSeconds: 2,
                failureThreshold: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: '/rest/admin/application-version',
                  port: 3000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 15,
              },
              volumeMounts: [
                {
                  name: 'juice-shop-config',
                  mountPath: '/juice-shop/config/multi-juicer.yaml',
                  subPath: 'multi-juicer.yaml',
                },
                ...get('juiceShop.volumeMounts', []),
              ],
            },
          ],
          volumes: [
            {
              name: 'juice-shop-config',
              configMap: {
                name: 'juice-shop-config',
              },
            },
            ...get('juiceShop.volumes', []),
          ],
        },
      },
    },
  };

  return k8sAppsApi
    .createNamespacedDeployment(get('namespace'), deploymentConfig)
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
};

module.exports.createDeploymentForTeam = createDeploymentForTeam;

const createServiceForTeam = async (teamname) =>
  k8sCoreApi
    .createNamespacedService(get('namespace'), {
      metadata: {
        name: `t-${teamname}-juiceshop`,
        labels: {
          app: 'juice-shop',
          team: teamname,
          'deployment-context': get('deploymentContext'),
        },
        ...(await getOwnerReference()),
      },
      spec: {
        selector: {
          app: 'juice-shop',
          team: teamname,
          'deployment-context': get('deploymentContext'),
        },
        ports: [
          {
            port: 3000,
          },
        ],
      },
    })
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
module.exports.createServiceForTeam = createServiceForTeam;

async function getOwnerReference() {
  if (get('skipOwnerReference') === true) {
    return {};
  }
  return {
    ownerReferences: [
      {
        apiVersion: 'apps/v1',
        blockOwnerDeletion: true,
        controller: true,
        kind: 'Deployment',
        name: 'juice-balancer',
        uid: await getJuiceBalancerDeploymentUid(),
      },
    ],
  };
}

const getJuiceShopInstances = () =>
  k8sAppsApi
    .listNamespacedDeployment(
      get('namespace'),
      true,
      undefined,
      undefined,
      undefined,
      `app=juice-shop,deployment-context=${get('deploymentContext')}`
    )
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
module.exports.getJuiceShopInstances = getJuiceShopInstances;

const deleteDeploymentForTeam = async (team) => {
  await k8sAppsApi
    .deleteNamespacedDeployment(`t-${team}-juiceshop`, get('namespace'))
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
};
module.exports.deleteDeploymentForTeam = deleteDeploymentForTeam;

const deleteServiceForTeam = async (team) => {
  await k8sCoreApi
    .deleteNamespacedService(`t-${team}-juiceshop`, get('namespace'))
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
};
module.exports.deleteServiceForTeam = deleteServiceForTeam;

const deletePodForTeam = async (team) => {
  const res = await k8sCoreApi.listNamespacedPod(
    get('namespace'),
    true,
    undefined,
    undefined,
    undefined,
    `app=juice-shop,team=${team},deployment-context=${get('deploymentContext')}`
  );

  const pods = res.body.items;

  if (pods.length !== 1) {
    throw new Error(`Unexpected number of pods ${pods.length}`);
  }

  const podname = pods[0].metadata.name;

  await k8sCoreApi.deleteNamespacedPod(podname, get('namespace'));
};
module.exports.deletePodForTeam = deletePodForTeam;

const getJuiceShopInstanceForTeamname = (teamname) =>
  k8sAppsApi
    .readNamespacedDeployment(`t-${teamname}-juiceshop`, get('namespace'))
    .then((res) => {
      return {
        readyReplicas: res.body.status.readyReplicas,
        availableReplicas: res.body.status.availableReplicas,
        passcodeHash: res.body.metadata.annotations['multi-juicer.iteratec.dev/passcode'],
      };
    })
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
module.exports.getJuiceShopInstanceForTeamname = getJuiceShopInstanceForTeamname;

const updateLastRequestTimestampForTeam = (teamname) => {
  const headers = { 'content-type': 'application/strategic-merge-patch+json' };
  return k8sAppsApi.patchNamespacedDeployment(
    `t-${teamname}-juiceshop`,
    get('namespace'),
    {
      metadata: {
        annotations: {
          'multi-juicer.iteratec.dev/lastRequest': `${new Date().getTime()}`,
          'multi-juicer.iteratec.dev/lastRequestReadable': new Date().toString(),
        },
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    { headers }
  );
};
module.exports.updateLastRequestTimestampForTeam = updateLastRequestTimestampForTeam;

const changePasscodeHashForTeam = async (teamname, passcodeHash) => {
  const headers = { 'content-type': 'application/strategic-merge-patch+json' };
  const deploymentPatch = {
    metadata: {
      annotations: {
        'multi-juicer.iteratec.dev/passcode': passcodeHash,
      },
    },
  };

  await k8sAppsApi.patchNamespacedDeployment(
    `${teamname}-juiceshop`,
    get('namespace'),
    deploymentPatch,
    undefined,
    undefined,
    undefined,
    undefined,
    { headers }
  );
};
module.exports.changePasscodeHashForTeam = changePasscodeHashForTeam;
