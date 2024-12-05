import winston from 'winston';
import { config } from './config/config';

// Create custom logger
export const loggerConfig = winston.createLogger({
  ...config.logger,
  // Setup logs format
  format: winston.format.combine(
    winston.format((info) => {
      info.environment = process.env.NODE_ENV || 'local';
      return info;
    })(),
    winston.format.ms(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
