import winston from 'winston';
import config from '../config';

/**
 * Winston logger configured for multi-tenant SaaS logging.
 * Supports structured logging with tenant context for SOC2 compliance.
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'taskhub-backend',
    environment: config.nodeEnv,
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Add file transport for production
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  );
}

/**
 * Creates a child logger with tenant context for request-scoped logging.
 * Essential for multi-tenant audit trail requirements.
 */
export function createTenantLogger(tenantId: string, userId?: string) {
  return logger.child({
    tenantId,
    userId,
  });
}

export default logger;
