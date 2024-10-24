import { jest, beforeEach, describe, test, expect } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { get } from '../config.js';
import { createApp } from '../app.js';

afterAll(async () => {
  await new Promise((resolve) => setTimeout(() => resolve(), 500)); // avoid jest open handle error
});

let app;
let kubernetesApi;
beforeEach(() => {
  kubernetesApi = {
    createDeploymentForTeam: jest.fn(),
    createServiceForTeam: jest.fn(),
    getJuiceShopInstanceForTeamname: jest.fn(() => ({
      readyReplicas: 1,
      availableReplicas: 1,
    })),
    getJuiceShopInstances: jest.fn(),
    deletePodForTeam: jest.fn(),
    updateLastRequestTimestampForTeam: jest.fn(),
    changePasscodeHashForTeam: jest.fn(),
  };
  app = createApp({
    kubernetesApi,
    proxy: {
      web: jest.fn((req, res) => res.send('proxied')),
    },
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
    kubernetesApi.getJuiceShopInstanceForTeamname.mockImplementation(async () => {
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
  kubernetesApi.getJuiceShopInstanceForTeamname.mockImplementation(() => {
    throw new Error(`kubernetes cluster is on burning. Evacuate immediately!`);
  });

  await request(app).post('/balancer/teams/team42/join', {}).expect(500);
});

test('requires authentication response when the deployment exists but no passcode was provided', async () => {
  kubernetesApi.getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {
      // lowered salt to keep hashing quick
      passcodeHash: bcrypt.hashSync('foo', 2),
    };
  });

  await request(app).post('/balancer/teams/team42/join', {}).expect(401);
});

test('requires authentication when the passcode is incorrect', async () => {
  kubernetesApi.getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {
      // lowered salt to keep hashing quick
      passcodeHash: bcrypt.hashSync('12345678', 2),
    };
  });

  await request(app).post('/balancer/teams/team42/join').send({ passcode: '01234567' }).expect(401);
});

test('joins team when the passcode is correct and the instance exists', async () => {
  kubernetesApi.getJuiceShopInstanceForTeamname.mockImplementation(async () => {
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
  kubernetesApi.getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    throw new Error(`deployments.apps "t-team42-juiceshop" not found`);
  });
  kubernetesApi.getJuiceShopInstances.mockImplementation(async () => {
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
  kubernetesApi.getJuiceShopInstanceForTeamname.mockImplementation(async () => {
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

  expect(kubernetesApi.createDeploymentForTeam).toHaveBeenCalled();

  const createDeploymentForTeamCallArgs = kubernetesApi.createDeploymentForTeam.mock.calls[0][0];
  expect(createDeploymentForTeamCallArgs.team).toBe('team42');
  expect(bcrypt.compareSync(passcode, createDeploymentForTeamCallArgs.passcodeHash)).toBe(true);
  expect(kubernetesApi.createServiceForTeam).toBeCalledWith('team42');
});

test('reset passcode needs authentication if no cookie is sent', async () => {
  await request(app).post('/balancer/teams/reset-passcode').send().expect(401);
});

test('reset passcode is forbidden for admin', async () => {
  await request(app)
    .post('/balancer/teams/reset-passcode')
    .set('Cookie', [`${get('cookieParser.cookieName')}=t-${get('admin.username')}`])
    .send()
    .expect(403);
});

test('reset passcode fails with not found if team does not exist', async () => {
  const team = 't-test-team';

  kubernetesApi.changePasscodeHashForTeam.mockImplementation(() => {
    throw new Error(`deployments.apps "${team}-juiceshop" not found`);
  });

  await request(app)
    .post(`/balancer/teams/reset-passcode`)
    .set('Cookie', [`${get('cookieParser.cookieName')}=${team}`])
    .send()
    .expect(404);
});

test('reset passcode resets passcode to new value if team exists', async () => {
  const team = 't-test-team';

  let newPasscode = null;

  await request(app)
    .post(`/balancer/teams/reset-passcode`)
    .set('Cookie', [`${get('cookieParser.cookieName')}=${team}`])
    .send()
    .expect(200)
    .then(({ body }) => {
      expect(body.message).toBe('Reset Passcode');
      expect(body.passcode).toMatch(/[a-zA-Z0-9]{7}/);
      newPasscode = body.passcode;
    });

  expect(kubernetesApi.changePasscodeHashForTeam).toHaveBeenCalled();

  const callArgs = kubernetesApi.changePasscodeHashForTeam.mock.calls[0];
  expect(callArgs[0]).toBe(team);
  expect(bcrypt.compareSync(newPasscode, callArgs[1])).toBe(true);
});
