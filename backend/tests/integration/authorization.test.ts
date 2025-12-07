/**
 * Authorization Integration Tests
 *
 * Tests role-based access control for different endpoints.
 */

import { createClientForRole } from '../helpers/api.helper';
import { TEST_CONFIG } from '../setup';

// Helper to extract data from API response (handles both wrapped and unwrapped formats)
function getData(responseData: any): any {
  return responseData.data !== undefined ? responseData.data : responseData;
}

// Helper to get a valid project ID from the API
// Always creates a new project to ensure a valid RFC 4122 UUID
// (seeded projects have non-compliant UUIDs that fail API validation)
async function getValidProjectId(tenant: 'alpha' | 'beta'): Promise<string> {
  const client = await createClientForRole(tenant, 'admin');
  const createResponse = await client.post('/api/projects', {
    name: `Auth Test Project ${Date.now()}`,
  });
  return getData(createResponse.data).id;
}

describe('Authorization - Role-Based Access Control', () => {
  describe('Project Creation', () => {
    it('should allow admin to create projects', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post('/api/projects', {
        name: `Test Project by Admin ${Date.now()}`,
        description: 'Created during authorization test',
      });

      // Should be allowed - either 201 or 200
      expect([200, 201]).toContain(response.status);
    });

    it('should allow manager to create projects', async () => {
      const client = await createClientForRole('alpha', 'manager');
      const response = await client.post('/api/projects', {
        name: `Test Project by Manager ${Date.now()}`,
        description: 'Created during authorization test',
      });

      // Should be allowed - either 201 or 200
      expect([200, 201]).toContain(response.status);
    });

    it('should deny member from creating projects', async () => {
      const client = await createClientForRole('alpha', 'member');
      const response = await client.post('/api/projects', {
        name: `Test Project by Member ${Date.now()}`,
        description: 'This should be rejected',
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Project Listing', () => {
    it('should allow admin to list projects', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);
      const projects = getData(response.data);
      expect(Array.isArray(projects)).toBe(true);
    });

    it('should allow manager to list projects', async () => {
      const client = await createClientForRole('alpha', 'manager');
      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);
    });

    it('should allow member to list projects', async () => {
      const client = await createClientForRole('alpha', 'member');
      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);
    });
  });

  describe('Task Creation', () => {
    let projectId: string;

    beforeAll(async () => {
      projectId = await getValidProjectId('alpha');
    });

    it('should allow admin to create tasks', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post(`/api/projects/${projectId}/tasks`, {
        title: `Test Task by Admin ${Date.now()}`,
        description: 'Created during authorization test',
        priority: 'medium',
      });

      expect([200, 201]).toContain(response.status);
    });

    it('should allow manager to create tasks', async () => {
      const client = await createClientForRole('alpha', 'manager');
      const response = await client.post(`/api/projects/${projectId}/tasks`, {
        title: `Test Task by Manager ${Date.now()}`,
        description: 'Created during authorization test',
        priority: 'high',
      });

      expect([200, 201]).toContain(response.status);
    });

    it('should deny member from creating tasks', async () => {
      const client = await createClientForRole('alpha', 'member');
      const response = await client.post(`/api/projects/${projectId}/tasks`, {
        title: `Test Task by Member ${Date.now()}`,
        description: 'This should be rejected',
        priority: 'low',
      });

      // Members cannot create tasks - only admin/manager can
      expect(response.status).toBe(403);
    });
  });

  describe('Audit Log Access', () => {
    it('should allow admin to view audit logs', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get('/api/audit/logs');

      // Admin should have access - might be 200 with data or empty array
      expect([200]).toContain(response.status);
    });

    it('should deny manager from viewing audit logs', async () => {
      const client = await createClientForRole('alpha', 'manager');
      const response = await client.get('/api/audit/logs');

      expect(response.status).toBe(403);
    });

    it('should deny member from viewing audit logs', async () => {
      const client = await createClientForRole('alpha', 'member');
      const response = await client.get('/api/audit/logs');

      expect(response.status).toBe(403);
    });
  });

  describe('Project Deletion', () => {
    it('should deny member from deleting projects', async () => {
      const projectId = await getValidProjectId('alpha');
      const client = await createClientForRole('alpha', 'member');

      const response = await client.delete(`/api/projects/${projectId}`);

      expect(response.status).toBe(403);
    });

    it('should allow admin to delete projects', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a project to delete
      const createResponse = await client.post('/api/projects', {
        name: `Project to Delete ${Date.now()}`,
        description: 'Will be deleted',
      });

      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const projectId = created.id;

      const deleteResponse = await client.delete(`/api/projects/${projectId}`);
      expect([200, 204]).toContain(deleteResponse.status);
    });
  });
});
