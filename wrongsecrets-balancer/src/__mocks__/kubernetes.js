module.exports = {
  createDeploymentForTeam: jest.fn(),
  createNameSpaceForTeam: jest.fn(),
  createConfigmapForTeam: jest.fn(),
  createSecretsfileForTeam: jest.fn(),
  createDesktopDeploymentForTeam: jest.fn(),
  createServiceForTeam: jest.fn(),
  createDesktopServiceForTeam: jest.fn(),
  getJuiceShopInstanceForTeamname: jest.fn(() => ({
    readyReplicas: 1,
    availableReplicas: 1,
  })),
  getJuiceShopInstances: jest.fn(),
  deletePodForTeam: jest.fn(),
  updateLastRequestTimestampForTeam: jest.fn(),
  changePasscodeHashForTeam: jest.fn(),
};
