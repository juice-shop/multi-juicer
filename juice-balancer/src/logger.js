import winston from 'winston';

const logFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `time="${timestamp}" level="${level}" msg="${message}"`;
});

const getLogLevelForEnvironment = (env) => {
  switch (env) {
    case 'development':
      return 'debug';
    case 'test':
      return 'emerg';
    default:
      return 'info';
  }
};

export const logger = winston.createLogger({
  level: getLogLevelForEnvironment(process.env['NODE_ENV']),
  format: winston.format.combine(winston.format.timestamp(), logFormat),
  transports: [new winston.transports.Console()],
});
