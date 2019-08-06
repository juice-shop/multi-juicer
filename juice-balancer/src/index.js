const { get } = require('./config');
const redis = require('./redis');
const { logger } = require('./logger');

const app = require('./main.js');

const server = app.listen(get('port'), () =>
  logger.info(`JuiceBalancer listening on port ${get('port')}!`)
);

process.on('SIGTERM', () => {
  logger.warn('Recieved "SIGTERM" Signal shutting down.');
  server.close();
  redis.disconnect();
  process.exit(0);
});
