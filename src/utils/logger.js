import winston, { createLogger, LoggerOptions, transports, format } from 'winston';

const { combine, timestamp, colorize, prettyPrint, json, printf } = format;

const logger = winston.createLogger({
  format: combine(timestamp(), printf(info => `${info.timestamp} ${info.level}: ${info.message}`)),
  transports: [
    new transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    }),
    new transports.File({ filename: 'debug.log', level: 'debug' }),
  ],
});

export default logger;
