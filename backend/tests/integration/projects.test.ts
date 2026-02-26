/**
 * Projects Integration Tests
 *
 * Tests CRUD operations for projects.
 */

import { createClientForRole, Project } from '../helpers/api.helper';
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
    name: `Project Test ${Date.now()}`,
  });
  return getData(createResponse.data).id;
}

describe('Projects', () => {
  let betaProjectId: string;

  beforeAll(async () => {
    betaProjectId = await getValidProjectId('beta');
  });

  describe('GET /api/projects', () => {
    it('should list projects for authenticated user', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);

      const projects = getData(response.data);
      expect(Array.isArray(projects)).toBe(true);
    });

    it('should include created projects', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Create a project first
      const projectName = `List Test Project ${Date.now()}`;
      await client.post('/api/projects', { name: projectName });

      const response = await client.get('/api/projects');

      expect(response.status).toBe(200);

      const projects = getData(response.data);
      const projectNames = projects.map((p: Project) => p.name);

      expect(projectNames).toContain(projectName);
    });

    it('should only return projects from the authenticated tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaClient = await createClientForRole('beta', 'admin');

      const alphaResponse = await alphaClient.get('/api/projects');
      const betaResponse = await betaClient.get('/api/projects');

      expect(alphaResponse.status).toBe(200);
      expect(betaResponse.status).toBe(200);

      const alphaProjects = getData(alphaResponse.data);
      const betaProjects = getData(betaResponse.data);

      // Get IDs from each tenant
      const alphaProjectIds = alphaProjects.map((p: Project) => p.id);
      const betaProjectIds = betaProjects.map((p: Project) => p.id);

      // Alpha should not see Beta's projects (no overlap)
      const overlap = alphaProjectIds.filter((id: string) =>
        betaProjectIds.includes(id)
      );
      expect(overlap).toHaveLength(0);
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
      const project = getData(response.data);
      expect(project).toHaveProperty('id');
      expect(project.name).toBe(projectData.name);
      expect(project.description).toBe(projectData.description);
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
      const project = getData(response.data);
      expect(project.status).toBe('active');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return a specific project', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a project
      const createResponse = await client.post('/api/projects', {
        name: `Get Test Project ${Date.now()}`,
      });
      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const projectId = created.id;

      const response = await client.get(`/api/projects/${projectId}`);

      expect(response.status).toBe(200);
      const project = getData(response.data);
      expect(project.id).toBe(projectId);
    });

    it('should return 404 for non-existent project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await client.get(`/api/projects/${fakeId}`);

      expect(response.status).toBe(404);
    });

    it('should not return project from another tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');

      const response = await alphaClient.get(`/api/projects/${betaProjectId}`);

      // Should be rejected - project doesn't exist in Alpha's schema
      // API may return 400, 403, or 404 depending on implementation
      expect([400, 403, 404]).toContain(response.status);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update a project', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a project to update
      const createResponse = await client.post('/api/projects', {
        name: `Project to Update ${Date.now()}`,
        description: 'Original description',
      });

      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const projectId = created.id;

      // Now update it using PATCH (API uses PATCH, not PUT)
      const updateResponse = await client.patch(`/api/projects/${projectId}`, {
        name: 'Updated Project Name',
        description: 'Updated description',
      });

      expect(updateResponse.status).toBe(200);
      const updated = getData(updateResponse.data);
      expect(updated.name).toBe('Updated Project Name');
      expect(updated.description).toBe('Updated description');
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
      const created = getData(createResponse.data);
      const projectId = created.id;

      // Delete it
      const deleteResponse = await client.delete(`/api/projects/${projectId}`);
      expect([200, 204]).toContain(deleteResponse.status);

      // Verify it's gone
      const getResponse = await client.get(`/api/projects/${projectId}`);
      expect(getResponse.status).toBe(404);
    });
  });
});
