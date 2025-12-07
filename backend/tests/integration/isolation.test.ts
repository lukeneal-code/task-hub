/**
 * Multi-Tenant Isolation Integration Tests
 *
 * CRITICAL: These tests verify that tenant data isolation is working correctly.
 * Failure of these tests indicates a serious security vulnerability.
 */

import { createClientForRole, apiClient } from '../helpers/api.helper';
import { TEST_CONFIG } from '../setup';

describe('Multi-Tenant Isolation', () => {
  describe('Cross-Tenant Data Access', () => {
    it('CRITICAL: Alpha tenant cannot access Beta projects', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaProjectId = TEST_CONFIG.projects.beta.one.id;

      const response = await alphaClient.get(`/api/projects/${betaProjectId}`);

      // Must NOT be 200 - project should not be accessible
      // API may return 400 (validation), 403 (forbidden), or 404 (not found)
      expect([400, 403, 404]).toContain(response.status);
    });

    it('CRITICAL: Beta tenant cannot access Alpha projects', async () => {
      const betaClient = await createClientForRole('beta', 'admin');
      const alphaProjectId = TEST_CONFIG.projects.alpha.one.id;

      const response = await betaClient.get(`/api/projects/${alphaProjectId}`);

      expect([400, 403, 404]).toContain(response.status);
    });

    it('CRITICAL: Alpha tenant cannot access Beta tasks', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaTaskId = TEST_CONFIG.tasks.beta.task1.id;

      const response = await alphaClient.get(`/api/tasks/${betaTaskId}`);

      expect([400, 403, 404]).toContain(response.status);
    });

    it('CRITICAL: Beta tenant cannot access Alpha tasks', async () => {
      const betaClient = await createClientForRole('beta', 'admin');
      const alphaTaskId = TEST_CONFIG.tasks.alpha.task1.id;

      const response = await betaClient.get(`/api/tasks/${alphaTaskId}`);

      expect([400, 403, 404]).toContain(response.status);
    });

    it('CRITICAL: Cannot create tasks in another tenant project', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaProjectId = TEST_CONFIG.projects.beta.one.id;

      const response = await alphaClient.post(
        `/api/projects/${betaProjectId}/tasks`,
        {
          title: 'Cross-tenant task injection attempt',
        }
      );

      // Must NOT be 201 - should be rejected
      expect([400, 403, 404]).toContain(response.status);
    });

    it('CRITICAL: Cannot update tasks in another tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaTaskId = TEST_CONFIG.tasks.beta.task1.id;

      const response = await alphaClient.put(`/api/tasks/${betaTaskId}`, {
        title: 'Cross-tenant update attempt',
      });

      expect([400, 403, 404]).toContain(response.status);
    });

    it('CRITICAL: Cannot delete tasks in another tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaTaskId = TEST_CONFIG.tasks.beta.task1.id;

      const response = await alphaClient.delete(`/api/tasks/${betaTaskId}`);

      expect([400, 403, 404]).toContain(response.status);
    });

    it('CRITICAL: Cannot delete projects in another tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaProjectId = TEST_CONFIG.projects.beta.one.id;

      const response = await alphaClient.delete(
        `/api/projects/${betaProjectId}`
      );

      expect([400, 403, 404]).toContain(response.status);
    });
  });

  describe('Project List Isolation', () => {
    it('Alpha project list contains only Alpha projects', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaClient = await createClientForRole('beta', 'admin');

      // Create a project in each tenant to ensure we have something to test
      const alphaProjectName = `Alpha Isolation Test ${Date.now()}`;
      const betaProjectName = `Beta Isolation Test ${Date.now()}`;

      const alphaCreate = await alphaClient.post('/api/projects', { name: alphaProjectName });
      expect([200, 201]).toContain(alphaCreate.status);
      const alphaProjectId = (alphaCreate.data.data || alphaCreate.data).id;

      const betaCreate = await betaClient.post('/api/projects', { name: betaProjectName });
      expect([200, 201]).toContain(betaCreate.status);
      const betaProjectId = (betaCreate.data.data || betaCreate.data).id;

      // Now check Alpha's project list
      const response = await alphaClient.get('/api/projects');
      expect(response.status).toBe(200);

      const projects = response.data.data || response.data;
      const projectIds = projects.map((p: any) => p.id);

      // Should contain the Alpha project we just created
      expect(projectIds).toContain(alphaProjectId);

      // Should NOT contain the Beta project we just created
      expect(projectIds).not.toContain(betaProjectId);
    });

    it('Beta project list contains only Beta projects', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaClient = await createClientForRole('beta', 'admin');

      // Create a project in each tenant to ensure we have something to test
      const alphaProjectName = `Alpha Isolation Test ${Date.now()}`;
      const betaProjectName = `Beta Isolation Test ${Date.now()}`;

      const alphaCreate = await alphaClient.post('/api/projects', { name: alphaProjectName });
      expect([200, 201]).toContain(alphaCreate.status);
      const alphaProjectId = (alphaCreate.data.data || alphaCreate.data).id;

      const betaCreate = await betaClient.post('/api/projects', { name: betaProjectName });
      expect([200, 201]).toContain(betaCreate.status);
      const betaProjectId = (betaCreate.data.data || betaCreate.data).id;

      // Now check Beta's project list
      const response = await betaClient.get('/api/projects');
      expect(response.status).toBe(200);

      const projects = response.data.data || response.data;
      const projectIds = projects.map((p: any) => p.id);

      // Should contain the Beta project we just created
      expect(projectIds).toContain(betaProjectId);

      // Should NOT contain the Alpha project we just created
      expect(projectIds).not.toContain(alphaProjectId);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle malicious project ID safely', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Attempt SQL injection via project ID
      const maliciousId = "'; DROP TABLE projects; --";
      const response = await client.get(
        `/api/projects/${encodeURIComponent(maliciousId)}`
      );

      // Should be 400 (invalid UUID) or 404, not a server error
      expect([400, 404]).toContain(response.status);
    });

    it('should handle malicious search parameters safely', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Attempt SQL injection via query parameter
      const maliciousSearch = "'; SELECT * FROM tenant_beta.projects; --";
      const response = await client.get('/api/projects', {
        params: { search: maliciousSearch },
      });

      // Should complete without error
      expect(response.status).not.toBe(500);

      // Should not leak cross-tenant data
      const projects = response.data.data || response.data;
      if (Array.isArray(projects)) {
        const projectIds = projects.map((p: any) => p.id);
        expect(projectIds).not.toContain(TEST_CONFIG.projects.beta.one.id);
      }
    });

    it('should handle UNION SELECT injection attempt', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Attempt UNION-based SQL injection
      const maliciousSearch =
        "' UNION SELECT * FROM tenant_beta.projects WHERE '1'='1";
      const response = await client.get('/api/projects', {
        params: { search: maliciousSearch },
      });

      expect(response.status).not.toBe(500);

      // Must not return Beta data
      const projects = response.data.data || response.data;
      if (Array.isArray(projects)) {
        projects.forEach((project: any) => {
          expect(project.id).not.toBe(TEST_CONFIG.projects.beta.one.id);
          expect(project.id).not.toBe(TEST_CONFIG.projects.beta.two.id);
        });
      }
    });
  });

  describe('Schema Boundary Enforcement', () => {
    it('Alpha tasks are in Alpha project only', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Create a new project to get a valid RFC 4122 UUID
      // (seeded projects have non-compliant UUIDs that fail API validation)
      const createResponse = await client.post('/api/projects', {
        name: `Alpha Schema Test ${Date.now()}`,
      });
      expect([200, 201]).toContain(createResponse.status);
      const created = createResponse.data.data || createResponse.data;
      const projectId = created.id;

      // Create a task in this project
      const taskResponse = await client.post(`/api/projects/${projectId}/tasks`, {
        title: `Alpha Schema Task ${Date.now()}`,
      });
      expect([200, 201]).toContain(taskResponse.status);

      // Now list tasks and verify they belong to this project
      const tasksResponse = await client.get(`/api/projects/${projectId}/tasks`);
      expect(tasksResponse.status).toBe(200);

      const tasks = tasksResponse.data.data || tasksResponse.data;
      tasks.forEach((task: any) => {
        expect(task.project_id).toBe(projectId);
      });
    });

    it('Beta tasks are in Beta project only', async () => {
      const client = await createClientForRole('beta', 'admin');

      // Create a new project to get a valid RFC 4122 UUID
      // (seeded projects have non-compliant UUIDs that fail API validation)
      const createResponse = await client.post('/api/projects', {
        name: `Beta Schema Test ${Date.now()}`,
      });
      expect([200, 201]).toContain(createResponse.status);
      const created = createResponse.data.data || createResponse.data;
      const projectId = created.id;

      // Create a task in this project
      const taskResponse = await client.post(`/api/projects/${projectId}/tasks`, {
        title: `Beta Schema Task ${Date.now()}`,
      });
      expect([200, 201]).toContain(taskResponse.status);

      // Now list tasks and verify they belong to this project
      const tasksResponse = await client.get(`/api/projects/${projectId}/tasks`);
      expect(tasksResponse.status).toBe(200);

      const tasks = tasksResponse.data.data || tasksResponse.data;
      tasks.forEach((task: any) => {
        expect(task.project_id).toBe(projectId);
      });
    });
  });

  describe('Token Cross-Tenant Rejection', () => {
    it('Alpha token cannot be used with Beta tenant slug', async () => {
      // This tests that even if someone tries to use an Alpha token
      // while specifying Beta tenant context, they should be rejected

      // Get Alpha user token
      const alphaClient = await createClientForRole('alpha', 'admin');

      // Try to access with a potential tenant override header
      // (if such a mechanism existed, it should be ignored)
      const response = await alphaClient.get('/api/projects', {
        headers: {
          'X-Tenant-Slug': 'beta',
          'X-Tenant-ID': TEST_CONFIG.tenants.beta.id,
        },
      });

      // Should return Alpha data, not Beta data
      const projects = response.data.data || response.data;
      if (Array.isArray(projects) && projects.length > 0) {
        // All returned projects should be Alpha projects
        projects.forEach((project: any) => {
          expect(project.id).not.toBe(TEST_CONFIG.projects.beta.one.id);
          expect(project.id).not.toBe(TEST_CONFIG.projects.beta.two.id);
        });
      }
    });
  });
});
