import { Router, Request, Response } from 'express';
import db from '../utils/database';
import config from '../config';

const router = Router();

/**
 * Health Check Routes
 *
 * Provides health and readiness endpoints for container orchestration
 * and load balancer health checks.
 */

/**
 * GET /health
 *
 * Basic health check - returns OK if the server is running.
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'taskhub-backend',
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * GET /health/ready
 *
 * Readiness check - verifies all dependencies are accessible.
 * Used by Kubernetes/Docker for readiness probes.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: {
    database: boolean;
    keycloak: boolean;
  } = {
    database: false,
    keycloak: false,
  };

  // Check database connection
  try {
    await db.query('SELECT 1');
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Keycloak availability
  try {
    const response = await fetch(`${config.keycloak.url}/health/ready`, {
      signal: AbortSignal.timeout(5000),
    });
    checks.keycloak = response.ok;
  } catch {
    checks.keycloak = false;
  }

  const allHealthy = Object.values(checks).every((v) => v);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/live
 *
 * Liveness check - basic check that the process is alive.
 * Used by Kubernetes for liveness probes.
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;
