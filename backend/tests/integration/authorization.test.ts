/**
 * Authorization Integration Tests
 *
 * Tests role-based access control for different endpoints.
 */

import { createClientForRole } from '../helpers/api.helper';
import { TEST_CONFIG } from '../setup';

describe('Authorization - Role-Based Access Control', () => {
  describe('Project Creation', () => {
    it('should allow admin to create projects', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post('/api/projects', {
        name: 'Test Project by Admin',
        description: 'Created during authorization test',
      });

      // Should be allowed - either 201 or 200
      expect([200, 201]).toContain(response.status);
    });

    it('should allow manager to create projects', async () => {
      const client = await createClientForRole('alpha', 'manager');
      const response = await client.post('/api/projects', {
        name: 'Test Project by Manager',
        description: 'Created during authorization test',
      });

      // Should be allowed - either 201 or 200
      expect([200, 201]).toContain(response.status);
    });

    it('should deny member from creating projects', async () => {
      const client = await createClientForRole('alpha', 'member');
      const response = await client.post('/api/projects', {
        name: 'Test Project by Member',
        description: 'This should be rejected',
      });

      expect(response.status).toBe(403);
      expect(response.data.error).toBe('Forbidden');
      expect(response.data.message).toContain('permissions');
    });
  });

  describe('Project Listing', () => {
    it('should allow admin to list projects', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data || response.data)).toBe(true);
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
    const projectId = TEST_CONFIG.projects.alpha.one.id;

    it('should allow admin to create tasks', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post(`/api/projects/${projectId}/tasks`, {
        title: 'Test Task by Admin',
        description: 'Created during authorization test',
        priority: 'medium',
      });

      expect([200, 201]).toContain(response.status);
    });

    it('should allow manager to create tasks', async () => {
      const client = await createClientForRole('alpha', 'manager');
      const response = await client.post(`/api/projects/${projectId}/tasks`, {
        title: 'Test Task by Manager',
        description: 'Created during authorization test',
        priority: 'high',
      });

      expect([200, 201]).toContain(response.status);
    });

    it('should allow member to create tasks', async () => {
      const client = await createClientForRole('alpha', 'member');
      const response = await client.post(`/api/projects/${projectId}/tasks`, {
        title: 'Test Task by Member',
        description: 'Members should be able to create tasks',
        priority: 'low',
      });

      // Members can create tasks in existing projects
      expect([200, 201]).toContain(response.status);
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
      const client = await createClientForRole('alpha', 'member');
      // Try to delete an existing project
      const response = await client.delete(
        `/api/projects/${TEST_CONFIG.projects.alpha.one.id}`
      );

      expect(response.status).toBe(403);
    });

    it('should allow admin to delete projects', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a project to delete
      const createResponse = await client.post('/api/projects', {
        name: 'Project to Delete',
        description: 'Will be deleted',
      });

      if (createResponse.status === 201 || createResponse.status === 200) {
        const projectId = createResponse.data.id;
        const deleteResponse = await client.delete(`/api/projects/${projectId}`);

        expect([200, 204]).toContain(deleteResponse.status);
      }
    });
  });
});
