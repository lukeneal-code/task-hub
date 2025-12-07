# TaskHub API Documentation

## Overview

TaskHub has two API services:

1. **Backend API (Port 3001)** - Main application API for projects, tasks, and tenant-scoped operations
2. **Admin API (Port 8000)** - Tenant provisioning and user management

## Base URLs

```
Backend API:  http://localhost:3001
Admin API:    http://localhost:8000
```

## Authentication

All authenticated endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

The token must be obtained from Keycloak using the tenant's realm.

## Response Format

All responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "error": "Error Type",
  "message": "Human readable error message",
  "details": { ... }
}
```

## Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation error |
| 500 | Internal Server Error | Server error |

---

## Health Endpoints

### Check Health

```
GET /health
```

Returns basic health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "taskhub-backend",
  "version": "1.0.0"
}
```

### Check Readiness

```
GET /health/ready
```

Checks all dependencies (database, Keycloak).

**Response:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": true,
    "keycloak": true
  }
}
```

---

## Tenant Endpoints

### Lookup Tenant

```
GET /api/tenants/lookup/:slug
```

Look up a tenant by their slug. Used by the frontend to determine which Keycloak realm to authenticate against.

**Authentication:** None required

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| slug | string | path | Tenant slug (e.g., "demo") |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Demo Company",
    "slug": "demo",
    "realm": "demo",
    "status": "active",
    "settings": {
      "theme": "default",
      "logo": null
    }
  }
}
```

### Create Tenant

```
POST /api/tenants
```

Provisions a new tenant with database schema and Keycloak realm.

**Authentication:** Platform admin

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme",
  "adminEmail": "admin@acme.com",
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "adminPassword": "SecurePassword123!",
  "settings": {
    "theme": "custom",
    "features": ["projects", "tasks"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corporation",
    "slug": "acme",
    "realm": "acme",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Tenant created successfully"
}
```

### List Tenants

```
GET /api/tenants
```

Lists all tenants.

**Authentication:** Platform admin

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| status | string | Filter by status (active, suspended, pending) |
| limit | number | Max results (default: 50, max: 100) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Demo Company",
      "slug": "demo",
      "realm": "demo",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

### Get Tenant

```
GET /api/tenants/:id
```

Gets detailed tenant information.

**Authentication:** Tenant admin

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| id | uuid | path | Tenant ID |

### Update Tenant Settings

```
PATCH /api/tenants/:id/settings
```

Updates tenant settings.

**Authentication:** Tenant admin

**Request Body:**
```json
{
  "settings": {
    "theme": "dark",
    "logo": "https://example.com/logo.png"
  }
}
```

### Suspend Tenant

```
POST /api/tenants/:id/suspend
```

Suspends a tenant, preventing all access.

**Authentication:** Platform admin

**Request Body:**
```json
{
  "reason": "Payment overdue"
}
```

### Reactivate Tenant

```
POST /api/tenants/:id/reactivate
```

Reactivates a suspended tenant.

**Authentication:** Platform admin

### Delete Tenant

```
DELETE /api/tenants/:id
```

Permanently deletes a tenant and all associated data.

**Authentication:** Platform admin

---

## Project Endpoints

### List Projects

```
GET /api/projects
```

Lists all projects in the authenticated tenant.

**Authentication:** Any role

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| status | string | Filter by status (active, archived, completed) |
| ownerId | uuid | Filter by owner |
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Project Alpha",
      "description": "Main project",
      "status": "active",
      "owner_id": "uuid",
      "settings": {},
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

### Create Project

```
POST /api/projects
```

Creates a new project.

**Authentication:** Admin or Manager role

**Request Body:**
```json
{
  "name": "Project Alpha",
  "description": "Main project for Q1",
  "settings": {
    "color": "blue"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Project Alpha",
    "description": "Main project for Q1",
    "status": "active",
    "owner_id": "uuid",
    "settings": { "color": "blue" },
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Project

```
GET /api/projects/:id
```

Gets a specific project.

**Authentication:** Any role

### Update Project

```
PATCH /api/projects/:id
```

Updates a project.

**Authentication:** Admin or Manager role

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "status": "completed"
}
```

### Delete Project

```
DELETE /api/projects/:id
```

Deletes a project and all associated tasks.

**Authentication:** Admin role

---

## Task Endpoints

### List Tasks

```
GET /api/projects/:projectId/tasks
```

Lists all tasks in a project.

**Authentication:** Any role

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| status | string | Filter by status (todo, in_progress, review, done) |
| assigneeId | uuid | Filter by assignee |
| priority | string | Filter by priority (low, medium, high, urgent) |
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "title": "Implement feature X",
      "description": "Details...",
      "status": "in_progress",
      "priority": "high",
      "assignee_id": "uuid",
      "due_date": "2024-01-20T00:00:00.000Z",
      "created_by": "uuid",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0
  }
}
```

### Create Task

```
POST /api/projects/:projectId/tasks
```

Creates a new task.

**Authentication:** Any role

**Request Body:**
```json
{
  "title": "Implement feature X",
  "description": "Details about the task",
  "priority": "high",
  "assigneeId": "uuid",
  "dueDate": "2024-01-20T00:00:00.000Z"
}
```

### Get Task

```
GET /api/tasks/:id
```

Gets a specific task.

**Authentication:** Any role

### Update Task

```
PATCH /api/tasks/:id
```

Updates a task.

**Authentication:** Any role

**Request Body:**
```json
{
  "title": "Updated title",
  "status": "done",
  "priority": "low",
  "assigneeId": null,
  "dueDate": null
}
```

### Delete Task

```
DELETE /api/tasks/:id
```

Deletes a task.

**Authentication:** Any role (own tasks) or Admin/Manager (all tasks)

---

## Comment Endpoints

### List Comments

```
GET /api/tasks/:taskId/comments
```

Lists comments on a task.

**Authentication:** Any role

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "user_id": "uuid",
      "content": "Great progress!",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 50,
    "offset": 0
  }
}
```

### Create Comment

```
POST /api/tasks/:taskId/comments
```

Adds a comment to a task.

**Authentication:** Any role

**Request Body:**
```json
{
  "content": "This looks good, ready for review!"
}
```

### Delete Comment

```
DELETE /api/comments/:id
```

Deletes a comment.

**Authentication:** Own comments or Admin

---

## Audit Endpoints

### Query Audit Logs

```
GET /api/audit/logs
```

Queries audit logs for compliance reporting.

**Authentication:** Admin role

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| userId | string | Filter by user ID |
| action | string | Filter by action type |
| resourceType | string | Filter by resource type |
| startDate | ISO8601 | Start of date range |
| endDate | ISO8601 | End of date range |
| limit | number | Max results (default: 100, max: 1000) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "user_id": "uuid",
      "action": "DATA_CREATE",
      "resource_type": "project",
      "resource_id": "uuid",
      "details": {},
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 100,
    "offset": 0
  }
}
```

### Get Audit Summary

```
GET /api/audit/summary
```

Gets aggregated audit statistics for reporting.

**Authentication:** Admin role

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| startDate | ISO8601 | Start of date range (required) |
| endDate | ISO8601 | End of date range (required) |

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 1500,
    "eventsByAction": {
      "DATA_CREATE": 200,
      "DATA_READ": 1000,
      "DATA_UPDATE": 250,
      "DATA_DELETE": 50
    },
    "eventsByUser": {
      "user-uuid-1": 500,
      "user-uuid-2": 300
    },
    "accessDenials": 15
  }
}
```

---

## Rate Limiting

API requests are rate limited per IP address:

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 10 req/min |
| Standard API | 100 req/min |
| Admin API | 50 req/min |

When rate limited, the API returns:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "retryAfter": 60
}
```

## Webhook Events (Future)

TaskHub can be configured to send webhook notifications for events:

- `tenant.created`
- `project.created`
- `project.deleted`
- `task.created`
- `task.status_changed`
- `task.assigned`

Contact support for webhook configuration.

---

# Admin API (Port 8000)

The Admin API is a Python/FastAPI service for tenant provisioning and user management. It integrates directly with Keycloak to create realms, clients, and users.

## Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "admin-service"
}
```

---

## Tenant Endpoints

### List Tenants

```
GET /api/tenants
```

Lists all tenants with pagination.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| status | string | Filter by status (active, suspended, pending) |
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "slug": "acme",
      "status": "active",
      "schema_name": "tenant_acme",
      "settings": {},
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "user_count": 5
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

### Create Tenant

```
POST /api/tenants
```

Creates a new tenant with:
- Database schema
- Keycloak realm with roles (admin, manager, member)
- Keycloak client (taskhub-app)
- Admin user

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme",
  "admin_email": "admin@acme.com",
  "admin_first_name": "John",
  "admin_last_name": "Doe",
  "admin_password": "SecurePassword123",
  "settings": {
    "theme": "default"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Acme Corporation",
  "slug": "acme",
  "status": "active",
  "schema_name": "tenant_acme",
  "settings": {"theme": "default"},
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "user_count": 1
}
```

### Get Tenant

```
GET /api/tenants/{id}
```

Gets detailed tenant information.

**Parameters:**
| Name | Type | Location | Description |
|------|------|----------|-------------|
| id | uuid | path | Tenant ID |

### Suspend Tenant

```
POST /api/tenants/{id}/suspend
```

Suspends a tenant, preventing user access.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| reason | string | Suspension reason |

### Reactivate Tenant

```
POST /api/tenants/{id}/reactivate
```

Reactivates a suspended tenant.

### Delete Tenant

```
DELETE /api/tenants/{id}
```

Permanently deletes a tenant including:
- Keycloak realm
- Database schema
- Tenant record

---

## User Endpoints

### List Users in Tenant

```
GET /api/tenants/{tenant_id}/users
```

Lists all users in a tenant.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "admin@acme.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "admin",
      "roles": ["admin"],
      "status": "active",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 5,
  "limit": 50,
  "offset": 0
}
```

### Create User

```
POST /api/tenants/{tenant_id}/users
```

Creates a new user in both Keycloak and the tenant database.

**Request Body:**
```json
{
  "email": "manager@acme.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "password": "password123",
  "roles": ["manager"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "manager@acme.com",
  "first_name": "Jane",
  "last_name": "Smith",
  "role": "manager",
  "roles": ["manager"],
  "status": "active",
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Get User

```
GET /api/tenants/{tenant_id}/users/{user_id}
```

Gets a specific user's details.

### Assign Roles

```
POST /api/tenants/{tenant_id}/users/{user_id}/roles
```

Assigns roles to a user.

**Request Body:**
```json
{
  "roles": ["admin", "manager"]
}
```

### Delete User

```
DELETE /api/tenants/{tenant_id}/users/{user_id}
```

Deletes a user from both Keycloak and the tenant database.

---

## Admin API Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid request parameters |
| 404 | Not Found - Tenant or user not found |
| 422 | Validation Error - Request body validation failed |
| 500 | Internal Server Error - Server error |
