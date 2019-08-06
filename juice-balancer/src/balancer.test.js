jest.mock('./redis');
jest.mock('./kubernetes/kubernetes');
jest.mock('http-proxy');

const redis = require('./redis');
const app = require('./app');
const { advanceBy, advanceTo, clear } = require('jest-date-mock');

const request = require('supertest');

afterAll(async () => {
  await new Promise(resolve => setTimeout(() => resolve(), 500)); // avoid jest open handle error
});

beforeEach(() => {
  clear();
  redis.set.mockClear();
});

test('/balancer/ should return the balancer ui', async () => {
  await request(app)
    .get('/balancer/')
    .expect('Content-Type', /text\/html/)
    .expect(200);
});

test('should proxy requests going to JuiceShop when they got a team cookie', async () => {
  await request(app)
    .get('/rest/admin/application-version')
    .set('Cookie', ['balancer=t-team42'])
    .send()
    .expect(200)
    .expect('proxied');
});

test("should redirect to /balancer/ when requests don't have a team cookie", async () => {
  await request(app)
    .get('/rest/admin/application-version')
    .send()
    .expect(302)
    .then(res => {
      expect(res.header.location).toBe('/balancer/');
    });
});

test('should set the last-connect timestamp when a new team gets proxied the first time', async () => {
  advanceTo(new Date(1555555555555));

  await request(app)
    .get('/rest/admin/application-version')
    .set('Cookie', ['balancer=t-team-last-connect-test'])
    .send()
    .expect(200)
    .expect('proxied');

  expect(redis.set).toHaveBeenCalledWith('t-team-last-connect-test-last-request', 1555555555555);

  clear();
});

test('should update the last-connect timestamp on requests at most every 10sec', async () => {
  advanceTo(new Date(1000000000000));

  await request(app)
    .get('/rest/admin/application-version')
    .set('Cookie', ['balancer=t-team-update-last-connect-test'])
    .send()
    .expect(200)
    .expect('proxied');

  expect(redis.set).toHaveBeenCalledWith(
    't-team-update-last-connect-test-last-request',
    1000000000000
  );

  redis.set.mockClear();

  await request(app)
    .get('/rest/admin/application-version')
    .set('Cookie', ['balancer=t-team-update-last-connect-test'])
    .send()
    .expect(200)
    .expect('proxied');

  expect(redis.set).not.toHaveBeenCalled();

  // Wait for >10s
  advanceBy(10 * 1000 + 1);

  await request(app)
    .get('/rest/admin/application-version')
    .set('Cookie', ['balancer=t-team-update-last-connect-test'])
    .send()
    .expect(200)
    .expect('proxied');

  expect(redis.set).toHaveBeenCalledWith(
    't-team-update-last-connect-test-last-request',
    1000000010001
  );

  clear();
});
