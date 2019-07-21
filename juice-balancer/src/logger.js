import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env['DEBUG'] ? 'debug' : 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});
