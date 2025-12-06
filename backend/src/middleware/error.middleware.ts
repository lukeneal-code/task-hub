import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import config from '../config';

/**
 * Custom error class for application errors.
 * Includes status code and optional details for debugging.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found error handler.
 * Catches requests to undefined routes.
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.warn('Route not found', { path: req.path, method: req.method });

  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Global error handler middleware.
 *
 * Handles all errors thrown in the application:
 * - Logs errors for monitoring and debugging
 * - Returns appropriate HTTP status codes
 * - Sanitizes error messages in production to prevent information leakage
 *
 * SOC2 Compliance: Error messages are sanitized in production
 * to prevent sensitive information disclosure.
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine status code
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const isOperational = 'isOperational' in err ? err.isOperational : false;

  // Log the error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Client error', {
      error: err.message,
      statusCode,
      path: req.path,
      method: req.method,
    });
  }

  // Prepare response
  const response: {
    error: string;
    message: string;
    details?: Record<string, any>;
    stack?: string;
  } = {
    error: getErrorName(statusCode),
    message: isOperational ? err.message : 'An unexpected error occurred',
  };

  // Include details if available and operational
  if (isOperational && 'details' in err && err.details) {
    response.details = err.details;
  }

  // Include stack trace in development
  if (config.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Maps HTTP status codes to standard error names.
 */
function getErrorName(statusCode: number): string {
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };

  return errorNames[statusCode] || 'Error';
}

/**
 * Async handler wrapper for route handlers.
 * Automatically catches errors and passes them to the error middleware.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
