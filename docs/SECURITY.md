# TaskHub Security Documentation

## Overview

This document outlines the security controls implemented in TaskHub for SOC2 compliance and GDPR data isolation requirements.

## SOC2 Trust Service Criteria

### Security

#### Access Control (CC6.1)

**Implementation:**
- All API endpoints require JWT authentication
- Role-based access control (RBAC) with three levels: Admin, Manager, Member
- Principle of least privilege enforced

```typescript
// Example: Role-based route protection
router.post('/projects',
  authenticate,           // Verify JWT token
  requireRole('admin', 'manager'),  // Check role
  createProject
);
```

#### Authentication (CC6.2)

**Implementation:**
- OAuth2/OIDC authentication via Keycloak
- PKCE flow for public clients
- Short-lived access tokens (5 minutes)
- Refresh token rotation

**Password Policy:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character

#### Authorization (CC6.3)

**Implementation:**
- Per-request authorization checks
- Tenant isolation via database schemas
- JWT claims validated on every request

### Availability

#### System Operations (CC7.1)

**Implementation:**
- Health check endpoints for monitoring
- Graceful shutdown handling
- Connection pooling for database

```typescript
// Health endpoints
GET /health       // Basic liveness
GET /health/ready // Dependency checks
GET /health/live  // Container liveness
```

### Processing Integrity

#### Data Processing (CC8.1)

**Implementation:**
- Input validation on all endpoints
- Parameterized queries prevent SQL injection
- Output encoding prevents XSS

```typescript
// Input validation example
const createTenantValidation = [
  body('name').trim().isLength({ min: 2, max: 255 }),
  body('slug').trim().matches(/^[a-z0-9-]+$/),
  body('adminEmail').isEmail().normalizeEmail(),
  body('adminPassword').isLength({ min: 8 }),
];
```

### Confidentiality

#### Data Protection (CC9.1)

**Implementation:**
- Schema-per-tenant data isolation
- No cross-tenant data access possible
- Sensitive data not logged

### Privacy

#### Personal Information (P1-P8)

**Implementation:**
- Data minimization in API responses
- Audit trails for all data access
- Tenant deletion removes all data

## Audit Logging

### Logged Events

All security-relevant events are logged to the `platform.audit_logs` table:

| Event Type | Description |
|------------|-------------|
| AUTH_LOGIN_SUCCESS | Successful authentication |
| AUTH_LOGIN_FAILURE | Failed authentication attempt |
| AUTH_LOGOUT | User logout |
| AUTH_TOKEN_REFRESH | Token refresh |
| DATA_CREATE | Resource creation |
| DATA_READ | Resource access |
| DATA_UPDATE | Resource modification |
| DATA_DELETE | Resource deletion |
| ACCESS_DENIED | Authorization failure |
| TENANT_CREATED | New tenant provisioned |
| TENANT_SUSPENDED | Tenant access disabled |
| TENANT_DELETED | Tenant removed |

### Audit Log Schema

```sql
CREATE TABLE platform.audit_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES platform.tenants(id),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Log Retention

- Audit logs retained for 7 years (configurable)
- Indexed for efficient querying
- Immutable (no updates or deletes)

### Compliance Reporting

```typescript
// Get audit summary for date range
GET /api/audit/summary?startDate=2024-01-01&endDate=2024-12-31

// Query specific events
GET /api/audit/logs?action=ACCESS_DENIED&startDate=2024-01-01
```

## GDPR Compliance

### Data Isolation

Each tenant's data is isolated using PostgreSQL schemas:

```
Database: taskhub
├── Schema: platform (shared)
│   ├── tenants
│   └── audit_logs
├── Schema: tenant_demo
│   ├── users
│   ├── projects
│   ├── tasks
│   └── comments
└── Schema: tenant_acme
    └── ...
```

**Key Guarantees:**
1. No cross-tenant queries possible
2. Schema search path set per-request
3. Tenant ID validated against JWT realm

### Right to Erasure

Tenant deletion removes all associated data:

```typescript
async deleteTenant(tenantId: string): Promise<void> {
  // Delete Keycloak realm (removes all users)
  await keycloakService.deleteRealm(tenant.keycloak_realm);

  // Drop database schema (removes all data)
  await db.dropTenantSchema(tenant.schema_name);

  // Delete tenant record
  await db.query('DELETE FROM platform.tenants WHERE id = $1', [tenantId]);
}
```

### Data Portability

Export tenant data:

```sql
-- Export all tenant data
COPY (SELECT * FROM tenant_demo.users) TO '/tmp/users.csv';
COPY (SELECT * FROM tenant_demo.projects) TO '/tmp/projects.csv';
COPY (SELECT * FROM tenant_demo.tasks) TO '/tmp/tasks.csv';
```

### Consent Management

- User accounts created by tenant admins
- No direct user registration
- Email verification configurable per realm

## Security Headers

The backend uses Helmet.js for security headers:

```typescript
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for API
  crossOriginEmbedderPolicy: false,
  // Additional headers enabled by default:
  // - X-DNS-Prefetch-Control
  // - X-Frame-Options
  // - Strict-Transport-Security
  // - X-Download-Options
  // - X-Content-Type-Options
  // - X-Permitted-Cross-Domain-Policies
  // - Referrer-Policy
  // - X-XSS-Protection
}));
```

## JWT Security

### Token Structure

```json
{
  "iss": "http://localhost:8080/realms/demo",
  "sub": "user-uuid",
  "aud": "taskhub-app",
  "exp": 1700000300,
  "iat": 1700000000,
  "realm_access": {
    "roles": ["admin"]
  }
}
```

### Validation Process

1. Extract realm from issuer claim
2. Fetch JWKS from realm endpoint
3. Verify signature using RS256
4. Validate expiration
5. Validate audience
6. Extract roles and user info

```typescript
// JWT validation
const { payload } = await jose.jwtVerify(token, jwks, {
  issuer: `${keycloakUrl}/realms/${realm}`,
  audience: 'taskhub-app',
});
```

### Token Lifecycle

| Token Type | Lifetime | Rotation |
|------------|----------|----------|
| Access Token | 5 minutes | On expiry |
| Refresh Token | 30 minutes | On use |
| ID Token | 5 minutes | N/A |

## Error Handling

### Safe Error Messages

Production error responses sanitize sensitive information:

```typescript
// Development: full error details
{
  "error": "Internal Server Error",
  "message": "Database connection failed",
  "stack": "Error: ...",
  "details": { ... }
}

// Production: sanitized
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

### No Information Leakage

- Generic error messages in production
- No stack traces exposed
- No database errors exposed
- No user enumeration possible

## Vulnerability Prevention

### SQL Injection

All database queries use parameterized statements:

```typescript
// Safe: parameterized query
await db.query(
  'SELECT * FROM projects WHERE id = $1',
  [projectId]
);

// Schema names are validated before use
const schemaName = tenant.schema_name; // From trusted source
await client.query(`SET search_path TO ${schemaName}`);
```

### Cross-Site Scripting (XSS)

- React auto-escapes output
- Content-Type headers enforced
- No HTML rendering from user input

### Cross-Site Request Forgery (CSRF)

- JWT in Authorization header (not cookies)
- CORS configured for allowed origins
- SameSite cookies for session management

### Brute Force Protection

Keycloak brute force settings:
- Max 5 failed attempts
- 60 second wait increment
- 15 minute max wait
- 12 hour permanent lockout after repeated failures

```json
{
  "bruteForceProtected": true,
  "failureFactor": 5,
  "waitIncrementSeconds": 60,
  "maxFailureWaitSeconds": 900,
  "permanentLockout": false
}
```

## Security Checklist

### Development

- [ ] All endpoints require authentication (except public routes)
- [ ] Role-based authorization implemented
- [ ] Input validation on all endpoints
- [ ] Parameterized database queries
- [ ] Error messages sanitized
- [ ] Audit logging implemented
- [ ] CORS properly configured
- [ ] Security headers enabled

### Deployment

- [ ] TLS/HTTPS enabled
- [ ] Secrets in environment variables
- [ ] Database credentials rotated
- [ ] Keycloak admin password changed
- [ ] Container images scanned
- [ ] Network policies configured
- [ ] Logging aggregation enabled
- [ ] Monitoring alerts configured

### Ongoing

- [ ] Regular security updates
- [ ] Penetration testing scheduled
- [ ] Access reviews conducted
- [ ] Audit logs reviewed
- [ ] Incident response plan tested
- [ ] Backup recovery tested

## Incident Response

### Detection

- Monitor authentication failures
- Track access denied events
- Alert on unusual patterns

### Response

1. Isolate affected tenant/user
2. Preserve audit logs
3. Investigate root cause
4. Remediate vulnerability
5. Notify affected parties
6. Document incident

### Recovery

- Restore from backups if needed
- Reset compromised credentials
- Review and update controls
