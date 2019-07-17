import Redis from 'ioredis';
import { get } from './config';

export default new Redis({
  host: get('redis.host'),
  port: get('redis.port'),
  password: get('redis.password'),
});
