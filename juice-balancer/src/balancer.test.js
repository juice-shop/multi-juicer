jest.mock('./redis');
jest.mock('./kubernetes/kubernetes');
jest.mock('http-proxy');

const app = require('./main');

const request = require('supertest');

test('/balancer/ should return the balancer ui', () => {
  return request(app)
    .get('/balancer/')
    .expect('Content-Type', /text\/html/)
    .expect(200);
});

test('signed cookie test', () => {
  request(app)
    .get('/rest/admin/application-version')
    .set('Cookie', ['balancer=t-team42'])
    .send();
});
