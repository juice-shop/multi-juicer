module.exports = {
  createDeploymentForTeam: jest.fn(),
  createServiceForTeam: jest.fn(),
  getJuiceShopInstanceForTeamname: jest.fn(() => ({
    readyReplicas: 1,
    availableReplicas: 1,
  })),
  getJuiceShopInstances: jest.fn(),
  deletePodForTeam: jest.fn(),
};
