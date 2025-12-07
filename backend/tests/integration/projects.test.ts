/**
 * Projects Integration Tests
 *
 * Tests CRUD operations for projects.
 */

import { createClientForRole, Project } from '../helpers/api.helper';
import { TEST_CONFIG } from '../setup';

describe('Projects', () => {
  describe('GET /api/projects', () => {
    it('should list projects for authenticated user', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);

      // Response might be { data: [...] } or just [...]
      const projects = response.data.data || response.data;
      expect(Array.isArray(projects)).toBe(true);
    });

    it('should include seeded projects', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);

      const projects = response.data.data || response.data;
      const projectNames = projects.map((p: Project) => p.name);

      expect(projectNames).toContain('Alpha Project One');
    });

    it('should only return projects from the authenticated tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaClient = await createClientForRole('beta', 'admin');

      const alphaResponse = await alphaClient.get('/api/projects');
      const betaResponse = await betaClient.get('/api/projects');

      expect(alphaResponse.status).toBe(200);
      expect(betaResponse.status).toBe(200);

      const alphaProjects = alphaResponse.data.data || alphaResponse.data;
      const betaProjects = betaResponse.data.data || betaResponse.data;

      // Alpha should not see Beta's projects
      const alphaProjectIds = alphaProjects.map((p: Project) => p.id);
      expect(alphaProjectIds).not.toContain(TEST_CONFIG.projects.beta.one.id);

      // Beta should not see Alpha's projects
      const betaProjectIds = betaProjects.map((p: Project) => p.id);
      expect(betaProjectIds).not.toContain(TEST_CONFIG.projects.alpha.one.id);
    });
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const projectData = {
        name: `Test Project ${Date.now()}`,
        description: 'Created during integration test',
      };

      const response = await client.post('/api/projects', projectData);

      expect([200, 201]).toContain(response.status);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(projectData.name);
      expect(response.data.description).toBe(projectData.description);
    });

    it('should require a project name', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post('/api/projects', {
        description: 'Missing name',
      });

      expect(response.status).toBe(400);
    });

    it('should set default status to active', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post('/api/projects', {
        name: `Default Status Test ${Date.now()}`,
      });

      expect([200, 201]).toContain(response.status);
      expect(response.data.status).toBe('active');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return a specific project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const projectId = TEST_CONFIG.projects.alpha.one.id;

      const response = await client.get(`/api/projects/${projectId}`);

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(projectId);
      expect(response.data.name).toBe(TEST_CONFIG.projects.alpha.one.name);
    });

    it('should return 404 for non-existent project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await client.get(`/api/projects/${fakeId}`);

      expect(response.status).toBe(404);
    });

    it('should not return project from another tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaProjectId = TEST_CONFIG.projects.beta.one.id;

      const response = await alphaClient.get(`/api/projects/${betaProjectId}`);

      // Should be 404 - project doesn't exist in Alpha's schema
      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update a project', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a project to update
      const createResponse = await client.post('/api/projects', {
        name: `Project to Update ${Date.now()}`,
        description: 'Original description',
      });

      expect([200, 201]).toContain(createResponse.status);
      const projectId = createResponse.data.id;

      // Now update it
      const updateResponse = await client.put(`/api/projects/${projectId}`, {
        name: 'Updated Project Name',
        description: 'Updated description',
      });

      expect(response.status).toBe(200);
      expect(updateResponse.data.name).toBe('Updated Project Name');
      expect(updateResponse.data.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a project to delete
      const createResponse = await client.post('/api/projects', {
        name: `Project to Delete ${Date.now()}`,
      });

      expect([200, 201]).toContain(createResponse.status);
      const projectId = createResponse.data.id;

      // Delete it
      const deleteResponse = await client.delete(`/api/projects/${projectId}`);
      expect([200, 204]).toContain(deleteResponse.status);

      // Verify it's gone
      const getResponse = await client.get(`/api/projects/${projectId}`);
      expect(getResponse.status).toBe(404);
    });
  });
});
