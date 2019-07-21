import express from 'express';
import cookieParser from 'cookie-parser';

import { get } from './config';

const app = express();

import teamRoutes from './teams/';
import adminRoutes from './admin/admin';
import proxyRoutes from './proxy/proxy';
import redis from './redis';
import { logger } from './logger';

app.use('/balancer', express.static('public'));
app.use(cookieParser(get('cookieParser.secret')));
app.use('/balancer', express.json());

app.use('/balancer/teams', teamRoutes);
app.use('/balancer/admin', adminRoutes);

app.use(proxyRoutes);

const server = app.listen(get('port'), () =>
  logger.info(`JuiceBalancer listening on port ${get('port')}!`)
);

process.on('SIGTERM', () => {
  logger.warn('Recieved "SIGTERM" Signal shutting down.');
  server.close();
  redis.disconnect();
  process.exit(0);
});
