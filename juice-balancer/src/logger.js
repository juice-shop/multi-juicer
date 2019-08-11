const winston = require('winston');

const myFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `time="${timestamp}" level="${level}" msg="${`${message}`.replace('"', '\\"')}"`;
});

const logger = winston.createLogger({
  level: process.env['NODE_ENV'] !== 'production' ? 'debug' : 'info',
  format: winston.format.combine(winston.format.timestamp(), myFormat),
  transports: [new winston.transports.Console()],
});
module.exports.logger = logger;
