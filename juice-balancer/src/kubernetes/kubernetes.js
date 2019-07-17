import { KubeConfig, AppsV1Api, CoreV1Api } from '@kubernetes/client-node';
const kc = new KubeConfig();
kc.loadFromCluster();

const k8sAppsApi = kc.makeApiClient(AppsV1Api);
const k8sCoreApi = kc.makeApiClient(CoreV1Api);

import { get } from '../config';

export const createDeploymentForTeam = ({ team }) =>
  k8sAppsApi.createNamespacedDeployment(get('namespace'), {
    metadata: {
      name: `t-${team}-juiceshop`,
      labels: {
        app: 'juice-shop',
        team,
      },
    },
    spec: {
      selector: {
        matchLabels: {
          app: 'juice-shop',
          team,
        },
      },
      template: {
        metadata: {
          labels: {
            app: 'juice-shop',
            team,
          },
        },
        spec: {
          automountServiceAccountToken: false,
          containers: [
            {
              name: 'juice-shop',
              image: 'bkimminich/juice-shop:v8.7.2',
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
            },
          ],
        },
      },
    },
  });

export const createServiceForTeam = teamname =>
  k8sCoreApi.createNamespacedService(get('namespace'), {
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

export const getJuiceShopInstances = () =>
  k8sAppsApi.listNamespacedDeployment(
    get('namespace'),
    true,
    undefined,
    undefined,
    undefined,
    'app=juice-shop'
  );

export const getJuiceShopInstanceForTeamname = teamname =>
  k8sAppsApi.readNamespacedDeployment(`t-${teamname}-juiceshop`, get('namespace'));
