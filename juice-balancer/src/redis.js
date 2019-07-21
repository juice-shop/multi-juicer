import Redis from 'ioredis';
import { get } from './config';
import { logger } from './logger';

const redis = new Redis({
  host: get('redis.host'),
  port: get('redis.port'),
  password: get('redis.password'),
});

redis.on('error', error => {
  logger.error(`ioredis: ${error.message}`);
});

export default redis;
