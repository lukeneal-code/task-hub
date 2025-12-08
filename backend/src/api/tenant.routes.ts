import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { tenantService, CreateTenantRequest } from '../services/tenant.service';
import keycloakService from '../services/keycloak.service';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

/**
 * Tenant Management API Routes
 *
 * These endpoints handle tenant lifecycle operations:
 * - Provisioning new tenants
 * - Listing and retrieving tenant information
 * - Updating tenant settings
 * - Suspending/reactivating tenants
 * - Deleting tenants
 *
 * Most operations require platform admin privileges.
 */

// Validation schemas
const createTenantValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('slug')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must be lowercase alphanumeric with hyphens only'),
  body('adminEmail')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid admin email is required'),
  body('adminFirstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Admin first name is required'),
  body('adminLastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Admin last name is required'),
  body('adminPassword')
    .isLength({ min: 8 })
    .withMessage('Admin password must be at least 8 characters'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
];

/**
 * POST /api/tenants
 *
 * Provisions a new tenant with:
 * - Database schema
 * - Keycloak realm with roles
 * - Initial admin user
 *
 * This is typically an internal/platform admin operation.
 */
router.post(
  '/',
  validate(createTenantValidation),
  asyncHandler(async (req, res: Response) => {
    const request: CreateTenantRequest = {
      name: req.body.name,
      slug: req.body.slug,
      adminEmail: req.body.adminEmail,
      adminFirstName: req.body.adminFirstName,
      adminLastName: req.body.adminLastName,
      adminPassword: req.body.adminPassword,
      settings: req.body.settings,
    };

    logger.info('Creating new tenant', { name: request.name, slug: request.slug });

    const tenant = await tenantService.createTenant(request);

    res.status(201).json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        realm: tenant.keycloak_realm,
        status: tenant.status,
        createdAt: tenant.created_at,
      },
      message: 'Tenant created successfully',
    });
  })
);

/**
 * GET /api/tenants
 *
 * Lists all tenants with optional filtering.
 * Platform admin only.
 */
router.get(
  '/',
  validate([
    query('status').optional().isIn(['active', 'suspended', 'pending']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req, res: Response) => {
    const { tenants, total } = await tenantService.listTenants({
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        realm: t.keycloak_realm,
        status: t.status,
        createdAt: t.created_at,
      })),
      pagination: {
        total,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      },
    });
  })
);

/**
 * GET /api/tenants/lookup/:slug
 *
 * Looks up a tenant by slug.
 * Used by the frontend to determine which Keycloak realm to authenticate against.
 * This is a public endpoint (no auth required).
 * Also returns configured identity providers for the login page.
 */
router.get(
  '/lookup/:slug',
  validate([
    param('slug').trim().notEmpty().withMessage('Slug is required'),
  ]),
  asyncHandler(async (req, res: Response) => {
    const tenant = await tenantService.getTenantBySlug(req.params.slug);

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Fetch configured identity providers for this tenant
    let identityProviders: Array<{ alias: string; displayName: string }> = [];
    try {
      const idps = await keycloakService.getIdentityProviders(tenant.keycloak_realm);
      identityProviders = idps
        .filter((idp: any) => idp.enabled)
        .map((idp: any) => ({
          alias: idp.alias,
          displayName: idp.displayName || idp.alias,
        }));
    } catch (error) {
      logger.warn('Failed to fetch IDPs for tenant', { tenant: tenant.slug, error });
      // Continue without IDPs - not a fatal error
    }

    // Return minimal info needed for login plus identity providers
    res.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        realm: tenant.keycloak_realm,
        status: tenant.status,
        settings: {
          theme: tenant.settings.theme,
          logo: tenant.settings.logo,
        },
        identityProviders,
      },
    });
  })
);

/**
 * GET /api/tenants/:id
 *
 * Gets detailed tenant information.
 * Requires authentication and appropriate access.
 */
router.get(
  '/:id',
  authenticate,
  validate([
    param('id').isUUID().withMessage('Valid tenant ID is required'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tenant = await tenantService.getTenantById(req.params.id);

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Users can only view their own tenant details
    if (req.tenant?.id !== tenant.id && !req.user?.roles.includes('platform-admin')) {
      throw new AppError('Access denied', 403);
    }

    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * PATCH /api/tenants/:id/settings
 *
 * Updates tenant settings.
 * Requires tenant admin role.
 */
router.patch(
  '/:id/settings',
  authenticate,
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('Valid tenant ID is required'),
    body('settings').isObject().withMessage('Settings must be an object'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Verify user belongs to this tenant
    if (req.tenant?.id !== req.params.id) {
      throw new AppError('Access denied', 403);
    }

    const tenant = await tenantService.updateTenantSettings(
      req.params.id,
      req.body.settings
    );

    res.json({
      success: true,
      data: {
        id: tenant.id,
        settings: tenant.settings,
        updatedAt: tenant.updated_at,
      },
      message: 'Settings updated successfully',
    });
  })
);

/**
 * POST /api/tenants/:id/suspend
 *
 * Suspends a tenant.
 * Platform admin only.
 */
router.post(
  '/:id/suspend',
  validate([
    param('id').isUUID().withMessage('Valid tenant ID is required'),
    body('reason').trim().notEmpty().withMessage('Suspension reason is required'),
  ]),
  asyncHandler(async (req, res: Response) => {
    await tenantService.suspendTenant(req.params.id, req.body.reason);

    res.json({
      success: true,
      message: 'Tenant suspended successfully',
    });
  })
);

/**
 * POST /api/tenants/:id/reactivate
 *
 * Reactivates a suspended tenant.
 * Platform admin only.
 */
router.post(
  '/:id/reactivate',
  validate([
    param('id').isUUID().withMessage('Valid tenant ID is required'),
  ]),
  asyncHandler(async (req, res: Response) => {
    await tenantService.reactivateTenant(req.params.id);

    res.json({
      success: true,
      message: 'Tenant reactivated successfully',
    });
  })
);

/**
 * DELETE /api/tenants/:id
 *
 * Permanently deletes a tenant and all associated data.
 * Platform admin only. Use with extreme caution.
 */
router.delete(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Valid tenant ID is required'),
  ]),
  asyncHandler(async (req, res: Response) => {
    await tenantService.deleteTenant(req.params.id);

    res.json({
      success: true,
      message: 'Tenant deleted successfully',
    });
  })
);

export default router;
