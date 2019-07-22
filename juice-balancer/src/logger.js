import winston from 'winston';

const myFormat = winston.format.printf(({ level, message, timestamp }) => {
  return `time="${timestamp}" level="${level}" msg="${`${message}`.replace('"', '\\"')}"`;
});

export const logger = winston.createLogger({
  level: process.env['DEBUG'] ? 'debug' : 'info',
  format: winston.format.combine(winston.format.timestamp(), myFormat),
  transports: [new winston.transports.Console()],
});
