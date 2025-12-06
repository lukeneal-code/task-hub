import db from '../utils/database';
import logger from '../utils/logger';

/**
 * Audit log entry structure for SOC2 compliance.
 */
export interface AuditLogEntry {
  tenantId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit Service
 *
 * Provides comprehensive audit logging for SOC2 compliance.
 * All security-relevant actions are logged with full context.
 *
 * Logged events include:
 * - Authentication events (login, logout, failed attempts)
 * - Authorization events (access granted/denied)
 * - Data access events (create, read, update, delete)
 * - Administrative actions (tenant management, user management)
 * - Configuration changes
 */
class AuditService {
  /**
   * Logs an audit event to the database.
   * This is the primary method for recording audit entries.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await db.query(
        `INSERT INTO platform.audit_logs
         (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.tenantId || null,
          entry.userId || null,
          entry.action,
          entry.resourceType || null,
          entry.resourceId || null,
          JSON.stringify(entry.details || {}),
          entry.ipAddress || null,
          entry.userAgent || null,
        ]
      );

      // Also log to application logger for real-time monitoring
      logger.info('Audit event', {
        action: entry.action,
        tenantId: entry.tenantId,
        userId: entry.userId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
      });
    } catch (error) {
      // Audit logging failures should not break the application
      // but must be logged as critical for investigation
      logger.error('Failed to write audit log', { error, entry });
    }
  }

  /**
   * Logs an authentication event.
   */
  async logAuth(
    event: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'TOKEN_REFRESH',
    details: {
      tenantId?: string;
      userId?: string;
      email?: string;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
    }
  ): Promise<void> {
    await this.log({
      tenantId: details.tenantId,
      userId: details.userId,
      action: `AUTH_${event}`,
      resourceType: 'session',
      details: {
        email: details.email,
        reason: details.reason,
      },
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    });
  }

  /**
   * Logs a data access event.
   */
  async logDataAccess(
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    details: {
      tenantId: string;
      userId: string;
      resourceType: string;
      resourceId: string;
      changes?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.log({
      tenantId: details.tenantId,
      userId: details.userId,
      action: `DATA_${operation}`,
      resourceType: details.resourceType,
      resourceId: details.resourceId,
      details: details.changes ? { changes: details.changes } : undefined,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    });
  }

  /**
   * Logs an authorization event (access denied).
   */
  async logAccessDenied(details: {
    tenantId?: string;
    userId?: string;
    resource: string;
    action: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      tenantId: details.tenantId,
      userId: details.userId,
      action: 'ACCESS_DENIED',
      resourceType: details.resource,
      details: {
        attemptedAction: details.action,
        reason: details.reason,
      },
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    });
  }

  /**
   * Queries audit logs with filtering for compliance reporting.
   */
  async query(options: {
    tenantId?: string;
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(options.tenantId);
    }

    if (options.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(options.userId);
    }

    if (options.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(options.action);
    }

    if (options.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(options.resourceType);
    }

    if (options.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(options.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM platform.audit_logs ${whereClause}`,
      params
    );

    // Get logs with pagination
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT * FROM platform.audit_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Generates an audit summary for a tenant (compliance reporting).
   */
  async getTenantAuditSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByUser: Record<string, number>;
    accessDenials: number;
  }> {
    // Total events
    const totalResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM platform.audit_logs
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3`,
      [tenantId, startDate, endDate]
    );

    // Events by action
    const actionResult = await db.query<{ action: string; count: string }>(
      `SELECT action, COUNT(*) as count FROM platform.audit_logs
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY action`,
      [tenantId, startDate, endDate]
    );

    // Events by user
    const userResult = await db.query<{ user_id: string; count: string }>(
      `SELECT user_id, COUNT(*) as count FROM platform.audit_logs
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3 AND user_id IS NOT NULL
       GROUP BY user_id`,
      [tenantId, startDate, endDate]
    );

    // Access denials
    const denialResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM platform.audit_logs
       WHERE tenant_id = $1 AND action = 'ACCESS_DENIED' AND created_at BETWEEN $2 AND $3`,
      [tenantId, startDate, endDate]
    );

    return {
      totalEvents: parseInt(totalResult.rows[0].count, 10),
      eventsByAction: Object.fromEntries(
        actionResult.rows.map((r) => [r.action, parseInt(r.count, 10)])
      ),
      eventsByUser: Object.fromEntries(
        userResult.rows.map((r) => [r.user_id, parseInt(r.count, 10)])
      ),
      accessDenials: parseInt(denialResult.rows[0].count, 10),
    };
  }
}

export const auditService = new AuditService();
export default auditService;
