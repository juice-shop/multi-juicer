const { KubeConfig, AppsV1Api, CoreV1Api } = require('@kubernetes/client-node');
const kc = new KubeConfig();
kc.loadFromCluster();

const k8sAppsApi = kc.makeApiClient(AppsV1Api);
const k8sCoreApi = kc.makeApiClient(CoreV1Api);

const { get } = require('./config');

//used for owner ref, not used now:
// const lodashGet = require('lodash/get');
// const once = require('lodash/once');

//used for owner ref, not used now:
// Gets the Deployment uid for the JuiceBalancer
// This is required to set the JuiceBalancer as owner of the created JuiceShop Instances
// const getJuiceBalancerDeploymentUid = once(async () => {
//   const deployment = await k8sAppsApi.readNamespacedDeployment(
//     'wrongsecrets-balancer',
//     get('namespace')
//   );
//   return lodashGet(deployment, ['body', 'metadata', 'uid'], null);
// });

const createNameSpaceForTeam = async (team) => {
  const namedNameSpace = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: `t-${team}`,
    },
    labels: {
      name: `t-${team}`,
    },
  };
  k8sCoreApi.createNamespace(namedNameSpace).catch((error) => {
    throw new Error(error.response.body.message);
  });
};
module.exports.createNameSpaceForTeam = createNameSpaceForTeam;

const createConfigmapForTeam = async (team) => {
  const configmap = {
    apiVersion: 'v1',
    data: {
      'funny.entry': 'thisIsK8SConfigMap',
    },
    kind: 'ConfigMap',
    metadata: {
      annotations: {},
      name: 'secrets-file',
      namespace: `t-${team}`,
    },
  };
  return k8sCoreApi.createNamespacedConfigMap('t-' + team, configmap).catch((error) => {
    throw new Error(error.response.body.message);
  });
};
module.exports.createConfigmapForTeam = createConfigmapForTeam;

const createSecretsfileForTeam = async (team) => {
  const secret = {
    apiVersion: 'v1',
    data: {
      funnier: 'dGhpcyBpcyBhcGFzc3dvcmQ=',
    },
    kind: 'Secret',
    type: 'Opaque',
    metadata: {
      name: 'funnystuff',
      namespace: `t-${team}`,
    },
  };
  return k8sCoreApi.createNamespacedSecret('t-' + team, secret).catch((error) => {
    throw new Error(error.response.body.message);
  });
};
module.exports.createSecretsfileForTeam = createSecretsfileForTeam;

const createDeploymentForTeam = async ({ team, passcodeHash }) => {
  const deploymentWrongSecretsConfig = {
    metadata: {
      namespace: `t-${team}`,
      name: `t-${team}-wrongsecrets`,
      labels: {
        app: 'wrongsecrets',
        team,
        'deployment-context': get('deploymentContext'),
      },
      annotations: {
        'wrongsecrets-ctf-party/lastRequest': `${new Date().getTime()}`,
        'wrongsecrets-ctf-party/lastRequestReadable': new Date().toString(),
        'wrongsecrets-ctf-party/passcode': passcodeHash,
        'wrongsecrets-ctf-party/challengesSolved': '0',
        'wrongsecrets-ctf-party/challenges': '[]',
      },
      // ...(await getOwnerReference()),
    },
    spec: {
      selector: {
        matchLabels: {
          app: 'wrongsecrets',
          team,
          'deployment-context': get('deploymentContext'),
        },
      },
      template: {
        metadata: {
          labels: {
            app: 'wrongsecrets',
            team,
            'deployment-context': get('deploymentContext'),
          },
        },
        spec: {
          automountServiceAccountToken: false,
          securityContext: {
            runAsUser: 2000,
            runAsGroup: 2000,
            fsGroup: 2000,
          },
          containers: [
            {
              name: 'wrongsecrets',
              //TODO REPLACE HARDCODED BELOW WITH PROPPER GETS: image: `${get('wrongsecrets.image')}:${get('wrongsecrets.tag')}`,
              image: 'jeroenwillemsen/wrongsecrets:latest-no-vault',
              imagePullPolicy: get('wrongsecrets.imagePullPolicy'),
              // resources: get('wrongsecrets.resources'),
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                runAsNonRoot: true,
              },
              env: [
                {
                  name: 'hints_enabled',
                  value: 'false',
                },
                {
                  name: 'ctf_enabled',
                  value: 'true',
                },
                {
                  name: 'ctf_key',
                  value: 'notarealkeyyouknowbutyoumightgetflags',
                },
                {
                  name: 'K8S_ENV',
                  value: 'k8s',
                },
                {
                  name: 'SPECIAL_K8S_SECRET',
                  valueFrom: {
                    configMapKeyRef: {
                      name: 'secrets-file',
                      key: 'funny.entry',
                    },
                  },
                },
                {
                  name: 'SPECIAL_SPECIAL_K8S_SECRET',
                  valueFrom: {
                    secretKeyRef: {
                      name: 'funnystuff',
                      key: 'funnier',
                    },
                  },
                },
                ...get('wrongsecrets.env', []),
              ],
              envFrom: get('wrongsecrets.envFrom'),
              ports: [
                {
                  containerPort: 8080,
                },
              ],
              readinessProbe: {
                httpGet: {
                  path: '/',
                  port: 8080,
                },
                initialDelaySeconds: 20,
                periodSeconds: 2,
                failureThreshold: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: '/',
                  port: 8080,
                },
                initialDelaySeconds: 30,
                periodSeconds: 15,
              },
              resources: {
                requests: {
                  memory: '512Mi',
                  cpu: '200m',
                },
                limits: {
                  memory: '512Mi',
                  cpu: '200m',
                },
              },

              //#TODO: DELETE NAMESPACE WHEN DELETING BOTH PODS AND SERVICE!
              volumeMounts: [
                // {
                //   name: 'wrongsecrets-config',
                //   mountPath: '/wrongsecrets/config/wrongsecrets-ctf-party.yaml',
                //   subPath: 'wrongsecrets-ctf-party.yaml',
                // },
                {
                  mountPath: '/tmp',
                  name: 'cache-volume',
                },
                // ...get('wrongsecrets.volumeMounts', []),
              ],
            },
          ],
          volumes: [
            // {
            //   name: 'wrongsecrets-config',
            //   configMap: {
            //     name: 'wrongsecrets-config',
            //   },
            // },
            {
              name: 'cache-volume',
              emptyDir: {},
            },
            // ...get('wrongsecrets.volumes', []),
          ],
          tolerations: get('wrongsecrets.tolerations'),
          affinity: get('wrongsecrets.affinity'),
          runtimeClassName: get('wrongsecrets.runtimeClassName')
            ? get('wrongsecrets.runtimeClassName')
            : undefined,
        },
      },
    },
  };
  return k8sAppsApi
    .createNamespacedDeployment('t-' + team, deploymentWrongSecretsConfig)
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
};

module.exports.createDeploymentForTeam = createDeploymentForTeam;

const createDesktopDeploymentForTeam = async ({ team, passcodeHash }) => {
  const deploymentWrongSecretsDesktopConfig = {
    metadata: {
      name: `t-${team}-virtualdesktop`,
      namespace: `t-${team}`,
      labels: {
        app: 'virtualdesktop',
        team,
        'deployment-context': get('deploymentContext'),
      },
      annotations: {
        'wrongsecrets-ctf-party/lastRequest': `${new Date().getTime()}`,
        'wrongsecrets-ctf-party/lastRequestReadable': new Date().toString(),
        'wrongsecrets-ctf-party/passcode': passcodeHash,
        'wrongsecrets-ctf-party/challengesSolved': '0',
      },
      // ...(await getOwnerReference()),
    },
    spec: {
      selector: {
        matchLabels: {
          app: 'virtualdesktop',
          team,
          'deployment-context': get('deploymentContext'),
        },
      },
      template: {
        metadata: {
          labels: {
            app: 'virtualdesktop',
            team,
            'deployment-context': get('deploymentContext'),
            namespace: `t-${team}`,
          },
        },
        spec: {
          automountServiceAccountToken: false,
          // securityContext: {
          //   runAsUser: 911,
          //   runAsGroup: 911,
          //   fsGroup: 911,
          // },
          containers: [
            {
              name: 'virtualdesktop',
              //TODO REPLACE HARDCODED BELOW WITH PROPPER GETS: image: `${get('wrongsecrets.image')}:${get('wrongsecrets.tag')}`,
              image: 'jeroenwillemsen/wrongsecrets-desktop:latest',
              imagePullPolicy: get('virtualdesktop.imagePullPolicy'),
              resources: get('virtualdesktop.resources'),
              securityContext: {
                // allowPrivilegeEscalation: false,
                // readOnlyRootFilesystem: true,
              },
              env: [...get('virtualdesktop.env', [])],
              envFrom: get('virtualdesktop.envFrom'),
              ports: [
                {
                  containerPort: 3000,
                },
              ],
              readinessProbe: {
                httpGet: {
                  path: '/',
                  port: 3000,
                },
                initialDelaySeconds: 24,
                periodSeconds: 2,
                failureThreshold: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: '/',
                  port: 3000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 15,
              },
              volumeMounts: [{ mountPath: '/tmp', name: 'cache-volume' }],
            },
          ],
          volumes: [{ name: 'cache-volume', emptyDir: {} }],
          tolerations: get('virtualdesktop.tolerations'),
          affinity: get('virtualdesktop.affinity'),
          runtimeClassName: get('virtualdesktop.runtimeClassName')
            ? get('virtualdesktop.runtimeClassName')
            : undefined,
        },
      },
    },
  };

  return k8sAppsApi
    .createNamespacedDeployment('t-' + team, deploymentWrongSecretsDesktopConfig)
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
};

module.exports.createDesktopDeploymentForTeam = createDesktopDeploymentForTeam;

const createServiceForTeam = async (teamname) =>
  k8sCoreApi
    .createNamespacedService('t-' + teamname, {
      metadata: {
        namespace: `t-${teamname}`,
        name: `t-${teamname}-wrongsecrets`,
        labels: {
          app: 'wrongsecrets',
          team: teamname,
          'deployment-context': get('deploymentContext'),
        },
        // ...(await getOwnerReference()),
      },
      spec: {
        selector: {
          app: 'wrongsecrets',
          team: teamname,
          'deployment-context': get('deploymentContext'),
        },
        ports: [
          {
            port: 8080,
          },
        ],
      },
    })
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
module.exports.createServiceForTeam = createServiceForTeam;

const createDesktopServiceForTeam = async (teamname) =>
  k8sCoreApi
    .createNamespacedService('t-' + teamname, {
      metadata: {
        name: `t-${teamname}-virtualdesktop`,
        namespace: `t-${teamname}`,
        labels: {
          app: 'virtualdesktop',
          team: teamname,
          'deployment-context': get('deploymentContext'),
        },
        // ...(await getOwnerReference()),
      },
      spec: {
        selector: {
          app: 'virtualdesktop',
          team: teamname,
          'deployment-context': get('deploymentContext'),
        },
        ports: [
          {
            port: 8080,
            targetPort: 3000,
          },
        ],
      },
    })
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
module.exports.createDesktopServiceForTeam = createDesktopServiceForTeam;

//used for owner ref, not used now as we cannot do clusterwide owning of namespaced items:
// async function getOwnerReference() {
//   if (get('skipOwnerReference') === true) {
//     return {};
//   }
//   return {
//     ownerReferences: [
//       {
//         apiVersion: 'apps/v1',
//         blockOwnerDeletion: true,
//         controller: true,
//         kind: 'Deployment',
//         name: 'wrongsecrets-balancer',
//         uid: await getJuiceBalancerDeploymentUid(),
//       },
//     ],
//   };
// }

// TODO fix!
const getJuiceShopInstances = () =>
  k8sAppsApi
    //namespace: string, pretty?: string, allowWatchBookmarks?: boolean, _continue?: string, fieldSelector?: string, labelSelector?: string, limit?: number, resourceVersion?: string, resourceVersionMatch?: string, timeoutSeconds?: number, watch?: boolean
    // .listDeploymentForAllNamespaces(
    //   get('namespace'), //namespace
    //   true, //alowwatchbookmarks
    //   undefined,//fieldselector
    //   undefined, //labelSelector
    //   undefined, //limit
    //   `app=wrongsecrets,deployment-context=${get('deploymentContext')}`
    .listDeploymentForAllNamespaces(
      true,
      undefined,
      undefined,
      'app in (wrongsecrets, virtualdesktop)',
      200
    )
    .catch((error) => {
      console.log(error);
      throw new Error(error.response.body.message);
    });
module.exports.getJuiceShopInstances = getJuiceShopInstances;

const deleteNamespaceForTeam = async (team) => {
  // await k8sAppsApi
  //   .deleteNamespacedDeployment(`t-${team}-wrongsecrets`, `t-${team}`)
  //   .catch((error) => {
  //     throw new Error(error.response.body.message);
  //   });
  // await k8sAppsApi
  //   .deleteNamespacedDeployment(`t-${team}-virtualdesktop`, `t-${team}`)
  //   .catch((error) => {
  //     throw new Error(error.response.body.message);
  //   });
  await k8sCoreApi.deleteNamespace(`t-${team}`).catch((error) => {
    throw new Error(error.response.body.message);
  });
};
module.exports.deleteNamespaceForTeam = deleteNamespaceForTeam;

// const deleteServiceForTeam = async (team) => {
//   await k8sCoreApi.deleteNamespacedService(`t-${team}-wrongsecrets`, `t-${team}`).catch((error) => {
//     throw new Error(error.response.body.message);
//   });
//   await k8sCoreApi
//     .deleteNamespacedService(`t-${team}-virtualdesktop`, `t-${team}`)
//     .catch((error) => {
//       throw new Error(error.response.body.message);
//     });
// };
// module.exports.deleteServiceForTeam = deleteServiceForTeam;

const deletePodForTeam = async (team) => {
  const res = await k8sCoreApi.listNamespacedPod(
    `t-${team}`,
    true,
    undefined,
    undefined,
    undefined,
    `app=wrongsecrets,team=${team},deployment-context=${get('deploymentContext')}`
  );

  const pods = res.body.items;

  if (pods.length !== 1) {
    throw new Error(`Unexpected number of pods ${pods.length}`);
  }

  const podname = pods[0].metadata.name;

  await k8sCoreApi.deleteNamespacedPod(podname, `t-${team}`);
};
module.exports.deletePodForTeam = deletePodForTeam;

const deleteDesktopPodForTeam = async (team) => {
  const res = await k8sCoreApi.listNamespacedPod(
    `t-${team}`,
    true,
    undefined,
    undefined,
    undefined,
    `app=virtualdesktop,team=${team},deployment-context=${get('deploymentContext')}`
  );

  const pods = res.body.items;

  if (pods.length !== 1) {
    throw new Error(`Unexpected number of pods ${pods.length}`);
  }

  const podname = pods[0].metadata.name;

  await k8sCoreApi.deleteNamespacedPod(podname, `t-${team}`);
};
module.exports.deleteDesktopPodForTeam = deleteDesktopPodForTeam;

const getJuiceShopInstanceForTeamname = (teamname) =>
  k8sAppsApi
    .readNamespacedDeployment(`t-${teamname}-wrongsecrets`, `t-${teamname}`)
    .then((res) => {
      return {
        readyReplicas: res.body.status.readyReplicas,
        availableReplicas: res.body.status.availableReplicas,
        passcodeHash: res.body.metadata.annotations['wrongsecrets-ctf-party/passcode'],
      };
    })
    .catch((error) => {
      throw new Error(error.response.body.message);
    });
module.exports.getJuiceShopInstanceForTeamname = getJuiceShopInstanceForTeamname;

const updateLastRequestTimestampForTeam = (teamname) => {
  const headers = { 'content-type': 'application/strategic-merge-patch+json' };
  return k8sAppsApi.patchNamespacedDeployment(
    `t-${teamname}-wrongsecrets`,
    `t-${teamname}`,
    {
      metadata: {
        annotations: {
          'wrongsecrets-ctf-party/lastRequest': `${new Date().getTime()}`,
          'wrongsecrets-ctf-party/lastRequestReadable': new Date().toString(),
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
        'wrongsecrets-ctf-party/passcode': passcodeHash,
      },
    },
  };

  await k8sAppsApi.patchNamespacedDeployment(
    `${teamname}-wrongsecrets`,
    `t-${teamname}`,
    deploymentPatch,
    undefined,
    undefined,
    undefined,
    undefined,
    { headers }
  );
};
module.exports.changePasscodeHashForTeam = changePasscodeHashForTeam;