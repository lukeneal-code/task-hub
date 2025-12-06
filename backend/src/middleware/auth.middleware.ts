import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import config from '../config';
import logger from '../utils/logger';
import { auditService } from '../services/audit.service';
import { tenantService } from '../services/tenant.service';

/**
 * Extended Express Request with authentication context.
 * This interface is used throughout the application for type-safe access
 * to authenticated user and tenant information.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    realm: string;
  };
  tenant?: {
    id: string;
    slug: string;
    schema: string;
    realm: string;
  };
}

// Cache for JWKS (JSON Web Key Sets) per realm
const jwksCache = new Map<string, jose.JWTVerifyGetKey>();

/**
 * Gets or creates a JWKS fetcher for a specific realm.
 * Uses caching to avoid repeated network requests.
 */
async function getJwks(realm: string): Promise<jose.JWTVerifyGetKey> {
  if (jwksCache.has(realm)) {
    return jwksCache.get(realm)!;
  }

  const jwksUrl = `${config.keycloak.url}/realms/${realm}/protocol/openid-connect/certs`;

  const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
  jwksCache.set(realm, jwks);

  return jwks;
}

/**
 * Extracts the realm from a JWT token.
 * The realm is encoded in the issuer claim (iss).
 */
function extractRealmFromToken(token: string): string | null {
  try {
    // Decode without verification to extract realm
    const decoded = jose.decodeJwt(token);
    const issuer = decoded.iss as string;

    // Issuer format: http://localhost:8080/realms/{realm}
    const match = issuer?.match(/\/realms\/([^/]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * JWT Authentication Middleware
 *
 * Validates the JWT token from the Authorization header and:
 * 1. Verifies the token signature against Keycloak's JWKS
 * 2. Validates token expiration and issuer
 * 3. Extracts user information and roles
 * 4. Resolves the tenant from the token's realm
 *
 * This is the core authentication layer for the multi-tenant system.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'No valid authorization header provided',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Extract realm from token to use correct JWKS
    const realm = extractRealmFromToken(token);
    if (!realm) {
      throw new Error('Unable to determine realm from token');
    }

    // Get JWKS for the realm
    const jwks = await getJwks(realm);

    // Verify token signature and claims
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: `${config.keycloak.publicUrl}/realms/${realm}`,
      audience: config.jwt.audience,
    });

    // Extract user information from token claims
    const user = {
      id: payload.sub as string,
      email: (payload.email as string) || '',
      name: (payload.name as string) || (payload.preferred_username as string) || '',
      // Extract realm roles from the token
      roles: extractRoles(payload),
      realm,
    };

    // Resolve tenant from realm
    const tenant = await tenantService.getTenantByRealm(realm);
    if (!tenant) {
      logger.warn('Token realm does not match any tenant', { realm });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid tenant',
      });
      return;
    }

    if (tenant.status !== 'active') {
      logger.warn('Tenant is not active', { tenantId: tenant.id, status: tenant.status });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Tenant access is suspended',
      });
      return;
    }

    // Attach user and tenant to request
    req.user = user;
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      schema: tenant.schema_name,
      realm: tenant.keycloak_realm,
    };

    logger.debug('Request authenticated', {
      userId: user.id,
      tenantId: tenant.id,
      roles: user.roles,
    });

    next();
  } catch (error: any) {
    logger.warn('Authentication failed', { error: error.message });

    // Log failed authentication attempt
    await auditService.logAuth('LOGIN_FAILURE', {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      reason: error.message,
    });

    if (error.code === 'ERR_JWT_EXPIRED') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }
}

/**
 * Extracts roles from the JWT token payload.
 * Keycloak embeds roles in the realm_access and resource_access claims.
 */
function extractRoles(payload: jose.JWTPayload): string[] {
  const roles: string[] = [];

  // Extract realm roles
  const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
  if (realmAccess?.roles) {
    roles.push(...realmAccess.roles);
  }

  // Extract client-specific roles
  const resourceAccess = payload.resource_access as Record<string, { roles?: string[] }> | undefined;
  if (resourceAccess) {
    for (const [client, access] of Object.entries(resourceAccess)) {
      if (access.roles) {
        roles.push(...access.roles.map((role) => `${client}:${role}`));
      }
    }
  }

  return [...new Set(roles)]; // Remove duplicates
}

/**
 * Role-based authorization middleware factory.
 * Returns middleware that checks if the user has any of the required roles.
 *
 * @param allowedRoles - Array of role names that are allowed access
 */
export function requireRole(...allowedRoles: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const hasRole = allowedRoles.some((role) => req.user!.roles.includes(role));

    if (!hasRole) {
      logger.warn('Access denied - insufficient roles', {
        userId: req.user.id,
        requiredRoles: allowedRoles,
        userRoles: req.user.roles,
      });

      await auditService.logAccessDenied({
        tenantId: req.tenant?.id,
        userId: req.user.id,
        resource: req.path,
        action: req.method,
        reason: `Required roles: ${allowedRoles.join(', ')}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware.
 * Attempts to authenticate but doesn't fail if no token is provided.
 * Useful for endpoints that work differently for authenticated vs anonymous users.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  // If token is provided, validate it
  await authenticate(req, res, next);
}
