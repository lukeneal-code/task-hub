# TaskHub - Multi-Tenant SaaS Project Management Platform

A comprehensive proof-of-concept demonstrating enterprise-grade multi-tenant Identity and Access Management (IAM) patterns using Keycloak, React, and Node.js.

## Overview

TaskHub demonstrates key multi-tenant SaaS architecture concepts:

- **Multi-Tenancy**: Complete tenant isolation using Keycloak realms and PostgreSQL schemas
- **Role-Based Access Control (RBAC)**: Admin, Manager, and Member roles with hierarchical permissions
- **SOC2 Compliance**: Comprehensive audit logging for all security-relevant events
- **GDPR Data Isolation**: Schema-per-tenant database architecture ensures complete data separation
- **Single Sign-On (SSO)**: Keycloak-powered authentication with social login support

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React/Next.js)                     │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│    │ Tenant Login │  │   Projects   │  │    Tasks     │            │
│    └──────────────┘  └──────────────┘  └──────────────┘            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              │ HTTPS + JWT
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Backend API (Node.js)                         │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│    │  Auth MW     │  │  Tenant MW   │  │   API Routes │            │
│    │  (JWT Val)   │  │  (Schema)    │  │              │            │
│    └──────────────┘  └──────────────┘  └──────────────┘            │
└───────────┬─────────────────────────────────────┬───────────────────┘
            │                                     │
            │ Admin API                           │ PostgreSQL
            ▼                                     ▼
┌───────────────────────────┐       ┌───────────────────────────────┐
│        Keycloak           │       │         PostgreSQL            │
│   ┌─────────────────┐     │       │  ┌────────────────────────┐  │
│   │   Master Realm  │     │       │  │   Platform Schema      │  │
│   └─────────────────┘     │       │  │   - tenants            │  │
│   ┌─────────────────┐     │       │  │   - audit_logs         │  │
│   │  Tenant Realm A │     │       │  └────────────────────────┘  │
│   │  (demo, acme)   │     │       │  ┌────────────────────────┐  │
│   └─────────────────┘     │       │  │   Tenant Schema A      │  │
│   ┌─────────────────┐     │       │  │   - users              │  │
│   │  Tenant Realm B │     │       │  │   - projects           │  │
│   └─────────────────┘     │       │  │   - tasks              │  │
│                           │       │  └────────────────────────┘  │
└───────────────────────────┘       └───────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

### Setup

1. **Clone and navigate to the project:**
   ```bash
   cd task-hub
   ```

2. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Wait for services to be ready** (first startup takes ~2-3 minutes):
   ```bash
   # Check service health
   docker-compose ps

   # View logs if needed
   docker-compose logs -f
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Keycloak Admin: http://localhost:8080/admin (admin/admin)

### Demo Credentials

For the `demo` tenant:

| Role    | Email             | Password     |
|---------|-------------------|--------------|
| Admin   | admin@demo.com    | Admin123!    |
| Manager | manager@demo.com  | Manager123!  |
| Member  | member@demo.com   | Member123!   |

## Project Structure

```
task-hub/
├── backend/                    # Node.js/Express API
│   └── src/
│       ├── api/               # Route handlers
│       ├── config/            # Configuration
│       ├── middleware/        # Auth, validation, error handling
│       ├── services/          # Business logic
│       └── utils/             # Helpers (DB, logging)
├── frontend/                   # React/Next.js App
│   └── src/
│       ├── app/               # Next.js pages
│       │   └── [tenant]/      # Tenant-scoped routes
│       │       ├── projects/  # Project management
│       │       └── settings/  # Tenant settings (admin only)
│       ├── components/        # UI components
│       ├── contexts/          # Auth context
│       ├── hooks/             # Custom hooks
│       ├── services/          # API client
│       └── types/             # TypeScript types
├── keycloak/                   # Keycloak configuration
│   ├── realm-config/          # Realm JSON exports
│   └── themes/                # Custom login themes
├── scripts/                    # Database scripts
├── docs/                       # Documentation
└── docker-compose.yml          # Service orchestration
```

## Key Features

### 1. Multi-Tenant Authentication

Each tenant has their own Keycloak realm, providing:
- Isolated user databases
- Custom authentication policies
- Tenant-specific branding
- Independent password policies

```typescript
// Frontend: Tenant-aware authentication
const kc = new Keycloak({
  url: 'http://localhost:8080',
  realm: tenant.keycloak_realm,  // Dynamic realm based on tenant
  clientId: 'taskhub-app',
});
```

### 2. Role-Based Access Control

Three roles with hierarchical permissions:

| Role    | Permissions                                              |
|---------|----------------------------------------------------------|
| Admin   | Full access, tenant settings, user management            |
| Manager | Create/manage projects, create/assign tasks              |
| Member  | View projects and tasks, update assigned tasks           |

```typescript
// Backend: Role-based route protection
router.post('/projects',
  authenticate,
  requireRole('admin', 'manager'),
  createProject
);
```

### 3. Schema-Per-Tenant Data Isolation

Each tenant's data is isolated in a separate PostgreSQL schema:

```sql
-- Platform-level (shared)
platform.tenants
platform.audit_logs

-- Tenant-specific (isolated)
tenant_demo.users
tenant_demo.projects
tenant_demo.tasks
tenant_acme.users
tenant_acme.projects
...
```

### 4. JWT Token Validation

Tokens are validated against the correct Keycloak realm:

```typescript
// Extract realm from token issuer
const realm = extractRealmFromToken(token);

// Validate against realm-specific JWKS
const jwks = await getJwks(realm);
await jose.jwtVerify(token, jwks, {
  issuer: `${keycloakUrl}/realms/${realm}`,
});
```

### 5. Tenant Settings Page

Admins can access organization settings at `/{tenant}/settings`:
- View organization information (name, slug, tenant ID)
- View authentication configuration (Keycloak realm, SSO provider)
- Access Keycloak Admin Console for advanced identity configuration
- View security and compliance status (audit logging, data isolation, RBAC)

### 6. SOC2 Compliant Audit Logging

All security-relevant events are logged:

```typescript
await auditService.log({
  tenantId,
  userId,
  action: 'DATA_CREATE',
  resourceType: 'project',
  resourceId: projectId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

## API Documentation

### Tenant Management

| Method | Endpoint                    | Description              | Auth    |
|--------|-----------------------------|--------------------------| --------|
| POST   | /api/tenants                | Create new tenant        | None*   |
| GET    | /api/tenants                | List all tenants         | Admin   |
| GET    | /api/tenants/lookup/:slug   | Lookup tenant by slug    | None    |
| PATCH  | /api/tenants/:id/settings   | Update tenant settings   | Admin   |

### Projects

| Method | Endpoint              | Description           | Auth           |
|--------|-----------------------|-----------------------|----------------|
| GET    | /api/projects         | List projects         | Any role       |
| POST   | /api/projects         | Create project        | Admin, Manager |
| GET    | /api/projects/:id     | Get project           | Any role       |
| PATCH  | /api/projects/:id     | Update project        | Admin, Manager |
| DELETE | /api/projects/:id     | Delete project        | Admin          |

### Tasks

| Method | Endpoint                       | Description           | Auth           |
|--------|--------------------------------|-----------------------|----------------|
| GET    | /api/projects/:id/tasks        | List tasks            | Any role       |
| POST   | /api/projects/:id/tasks        | Create task           | Admin, Manager |
| GET    | /api/tasks/:id                 | Get task              | Any role       |
| PATCH  | /api/tasks/:id                 | Update task           | Any role       |
| DELETE | /api/tasks/:id                 | Delete task           | Any role       |

### Audit Logs

| Method | Endpoint              | Description           | Auth   |
|--------|-----------------------|-----------------------|--------|
| GET    | /api/audit/logs       | Query audit logs      | Admin  |
| GET    | /api/audit/summary    | Audit summary report  | Admin  |

## Configuration

### Environment Variables

```bash
# PostgreSQL
POSTGRES_USER=taskhub
POSTGRES_PASSWORD=taskhub_secret
POSTGRES_DB=taskhub

# Keycloak
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# Backend
NODE_ENV=development
PORT=3001

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
```

## Creating New Tenants

### Via API

```bash
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme",
    "adminEmail": "admin@acme.com",
    "adminFirstName": "John",
    "adminLastName": "Doe",
    "adminPassword": "SecurePassword123!"
  }'
```

This will:
1. Create a tenant record
2. Create a PostgreSQL schema (`tenant_acme`)
3. Create a Keycloak realm (`acme`)
4. Create realm roles (admin, manager, member)
5. Create the admin user with admin role

## Security Considerations

### SOC2 Controls Implemented

- **Access Control**: Role-based authorization on all endpoints
- **Audit Logging**: All authentication and data access events logged
- **Encryption**: HTTPS in transit (configure in production)
- **Session Management**: Configurable token lifetimes
- **Password Policy**: Enforced complexity requirements

### GDPR Compliance

- **Data Isolation**: Schema-per-tenant ensures no data leakage
- **Data Portability**: Tenant data can be exported per-schema
- **Right to Deletion**: Tenant deletion removes all associated data

## Development

### Running Locally (without Docker)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
cd backend
npm test
```

## Troubleshooting

### Common Issues

**Keycloak not starting:**
```bash
# Check logs
docker-compose logs keycloak

# Ensure PostgreSQL is ready first
docker-compose up -d postgres
# Wait 30 seconds
docker-compose up -d keycloak
```

**Token validation errors:**
- Ensure the JWT issuer matches Keycloak's public URL
- Check that the realm exists in Keycloak
- Verify client configuration in Keycloak

**Database connection errors:**
- Verify PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in environment
