const express = require('express');
const cookieParser = require('cookie-parser');

const { get } = require('./config');

const app = express();

const teamRoutes = require('./teams/');
const adminRoutes = require('./admin/admin');
const proxyRoutes = require('./proxy/proxy');
const redis = require('./redis');
const { logger } = require('./logger');

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
