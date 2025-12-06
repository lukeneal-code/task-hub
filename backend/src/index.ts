import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import config from './config';
import logger from './utils/logger';
import db from './utils/database';

// Import routes
import healthRoutes from './api/health.routes';
import tenantRoutes from './api/tenant.routes';
import projectRoutes from './api/project.routes';
import auditRoutes from './api/audit.routes';

// Import middleware
import { notFoundHandler, errorHandler } from './middleware/error.middleware';

/**
 * TaskHub Backend API Server
 *
 * Multi-tenant SaaS backend with:
 * - Keycloak JWT authentication
 * - Tenant-aware request handling
 * - Schema-per-tenant data isolation
 * - SOC2 compliant audit logging
 */

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// API Routes
app.use('/health', healthRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', projectRoutes); // Also mount at /api for task/comment routes
app.use('/api/audit', auditRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await db.closePool();
    logger.info('Database connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const server = app.listen(config.port, () => {
  logger.info(`TaskHub API server started`, {
    port: config.port,
    environment: config.nodeEnv,
    keycloakUrl: config.keycloak.publicUrl,
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

export default server;
