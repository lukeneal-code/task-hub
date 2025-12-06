# TaskHub Architecture Documentation

## System Overview

TaskHub is a multi-tenant SaaS application demonstrating enterprise-grade Identity and Access Management (IAM) patterns. This document provides detailed architectural documentation.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     React/Next.js Frontend                           │  │
│   │   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐            │  │
│   │   │ Tenant Login  │ │   Projects    │ │    Tasks      │            │  │
│   │   │   - Keycloak  │ │   - CRUD      │ │   - Kanban    │            │  │
│   │   │   - SSO       │ │   - List      │ │   - CRUD      │            │  │
│   │   └───────────────┘ └───────────────┘ └───────────────┘            │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS / JWT Bearer Tokens
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               API LAYER                                      │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    Node.js/Express Backend                           │  │
│   │                                                                      │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │                      MIDDLEWARE                              │   │  │
│   │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │  │
│   │   │  │  CORS    │ │  Helmet  │ │ Rate     │ │ Morgan   │       │   │  │
│   │   │  │          │ │ Security │ │ Limiting │ │ Logging  │       │   │  │
│   │   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                      │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │                   AUTHENTICATION                             │   │  │
│   │   │  ┌────────────────────────────────────────────────────────┐ │   │  │
│   │   │  │  JWT Validation Middleware                             │ │   │  │
│   │   │  │  - Extract realm from token issuer                     │ │   │  │
│   │   │  │  - Validate signature against realm JWKS               │ │   │  │
│   │   │  │  - Extract user info and roles                         │ │   │  │
│   │   │  │  - Resolve tenant from realm                           │ │   │  │
│   │   │  └────────────────────────────────────────────────────────┘ │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                      │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │                     API ROUTES                               │   │  │
│   │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │  │
│   │   │  │ Tenants  │ │ Projects │ │  Tasks   │ │  Audit   │       │   │  │
│   │   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                      │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │                    SERVICES                                  │   │  │
│   │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │  │
│   │   │  │ Tenant   │ │ Keycloak │ │ Project  │ │  Audit   │       │   │  │
│   │   │  │ Service  │ │ Service  │ │ Service  │ │ Service  │       │   │  │
│   │   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐
│      KEYCLOAK         │ │    POSTGRESQL     │ │        CACHE              │
│                       │ │                   │ │     (Optional)            │
│ ┌───────────────────┐ │ │ ┌───────────────┐ │ │                           │
│ │   Master Realm    │ │ │ │   Platform    │ │ │  ┌──────────────────────┐ │
│ │   (Admin Access)  │ │ │ │   Schema      │ │ │  │   JWKS Cache         │ │
│ └───────────────────┘ │ │ │   - tenants   │ │ │  │   - Per-realm keys   │ │
│ ┌───────────────────┐ │ │ │   - audit_logs│ │ │  └──────────────────────┘ │
│ │   Tenant Realms   │ │ │ └───────────────┘ │ │  ┌──────────────────────┐ │
│ │   - Users         │ │ │ ┌───────────────┐ │ │  │   Session Cache      │ │
│ │   - Roles         │ │ │ │  Tenant       │ │ │  │   (Optional)         │ │
│ │   - Clients       │ │ │ │  Schemas      │ │ │  └──────────────────────┘ │
│ │   - Identity      │ │ │ │  - users      │ │ │                           │
│ │     Providers     │ │ │ │  - projects   │ │ └───────────────────────────┘
│ └───────────────────┘ │ │ │  - tasks      │ │
│                       │ │ │  - comments   │ │
└───────────────────────┘ │ └───────────────┘ │
                          └───────────────────┘
```

## Multi-Tenant Data Isolation

### Database Schema Strategy

TaskHub uses the **Schema-Per-Tenant** pattern for data isolation:

```
PostgreSQL Database: taskhub
├── Schema: platform (shared)
│   ├── tenants          # Tenant registry
│   └── audit_logs       # Platform-wide audit trail
│
├── Schema: tenant_demo
│   ├── users            # Synced from Keycloak
│   ├── projects
│   ├── tasks
│   └── comments
│
├── Schema: tenant_acme
│   ├── users
│   ├── projects
│   ├── tasks
│   └── comments
│
└── Schema: tenant_xyz
    └── ...
```

### Schema Routing

```typescript
// Each request sets the search_path to the tenant's schema
async function queryWithTenant<T>(
  tenantSchema: string,
  query: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    // This ensures all unqualified table names resolve to tenant schema
    await client.query(`SET search_path TO ${tenantSchema}, public`);
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}
```

## Authentication Flow

### 1. Tenant Discovery

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  User    │          │ Frontend │          │ Backend  │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │  Enter org slug     │                     │
     │  (e.g., "demo")     │                     │
     │─────────────────────>                     │
     │                     │                     │
     │                     │  GET /api/tenants   │
     │                     │  /lookup/demo       │
     │                     │─────────────────────>
     │                     │                     │
     │                     │  { realm: "demo",   │
     │                     │    status: "active"}│
     │                     │<─────────────────────
     │                     │                     │
     │                     │  Initialize         │
     │                     │  Keycloak with      │
     │                     │  realm: "demo"      │
     │                     │                     │
```

### 2. Keycloak Authentication

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  User    │          │ Frontend │          │ Keycloak │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │  Click "Sign In"    │                     │
     │─────────────────────>                     │
     │                     │                     │
     │                     │  Redirect to        │
     │                     │  /realms/demo/      │
     │                     │  protocol/openid-   │
     │                     │  connect/auth       │
     │<──────────────────────────────────────────│
     │                     │                     │
     │  Enter credentials  │                     │
     │────────────────────────────────────────────>
     │                     │                     │
     │  Redirect back with │                     │
     │  authorization code │                     │
     │<──────────────────────────────────────────│
     │                     │                     │
     │                     │  Exchange code      │
     │                     │  for tokens         │
     │                     │─────────────────────>
     │                     │                     │
     │                     │  { access_token,    │
     │                     │    refresh_token }  │
     │                     │<─────────────────────
```

### 3. JWT Token Structure

```json
{
  "iss": "http://localhost:8080/realms/demo",
  "sub": "user-uuid",
  "aud": "taskhub-app",
  "exp": 1700000000,
  "iat": 1699999700,
  "email": "admin@demo.com",
  "name": "Demo Admin",
  "preferred_username": "admin@demo.com",
  "realm_access": {
    "roles": ["admin", "default-roles-demo"]
  },
  "resource_access": {
    "taskhub-app": {
      "roles": ["app-user"]
    }
  }
}
```

### 4. API Request Authentication

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│ Frontend │          │ Backend  │          │ Keycloak │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │  GET /api/projects  │                     │
     │  Authorization:     │                     │
     │  Bearer <token>     │                     │
     │─────────────────────>                     │
     │                     │                     │
     │                     │  Extract realm from │
     │                     │  token issuer       │
     │                     │                     │
     │                     │  GET /realms/demo/  │
     │                     │  protocol/openid-   │
     │                     │  connect/certs      │
     │                     │─────────────────────>
     │                     │                     │
     │                     │  { JWKS keys }      │
     │                     │<─────────────────────
     │                     │                     │
     │                     │  Verify signature   │
     │                     │  with JWKS          │
     │                     │                     │
     │                     │  Resolve tenant     │
     │                     │  from realm         │
     │                     │                     │
     │                     │  Set search_path    │
     │                     │  to tenant schema   │
     │                     │                     │
     │  { projects: [...] }│                     │
     │<─────────────────────                     │
```

## Role-Based Access Control

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                         ADMIN                                │
│  - Full tenant management                                    │
│  - User management (via Keycloak)                           │
│  - Audit log access                                         │
│  - All manager permissions                                   │
├─────────────────────────────────────────────────────────────┤
│                        MANAGER                               │
│  - Create/edit/delete projects                              │
│  - Manage all tasks in projects                             │
│  - All member permissions                                    │
├─────────────────────────────────────────────────────────────┤
│                         MEMBER                               │
│  - View projects                                            │
│  - Create/edit tasks                                        │
│  - Add comments                                              │
└─────────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Resource        | Action | Admin | Manager | Member |
|-----------------|--------|-------|---------|--------|
| Projects        | Create | Yes   | Yes     | No     |
| Projects        | Read   | Yes   | Yes     | Yes    |
| Projects        | Update | Yes   | Yes     | No     |
| Projects        | Delete | Yes   | No      | No     |
| Tasks           | Create | Yes   | Yes     | Yes    |
| Tasks           | Read   | Yes   | Yes     | Yes    |
| Tasks           | Update | Yes   | Yes     | Own    |
| Tasks           | Delete | Yes   | Yes     | Own    |
| Comments        | Create | Yes   | Yes     | Yes    |
| Comments        | Delete | Yes   | Yes     | Own    |
| Tenant Settings | Update | Yes   | No      | No     |
| Audit Logs      | Read   | Yes   | No      | No     |

## Audit Logging System

### Logged Events

```typescript
// Authentication events
AUTH_LOGIN_SUCCESS
AUTH_LOGIN_FAILURE
AUTH_LOGOUT
AUTH_TOKEN_REFRESH

// Data access events
DATA_CREATE
DATA_READ
DATA_UPDATE
DATA_DELETE

// Authorization events
ACCESS_DENIED

// Administrative events
TENANT_CREATED
TENANT_SUSPENDED
TENANT_REACTIVATED
TENANT_DELETED
TENANT_SETTINGS_UPDATED
```

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

## Security Considerations

### Defense in Depth

1. **Network Layer**: Services communicate within Docker network
2. **Transport Layer**: HTTPS (TLS) in production
3. **Application Layer**: JWT validation, RBAC
4. **Data Layer**: Schema isolation, parameterized queries

### Token Security

- Short-lived access tokens (5 minutes)
- Longer refresh tokens with rotation
- PKCE for public clients
- Token validation on every request

### Data Protection

- No cross-tenant data access possible
- All queries scoped to tenant schema
- Secrets stored in environment variables
- No sensitive data in logs

## Scalability Considerations

### Horizontal Scaling

```
                    ┌─────────────┐
                    │ Load        │
                    │ Balancer    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
     ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
     │ Backend 1 │   │ Backend 2 │   │ Backend 3 │
     └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────┴──────┐
                    │  PostgreSQL │
                    │  (Primary)  │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  PostgreSQL │
                    │  (Replica)  │
                    └─────────────┘
```

### Future Enhancements

1. **Database Sharding**: For very large tenants
2. **Redis Caching**: Session and JWKS caching
3. **Event Sourcing**: For better audit trails
4. **Async Processing**: Job queues for long operations

## Technology Decisions

| Requirement | Technology | Rationale |
|-------------|------------|-----------|
| Identity Provider | Keycloak | Industry standard, multi-realm support |
| Database | PostgreSQL | Schema support, mature, ACID compliant |
| Backend | Node.js/Express | Fast development, good ecosystem |
| Frontend | React/Next.js | Modern, SSR support, good DX |
| Auth Protocol | OAuth2/OIDC | Standard, well-supported |
| Token Format | JWT | Stateless, standard |
