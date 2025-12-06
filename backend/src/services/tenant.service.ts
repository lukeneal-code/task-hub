import { v4 as uuidv4 } from 'uuid';
import db from '../utils/database';
import keycloakService from './keycloak.service';
import logger from '../utils/logger';
import { auditService } from './audit.service';

/**
 * Tenant data structure
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  keycloak_realm: string;
  schema_name: string;
  status: 'active' | 'suspended' | 'pending';
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Tenant creation request
 */
export interface CreateTenantRequest {
  name: string;
  slug: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  adminPassword: string;
  settings?: Record<string, any>;
}

/**
 * Tenant Service
 *
 * Handles all tenant lifecycle operations including:
 * - Provisioning new tenants (DB schema + Keycloak realm)
 * - Tenant configuration management
 * - Tenant deletion/cleanup
 *
 * This is the core multi-tenancy orchestration layer.
 */
class TenantService {
  /**
   * Provisions a new tenant with complete isolation.
   *
   * This operation:
   * 1. Creates a tenant record in the platform schema
   * 2. Creates an isolated database schema for the tenant
   * 3. Creates a Keycloak realm with roles and client
   * 4. Creates the initial admin user
   */
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    const tenantLogger = logger.child({ operation: 'createTenant', slug: request.slug });
    tenantLogger.info('Starting tenant provisioning');

    // Generate identifiers
    const tenantId = uuidv4();
    const schemaName = `tenant_${request.slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const realmName = request.slug.toLowerCase().replace(/[^a-z0-9]/g, '-');

    try {
      // Step 1: Create tenant record in platform schema
      tenantLogger.info('Creating tenant record');
      const result = await db.query<Tenant>(
        `INSERT INTO platform.tenants (id, name, slug, keycloak_realm, schema_name, status, settings)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)
         RETURNING *`,
        [
          tenantId,
          request.name,
          request.slug,
          realmName,
          schemaName,
          JSON.stringify(request.settings || {}),
        ]
      );

      const tenant = result.rows[0];

      // Step 2: Create database schema for tenant data isolation
      tenantLogger.info('Creating tenant database schema');
      await db.createTenantSchema(schemaName);

      // Step 3: Create Keycloak realm
      tenantLogger.info('Creating Keycloak realm');
      await keycloakService.createRealm(realmName, request.name);

      // Step 4: Create roles in the realm
      tenantLogger.info('Creating realm roles');
      await keycloakService.createRealmRoles(realmName);

      // Step 5: Create client application
      tenantLogger.info('Creating Keycloak client');
      await keycloakService.createClient(realmName);

      // Step 6: Create admin user
      tenantLogger.info('Creating admin user');
      const adminKeycloakId = await keycloakService.createUser(
        realmName,
        request.adminEmail,
        request.adminFirstName,
        request.adminLastName,
        request.adminPassword,
        ['admin']
      );

      // Step 7: Sync admin user to tenant database
      tenantLogger.info('Syncing admin user to tenant database');
      const adminUserId = uuidv4();
      await db.queryWithTenant(
        schemaName,
        `INSERT INTO users (id, keycloak_id, email, first_name, last_name, role, status)
         VALUES ($1, $2, $3, $4, $5, 'admin', 'active')`,
        [adminUserId, adminKeycloakId, request.adminEmail, request.adminFirstName, request.adminLastName]
      );

      // Step 8: Activate tenant
      tenantLogger.info('Activating tenant');
      await db.query(
        `UPDATE platform.tenants SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [tenantId]
      );

      // Log successful provisioning for audit
      await auditService.log({
        tenantId,
        action: 'TENANT_CREATED',
        resourceType: 'tenant',
        resourceId: tenantId,
        details: {
          name: request.name,
          slug: request.slug,
          adminEmail: request.adminEmail,
        },
      });

      tenantLogger.info('Tenant provisioning completed successfully');

      return {
        ...tenant,
        status: 'active',
      };
    } catch (error) {
      tenantLogger.error('Tenant provisioning failed', { error });

      // Attempt cleanup on failure
      try {
        await this.cleanupFailedProvisioning(tenantId, schemaName, realmName);
      } catch (cleanupError) {
        tenantLogger.error('Cleanup after failed provisioning also failed', { cleanupError });
      }

      throw error;
    }
  }

  /**
   * Cleans up resources after a failed provisioning attempt.
   */
  private async cleanupFailedProvisioning(
    tenantId: string,
    schemaName: string,
    realmName: string
  ): Promise<void> {
    logger.warn('Cleaning up failed tenant provisioning', { tenantId, schemaName, realmName });

    // Delete tenant record
    await db.query('DELETE FROM platform.tenants WHERE id = $1', [tenantId]);

    // Drop schema if created
    try {
      await db.dropTenantSchema(schemaName);
    } catch (e) {
      // Schema might not exist
    }

    // Delete realm if created
    try {
      await keycloakService.deleteRealm(realmName);
    } catch (e) {
      // Realm might not exist
    }
  }

  /**
   * Gets a tenant by ID.
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    const result = await db.query<Tenant>(
      'SELECT * FROM platform.tenants WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Gets a tenant by slug.
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const result = await db.query<Tenant>(
      'SELECT * FROM platform.tenants WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Gets a tenant by Keycloak realm name.
   */
  async getTenantByRealm(realm: string): Promise<Tenant | null> {
    const result = await db.query<Tenant>(
      'SELECT * FROM platform.tenants WHERE keycloak_realm = $1',
      [realm]
    );
    return result.rows[0] || null;
  }

  /**
   * Lists all tenants with optional filtering.
   */
  async listTenants(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tenants: Tenant[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM platform.tenants ${whereClause}`,
      params
    );

    // Get tenants with pagination
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await db.query<Tenant>(
      `SELECT * FROM platform.tenants ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      tenants: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Updates tenant settings.
   */
  async updateTenantSettings(
    tenantId: string,
    settings: Record<string, any>
  ): Promise<Tenant> {
    const result = await db.query<Tenant>(
      `UPDATE platform.tenants
       SET settings = settings || $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(settings), tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Tenant not found');
    }

    await auditService.log({
      tenantId,
      action: 'TENANT_SETTINGS_UPDATED',
      resourceType: 'tenant',
      resourceId: tenantId,
      details: { settings },
    });

    return result.rows[0];
  }

  /**
   * Suspends a tenant (disables access).
   */
  async suspendTenant(tenantId: string, reason: string): Promise<void> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    await db.query(
      `UPDATE platform.tenants SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [tenantId]
    );

    await auditService.log({
      tenantId,
      action: 'TENANT_SUSPENDED',
      resourceType: 'tenant',
      resourceId: tenantId,
      details: { reason },
    });

    logger.warn('Tenant suspended', { tenantId, reason });
  }

  /**
   * Reactivates a suspended tenant.
   */
  async reactivateTenant(tenantId: string): Promise<void> {
    await db.query(
      `UPDATE platform.tenants SET status = 'active', updated_at = NOW() WHERE id = $1`,
      [tenantId]
    );

    await auditService.log({
      tenantId,
      action: 'TENANT_REACTIVATED',
      resourceType: 'tenant',
      resourceId: tenantId,
    });

    logger.info('Tenant reactivated', { tenantId });
  }

  /**
   * Deletes a tenant and all associated data.
   * WARNING: This is destructive and irreversible.
   */
  async deleteTenant(tenantId: string): Promise<void> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    logger.warn('Deleting tenant', { tenantId, name: tenant.name });

    // Delete Keycloak realm
    try {
      await keycloakService.deleteRealm(tenant.keycloak_realm);
    } catch (error) {
      logger.error('Failed to delete Keycloak realm', { error });
    }

    // Drop database schema
    await db.dropTenantSchema(tenant.schema_name);

    // Delete tenant record
    await db.query('DELETE FROM platform.tenants WHERE id = $1', [tenantId]);

    await auditService.log({
      action: 'TENANT_DELETED',
      resourceType: 'tenant',
      resourceId: tenantId,
      details: { name: tenant.name, slug: tenant.slug },
    });
  }
}

export const tenantService = new TenantService();
export default tenantService;
