const { KubeConfig, AppsV1Api, CoreV1Api } = require('@kubernetes/client-node');
const kc = new KubeConfig();
kc.loadFromCluster();

const k8sAppsApi = kc.makeApiClient(AppsV1Api);
const k8sCoreApi = kc.makeApiClient(CoreV1Api);

const { logger } = require('./logger');

const getTeamInstances = (namespaceName) =>
  k8sAppsApi.listNamespacedDeployment(namespaceName).catch((error) => {
    logger.info(error);
    throw new Error(error.response.body.message);
  });
module.exports.getTeamInstances = getTeamInstances;

const getTeamJuiceShopInstances = (namespaceName) =>
  k8sAppsApi
    .listNamespacedDeployment(
      namespaceName,
      false,
      true,
      undefined,
      undefined,
      'app in (wrongsecrets, virtualdesktop)'
    )
    .catch((error) => {
      logger.info(error);
      throw new Error(error.response.body.message);
    });
module.exports.getTeamJuiceShopInstances = getTeamJuiceShopInstances;

const getNamespaces = () =>
  k8sCoreApi.listNamespace(undefined, true, undefined, undefined, undefined, 200).catch((error) => {
    logger.info(error);
    throw new Error(error.response.body.message);
  });
module.exports.getNamespaces = getNamespaces;

const deleteNamespaceForTeam = async (namespaceName) => {
  await k8sCoreApi.deleteNamespace(namespaceName).catch((error) => {
    throw new Error(error.response.body.message);
  });
};
module.exports.deleteNamespaceForTeam = deleteNamespaceForTeam;
