import { randomUUID } from 'crypto';
import { logger } from '../services/logger.js';

const toDurationMs = (start) => {
  const durationNs = Number(process.hrtime.bigint() - start);
  return Number((durationNs / 1_000_000).toFixed(2));
};

const resolveLogLevel = (statusCode) => {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
};

export const attachRequestContext = (req, res, next) => {
  const requestId = req.header('x-request-id') || randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

export const httpRequestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const statusCode = res.statusCode;
    const level = resolveLogLevel(statusCode);

    logger.log(level, 'HTTP request', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      durationMs: toDurationMs(start),
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};
