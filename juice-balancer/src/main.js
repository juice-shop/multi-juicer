import express from 'express';
import cookieParser from 'cookie-parser';

import config from './config';

const app = express();

import teamRoutes from './teams/';
import adminRoutes from './admin/admin';
import proxyRoutes from './proxy/proxy';
import redis from './redis';

app.use('/balancer', express.static('public'));
app.use(cookieParser(config.cookieParser.secret));
app.use('/balancer', express.json());

app.use('/balancer/teams', teamRoutes);
app.use('/balancer/admin', adminRoutes);

app.use(proxyRoutes);

app.listen(config.port, () =>
  console.log(`JuiceBalancer listening on port ${config.port}!`)
);
