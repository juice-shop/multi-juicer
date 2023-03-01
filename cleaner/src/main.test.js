jest.mock('./kubernetes');

const { clear } = require('jest-date-mock');

const app = require('./main');
const {
  getTeamInstances,
  getTeamJuiceShopInstances,
  getNamespaces,
  deleteNamespaceForTeam,
} = require('./kubernetes');

beforeEach(() => {
  clear();
  getTeamInstances.mockClear();
  getTeamJuiceShopInstances.mockClear();
  getNamespaces.mockClear();
  deleteNamespaceForTeam.mockClear();
});

///Should create a namespace with the name t-team1 containing 3 inactive wrongsecrets deployments (it should be deleted)
test('should return the number of outdated namespaces', async () => {
  getNamespaces.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 't-team1',
            },
          },
        ],
      },
    };
  });
  getTeamJuiceShopInstances.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 'wrongsecrets-1',
              labels: {
                team: 'team1',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-desktop',
              labels: {
                team: 'team1',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-3',
              labels: {
                team: 'team1',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
        ],
      },
    };
  });
  getTeamInstances.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 'wrongsecrets-1',
              labels: {
                team: 'team1',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-desktop',
              labels: {
                team: 'team1',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-3',
              labels: {
                team: 'team1',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
        ],
      },
    };
  });
  expect(await app.listOldNamespaces()).toEqual(['t-team1']);
});

// ///Should create a namespace with the name t-team2 containing 2 inactive wrongsecrets deployments and 1 active wrongsecrets deployment (it should not be deleted)
test('should return the number of outdated namespaces', async () => {
  getNamespaces.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 't-team2',
            },
          },
        ],
      },
    };
  });
  getTeamJuiceShopInstances.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 'wrongsecrets-1',
              labels: {
                team: 'team2',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': new Date().getTime(),
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-2',
              labels: {
                team: 'team2',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-3',
              labels: {
                team: 'team2',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
        ],
      },
    };
  });
  getTeamInstances.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 'wrongsecrets-1',
              labels: {
                team: 'team2',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': new Date().getTime(),
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-2',
              labels: {
                team: 'team2',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
          {
            metadata: {
              name: 'wrongsecrets-3',
              labels: {
                team: 'team2',
              },
              annotations: {
                'wrongsecrets-ctf-party/lastRequest': 0,
              },
            },
          },
        ],
      },
    };
  });
  expect(await app.listOldNamespaces()).toEqual([]);
});

// ///Should create a namespace with the name t-team4 containing 0 deployments at all (it should not be deleted)
test('should return the number of outdated namespaces', async () => {
  getNamespaces.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 't-team3',
            },
          },
        ],
      },
    };
  });
  getTeamJuiceShopInstances.mockImplementation(() => {
    return {
      body: {
        items: [],
      },
    };
  });
  getTeamInstances.mockImplementation(() => {
    return {
      body: {
        items: [],
      },
    };
  });
  expect(await app.listOldNamespaces()).toEqual([]);
});

// ///Should create a namespace with the name t-team5 containing 0 wrongsecrets deployments but 1 active deployment (it should not be deleted)
test('should return the number of outdated namespaces', async () => {
  getNamespaces.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 't-team1',
            },
          },
        ],
      },
    };
  });
  getTeamJuiceShopInstances.mockImplementation(() => {
    return {
      body: {
        items: [],
      },
    };
  });
  getTeamInstances.mockImplementation(() => {
    return {
      body: {
        items: [
          {
            metadata: {
              name: 'Deployment-1',
              labels: {
                team: 'team1',
              },
            },
          },
        ],
      },
    };
  });
  expect(await app.listOldNamespaces()).toEqual([]);
});

/// Should have the SHOULD_DELETE environment variable set to true (it should delete all namespaces)
test('should return the number of deleted namespaces', async () => {
  const counts = {
    successful: {
      namespaces: 3,
    },
    failed: {
      namespaces: 0,
    },
  };
  const namespaces = ['t-team1', 't-team2', 't-team3'];
  deleteNamespaceForTeam.mockImplementation(() => {
    return true;
  });
  expect(await app.deleteNamespaces(namespaces)).toEqual(counts);
});

/// Should have the SHOULD_DELETE environment variable set to true (it should delete two namespaces and error with one)
test('should return two deleted namespaces and fail in one', async () => {
  const counts = {
    successful: {
      namespaces: 2,
    },
    failed: {
      namespaces: 1,
    },
  };
  const namespaces = ['t-team1', 't-team2', 't-team3'];
  deleteNamespaceForTeam.mockImplementation((namespaceName) => {
    if (namespaceName === 't-team3') {
      throw new Error('Error deleting namespace');
    }
    return true;
  });
  expect(await app.deleteNamespaces(namespaces)).toEqual(counts);
});
