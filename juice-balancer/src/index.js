import { get } from './config.js';
import { logger } from './logger.js';
import { createApp } from './app.js';
import * as kubernetesApi from './kubernetes.js';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer();

const server = createApp({ kubernetesApi, proxy }).listen(get('port'), () =>
  logger.info(`JuiceBalancer listening on port ${get('port')}!`)
);

process.on('SIGTERM', () => {
  logger.warn('Received "SIGTERM" Signal. Shutting down.');
  server.close();
  process.exit(0);
});
