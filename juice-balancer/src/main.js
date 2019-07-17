import express from 'express';
import cookieParser from 'cookie-parser';

import { get } from './config';

const app = express();

import teamRoutes from './teams/';
import adminRoutes from './admin/admin';
import proxyRoutes from './proxy/proxy';
import redis from './redis';

app.use('/balancer', express.static('public'));
app.use(cookieParser(get('cookieParser.secret')));
app.use('/balancer', express.json());

app.use('/balancer/teams', teamRoutes);
app.use('/balancer/admin', adminRoutes);

app.use(proxyRoutes);

const server = app.listen(get('port'), () =>
  console.log(`JuiceBalancer listening on port ${get('port')}!`)
);

process.on('SIGTERM', () => {
  console.log('Recieved "SIGTERM" Signal shutting down.');
  server.close();
  redis.disconnect();
  process.exit(0);
});
