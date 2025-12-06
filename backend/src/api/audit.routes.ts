import { Router, Response } from 'express';
import { query } from 'express-validator';
import { auditService } from '../services/audit.service';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * Audit Log API Routes
 *
 * Provides access to audit logs for SOC2 compliance reporting.
 * All routes require admin role.
 */

// Apply authentication to all routes
router.use(authenticate);
router.use(requireRole('admin'));

/**
 * GET /api/audit/logs
 *
 * Queries audit logs with filtering.
 * Returns paginated results for compliance reporting.
 */
router.get(
  '/logs',
  validate([
    query('userId').optional().notEmpty(),
    query('action').optional().notEmpty(),
    query('resourceType').optional().notEmpty(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { logs, total } = await auditService.query({
      tenantId: req.tenant!.id, // Scope to current tenant
      userId: req.query.userId as string,
      action: req.query.action as string,
      resourceType: req.query.resourceType as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      },
    });
  })
);

/**
 * GET /api/audit/summary
 *
 * Gets an audit summary for compliance reporting.
 * Returns aggregated statistics for a date range.
 */
router.get(
  '/summary',
  validate([
    query('startDate').isISO8601().withMessage('Start date is required (ISO8601 format)'),
    query('endDate').isISO8601().withMessage('End date is required (ISO8601 format)'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await auditService.getTenantAuditSummary(
      req.tenant!.id,
      new Date(req.query.startDate as string),
      new Date(req.query.endDate as string)
    );

    res.json({
      success: true,
      data: summary,
    });
  })
);

export default router;
