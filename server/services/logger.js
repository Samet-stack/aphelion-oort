import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');
const LOG_TO_FILE = process.env.LOG_TO_FILE
  ? process.env.LOG_TO_FILE === 'true'
  : process.env.NODE_ENV === 'production';

if (LOG_TO_FILE) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const devConsoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaEntries = Object.entries(meta);
    const suffix = metaEntries.length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${suffix}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? baseFormat : devConsoleFormat,
  }),
];

if (LOG_TO_FILE) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      level: LOG_LEVEL,
      format: baseFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: baseFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
});

export const serializeError = (error) => {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    };
  }
  if (typeof error === 'object') return error;
  return { message: String(error) };
};

export const requestLogMeta = (req) => ({
  requestId: req?.requestId,
  method: req?.method,
  path: req?.originalUrl || req?.url,
  userId: req?.user?.id,
  ip: req?.ip,
});

export const logRouteError = (req, message, error, extra = {}) => {
  logger.error(message, {
    ...requestLogMeta(req),
    ...extra,
    error: serializeError(error),
  });
};
