jest.mock('../redis');
jest.mock('../kubernetes');
jest.mock('http-proxy');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const redis = require('../redis');
const app = require('../app');
const { getJuiceShopInstanceForTeamname } = require('../kubernetes');

afterAll(async () => {
  await new Promise(resolve => setTimeout(() => resolve(), 500)); // avoid jest open handle error
});

beforeEach(() => {
  redis.set.mockClear();
  redis.get.mockClear();
  getJuiceShopInstanceForTeamname.mockClear();
});

test('returns a 500 error code when kubernetes returns a unexpected error code while looking for existing deployments', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(() => {
    throw new Error(`kubernetes cluster is on burning. Evacuate immediately!`);
  });

  await request(app)
    .post('/balancer/teams/team42/join', {})
    .expect(500);
});

test('returns requires authentication response when the deployment exists but no passcode was provided', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {};
  });
  redis.get.mockReturnValue(bcrypt.hashSync('foo'));

  await request(app)
    .post('/balancer/teams/team42/join', {})
    .expect(401);
});

test('returns requires authentication when the passcode is incorrect', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {};
  });
  redis.get.mockReturnValue(bcrypt.hashSync('12345678'));

  await request(app)
    .post('/balancer/teams/team42/join')
    .send({ passcode: '01234567' })
    .expect(401);
});

test('joins team when the passcode is correct and the instance exists', async () => {
  getJuiceShopInstanceForTeamname.mockImplementation(async () => {
    return {};
  });
  redis.get.mockReturnValue(bcrypt.hashSync('12345678'));

  await request(app)
    .post('/balancer/teams/team42/join')
    .send({ passcode: '12345678' })
    .expect(200)
    .then(({ body }) => {
      expect(body.message).toBe('Joined Team');
    });
});
