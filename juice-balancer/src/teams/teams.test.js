jest.mock('../kubernetes');
jest.mock('http-proxy');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const {
  getJuiceShopInstanceForTeamname,
  getJuiceShopInstances,
  createDeploymentForTeam,
  createServiceForTeam,
} = require('../kubernetes');

afterAll(async () => {
  await new Promise(resolve => setTimeout(() => resolve(), 500)); // avoid jest open handle error
});

beforeEach(() => {
  getJuiceShopInstanceForTeamname.mockClear();
  getJuiceShopInstances.mockImplementation(async () => {
    return { body: { items: [] } };
  });
});

describe('teamname validation', () => {
  test.each([
    ['team-42', true],
    ['01234567890123456789', false],
    ['TEAM', false],
    ['te++am', false],
    ['-team', false],
    ['team-', false],
  ])('teamname "%s" should pass validation: %p', async (teamname, shouldPassValidation) => {
    await request(app)
      .post(`/balancer/teams/${teamname}/join`, {})
      .expect(shouldPassValidation ? 401 : 400);
  });
});

describe('passcode validation', () => {
  test.each([
    ['12345678', true],
    ['ABCDEFGH', true],
    ['12abCD34', true],
    ['te++am12', false],
    ['123456789', false],
    ['1234567', false],
  ])('passcode "%s" should pass validation: %p', async (passcode, shouldPassValidation) => {
    getJuiceShopInstanceForTeamname.mockImplementation(async () => {
      return {
        // lowered salt to keep hashing quick
        passcodeHash: bcrypt.hashSync('foo', 2),
      };
    });

    await request(app)
      .post(`/balancer/teams/teamname/join`, {})
      .send({ passcode })
      .expect(shouldPassValidation ? 401 : 400);
  });
});

test('returns a 500 error code when kubernetes returns a unexpected error code while looking for existing deployments', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(() => {
    throw new Error(`kubernetes cluster is on burning. Evacuate immediately!`);
  });

  await request(app)
    .post('/balancer/teams/team42/join', {})
    .expect(500);
});

test('requires authentication response when the deployment exists but no passcode was provided', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {
      // lowered salt to keep hashing quick
      passcodeHash: bcrypt.hashSync('foo', 2),
    };
  });

  await request(app)
    .post('/balancer/teams/team42/join', {})
    .expect(401);
});

test('requires authentication when the passcode is incorrect', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {
      // lowered salt to keep hashing quick
      passcodeHash: bcrypt.hashSync('12345678', 2),
    };
  });

  await request(app)
    .post('/balancer/teams/team42/join')
    .send({ passcode: '01234567' })
    .expect(401);
});

test('joins team when the passcode is correct and the instance exists', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {
      passcodeHash: bcrypt.hashSync('12345678', 2),
    };
  });

  await request(app)
    .post('/balancer/teams/team42/join')
    .send({ passcode: '12345678' })
    .expect(200)
    .then(({ body }) => {
      expect(body.message).toBe('Joined Team');
    });
});

test('create team fails when max instances is reached', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    throw new Error(`deployments.apps "t-team42-juiceshop" not found`);
  });
  getJuiceShopInstances.mockImplementation(async () => {
    return { body: { items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } };
  });

  await request(app)
    .post('/balancer/teams/team42/join')
    .expect(500)
    .then(({ body }) => {
      expect(body.message).toBe('Reached Maximum Instance Count');
    });
});

test('create team creates a instance for team via k8s service', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    throw new Error(`deployments.apps "t-team42-juiceshop" not found`);
  });

  let passcode = null;

  await request(app)
    .post('/balancer/teams/team42/join')
    .expect(200)
    .then(({ body }) => {
      expect(body.message).toBe('Created Instance');
      expect(body.passcode).toMatch(/[a-zA-Z0-9]{7}/);
      passcode = body.passcode;
    });

  expect(createDeploymentForTeam).toHaveBeenCalled();

  const createDeploymentForTeamCallArgs = createDeploymentForTeam.mock.calls[0][0];
  expect(createDeploymentForTeamCallArgs.team).toBe('team42');
  expect(bcrypt.compareSync(passcode, createDeploymentForTeamCallArgs.passcodeHash)).toBe(true);
  expect(createServiceForTeam).toBeCalledWith('team42');
});
