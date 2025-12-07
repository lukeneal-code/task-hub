# TaskHub - Multi-Tenant SaaS Project Management Platform

A comprehensive proof-of-concept demonstrating enterprise-grade multi-tenant Identity and Access Management (IAM) patterns using Keycloak, React, and Node.js.

## Overview

TaskHub demonstrates key multi-tenant SaaS architecture concepts:

- **Multi-Tenancy**: Complete tenant isolation using Keycloak realms and PostgreSQL schemas
- **Role-Based Access Control (RBAC)**: Admin, Manager, and Member roles with hierarchical permissions
- **SOC2 Compliance**: Comprehensive audit logging for all security-relevant events
- **GDPR Data Isolation**: Schema-per-tenant database architecture ensures complete data separation
- **Single Sign-On (SSO)**: Keycloak-powered authentication with social login support
- **Admin Service**: Python/FastAPI service for tenant provisioning with React admin UI

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

┌─────────────────────────────────────────────────────────────────────┐
│                    Admin Service (Python/FastAPI)                    │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│    │ Tenant API   │  │  User API    │  │  Keycloak    │            │
│    │ /tenants/*   │  │  /users/*    │  │  Integration │            │
│    └──────────────┘  └──────────────┘  └──────────────┘            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Admin UI (React/Vite)                           │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│    │ Tenant List  │  │Create Tenant │  │ User Mgmt    │            │
│    └──────────────┘  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for admin service local development)
- Git

### Setup

1. **Clone and navigate to the project:**
   ```bash
   cd task-hub
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Wait for services to be ready** (first startup takes ~2-3 minutes):
   ```bash
   # Check service health
   docker-compose ps

   # View logs if needed
   docker-compose logs -f
   ```

4. **Access the applications:**

   | Service | URL | Description |
   |---------|-----|-------------|
   | Frontend | http://localhost:3000 | Main application (tenant login) |
   | Backend API | http://localhost:3001 | REST API for frontend |
   | Admin UI | http://localhost:5173 | Tenant management dashboard |
   | Admin API | http://localhost:8000 | Tenant provisioning API |
   | Keycloak | http://localhost:8080 | Identity provider (admin/admin) |

### Demo Credentials

For the `demo` tenant (http://localhost:3000/demo):

| Role    | Email             | Password     |
|---------|-------------------|--------------|
| Admin   | admin@demo.com    | password123  |
| Manager | manager@demo.com  | password123  |
| Member  | member@demo.com   | password123  |

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
├── admin-service/              # Python/FastAPI Admin Service
│   ├── app/
│   │   ├── api/               # REST endpoints
│   │   ├── models/            # Pydantic models
│   │   └── services/          # Business logic
│   │       ├── tenant_service.py   # Tenant provisioning
│   │       ├── user_service.py     # User management
│   │       └── keycloak_service.py # Keycloak integration
│   └── admin-ui/              # React/Vite Admin UI
│       └── src/
│           ├── pages/         # TenantList, TenantCreate, etc.
│           └── services/      # API client
├── keycloak/                   # Keycloak configuration
│   ├── realm-config/          # Realm JSON exports
│   └── themes/                # Custom login themes
├── scripts/                    # Database scripts
├── docs/                       # Documentation
└── docker-compose.yml          # Service orchestration
```

## Key Features

### 1. Admin Service - Tenant Provisioning

The admin service (Python/FastAPI) handles automated tenant lifecycle:

```bash
# Create a new tenant via Admin API
curl -X POST http://localhost:8000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme",
    "admin_email": "admin@acme.com",
    "admin_first_name": "John",
    "admin_last_name": "Doe",
    "admin_password": "SecurePassword123"
  }'
```

This automatically:
1. Creates tenant record in platform database
2. Creates Keycloak realm with roles (admin, manager, member)
3. Creates `taskhub-app` client in realm
4. Creates database schema (`tenant_acme`)
5. Creates admin user in both Keycloak and database

### 2. Multi-Tenant Authentication

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

### 3. Role-Based Access Control

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

### 4. Schema-Per-Tenant Data Isolation

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

### 5. JWT Token Validation

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

### Admin Service API (Port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tenants | List all tenants |
| POST | /api/tenants | Create new tenant (provisions Keycloak + DB) |
| GET | /api/tenants/{id} | Get tenant details |
| POST | /api/tenants/{id}/suspend | Suspend tenant |
| POST | /api/tenants/{id}/reactivate | Reactivate tenant |
| DELETE | /api/tenants/{id} | Delete tenant |
| GET | /api/tenants/{id}/users | List users in tenant |
| POST | /api/tenants/{id}/users | Create user (provisions in Keycloak) |
| DELETE | /api/tenants/{id}/users/{user_id} | Delete user |
| POST | /api/tenants/{id}/users/{user_id}/roles | Assign roles |

### Backend API (Port 3001)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/tenants/lookup/:slug | Lookup tenant by slug | None |
| GET | /api/projects | List projects | Any role |
| POST | /api/projects | Create project | Admin, Manager |
| GET | /api/projects/:id/tasks | List tasks | Any role |
| POST | /api/projects/:id/tasks | Create task | Any role |
| GET | /api/audit/logs | Query audit logs | Admin |

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

# Admin Service
DATABASE_URL=postgresql://taskhub:taskhub_secret@postgres:5432/taskhub
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin
```

## Creating New Tenants

### Via Admin UI

1. Navigate to http://localhost:5173
2. Click "Create Tenant"
3. Fill in organization details and admin credentials
4. Click "Create Tenant"

The tenant is immediately available at http://localhost:3000/{slug}

### Via Admin API

```bash
curl -X POST http://localhost:8000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme",
    "admin_email": "admin@acme.com",
    "admin_first_name": "John",
    "admin_last_name": "Doe",
    "admin_password": "SecurePassword123"
  }'
```

### Adding Users to a Tenant

```bash
# Get tenant ID first
TENANT_ID=$(curl -s http://localhost:8000/api/tenants | jq -r '.data[] | select(.slug=="acme") | .id')

# Create a new user
curl -X POST "http://localhost:8000/api/tenants/$TENANT_ID/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@acme.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "password": "password123",
    "roles": ["manager"]
  }'
```

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

# Admin Service
cd admin-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Admin UI
cd admin-service/admin-ui
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

**Redirect loop after login:**
- Clear browser cookies for localhost
- Ensure the Keycloak realm has the `taskhub-app` client configured
- Check that the tenant has a valid `keycloak_realm` in the database

**Admin service can't connect to Keycloak:**
- Ensure Keycloak is healthy: `docker-compose ps`
- Verify `KEYCLOAK_URL` is set to `http://keycloak:8080` (Docker network)
