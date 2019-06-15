var Redis = require('ioredis');

module.exports = new Redis({
  host: 'juice-balancer-redis.default.svc',
  password: 'myredispassword',
});
