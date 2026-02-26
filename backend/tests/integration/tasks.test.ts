/**
 * Tasks Integration Tests
 *
 * Tests CRUD operations for tasks.
 */

import { createClientForRole, Task } from '../helpers/api.helper';
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
    name: `Tasks Test Project ${Date.now()}`,
  });
  return getData(createResponse.data).id;
}

// Helper to get a valid task ID from the API
async function getValidTaskId(
  tenant: 'alpha' | 'beta',
  projectId: string
): Promise<string> {
  const client = await createClientForRole(tenant, 'admin');
  const response = await client.get(`/api/projects/${projectId}/tasks`);
  const tasks = getData(response.data);
  if (tasks.length === 0) {
    const createResponse = await client.post(
      `/api/projects/${projectId}/tasks`,
      {
        title: `Seeded Task ${Date.now()}`,
      }
    );
    return getData(createResponse.data).id;
  }
  return tasks[0].id;
}

describe('Tasks', () => {
  let alphaProjectId: string;
  let betaProjectId: string;

  beforeAll(async () => {
    alphaProjectId = await getValidProjectId('alpha');
    betaProjectId = await getValidProjectId('beta');
  });

  describe('GET /api/projects/:id/tasks', () => {
    it('should list tasks for a project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get(
        `/api/projects/${alphaProjectId}/tasks`
      );

      expect(response.status).toBe(200);

      const tasks = getData(response.data);
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should include created tasks', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Create a task first
      const taskTitle = `List Test Task ${Date.now()}`;
      await client.post(`/api/projects/${alphaProjectId}/tasks`, {
        title: taskTitle,
      });

      const response = await client.get(
        `/api/projects/${alphaProjectId}/tasks`
      );

      expect(response.status).toBe(200);

      const tasks = getData(response.data);
      const taskTitles = tasks.map((t: Task) => t.title);

      expect(taskTitles).toContain(taskTitle);
    });

    it('should return empty array for non-existent project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const fakeProjectId = '00000000-0000-0000-0000-000000000000';

      const response = await client.get(`/api/projects/${fakeProjectId}/tasks`);

      // API returns 200 with empty array for non-existent project (rather than 404)
      expect(response.status).toBe(200);
      const tasks = getData(response.data);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toHaveLength(0);
    });

    it('should not return tasks from another tenant project', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');

      // Try to access beta's project tasks with alpha's token
      const response = await alphaClient.get(
        `/api/projects/${betaProjectId}/tasks`
      );

      // API returns 200 with empty array for projects that don't exist in user's schema
      // This is secure because no data from other tenants is exposed
      expect(response.status).toBe(200);
      const tasks = getData(response.data);
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toHaveLength(0);
    });
  });

  describe('POST /api/projects/:id/tasks', () => {
    it('should create a new task', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const taskData = {
        title: `Test Task ${Date.now()}`,
        description: 'Created during integration test',
        priority: 'medium',
        status: 'todo',
      };

      const response = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        taskData
      );

      expect([200, 201]).toContain(response.status);
      const task = getData(response.data);
      expect(task).toHaveProperty('id');
      expect(task.title).toBe(taskData.title);
      expect(task.project_id).toBe(alphaProjectId);
    });

    it('should require a task title', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          description: 'Missing title',
        }
      );

      expect(response.status).toBe(400);
    });

    it('should set default status to todo', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Default Status Test ${Date.now()}`,
        }
      );

      expect([200, 201]).toContain(response.status);
      const task = getData(response.data);
      expect(task.status).toBe('todo');
    });

    it('should set default priority to medium', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Default Priority Test ${Date.now()}`,
        }
      );

      expect([200, 201]).toContain(response.status);
      const task = getData(response.data);
      expect(task.priority).toBe('medium');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return a specific task', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a task
      const createResponse = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Get Task Test ${Date.now()}`,
        }
      );
      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const taskId = created.id;

      const response = await client.get(`/api/tasks/${taskId}`);

      expect(response.status).toBe(200);
      const task = getData(response.data);
      expect(task.id).toBe(taskId);
    });

    it('should return 404 for non-existent task', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await client.get(`/api/tasks/${fakeId}`);

      expect(response.status).toBe(404);
    });

    it('should not return task from another tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaClient = await createClientForRole('beta', 'admin');

      // First create a task in beta
      const betaTaskResponse = await betaClient.post(
        `/api/projects/${betaProjectId}/tasks`,
        {
          title: `Beta Task ${Date.now()}`,
        }
      );
      expect([200, 201]).toContain(betaTaskResponse.status);
      const betaTask = getData(betaTaskResponse.data);

      // Try to access it from alpha
      const response = await alphaClient.get(`/api/tasks/${betaTask.id}`);

      // Should be rejected - task doesn't exist in Alpha's schema
      expect([400, 403, 404]).toContain(response.status);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('should update a task', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // First create a task to update
      const createResponse = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Task to Update ${Date.now()}`,
          status: 'todo',
        }
      );

      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const taskId = created.id;

      // Update it using PATCH (API uses PATCH, not PUT)
      const updateResponse = await client.patch(`/api/tasks/${taskId}`, {
        title: 'Updated Task Title',
        status: 'in_progress',
        priority: 'high',
      });

      expect(updateResponse.status).toBe(200);
      const updated = getData(updateResponse.data);
      expect(updated.title).toBe('Updated Task Title');
      expect(updated.status).toBe('in_progress');
      expect(updated.priority).toBe('high');
    });

    it('should allow member to update tasks', async () => {
      const adminClient = await createClientForRole('alpha', 'admin');
      const memberClient = await createClientForRole('alpha', 'member');

      // Admin creates a task
      const createResponse = await adminClient.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Member Update Task ${Date.now()}`,
        }
      );

      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const taskId = created.id;

      // Member updates the task using PATCH (API uses PATCH, not PUT)
      const updateResponse = await memberClient.patch(`/api/tasks/${taskId}`, {
        status: 'in_progress',
      });

      expect(updateResponse.status).toBe(200);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Create a task to delete
      const createResponse = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Task to Delete ${Date.now()}`,
        }
      );

      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const taskId = created.id;

      // Delete it
      const deleteResponse = await client.delete(`/api/tasks/${taskId}`);
      expect([200, 204]).toContain(deleteResponse.status);

      // Verify it's gone
      const getResponse = await client.get(`/api/tasks/${taskId}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('Task Status Transitions', () => {
    it('should allow valid status transitions', async () => {
      const client = await createClientForRole('alpha', 'admin');

      // Create a new task
      const createResponse = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Status Transition Test ${Date.now()}`,
        }
      );

      expect([200, 201]).toContain(createResponse.status);
      const created = getData(createResponse.data);
      const taskId = created.id;
      expect(created.status).toBe('todo');

      // Move to in_progress using PATCH (API uses PATCH, not PUT)
      const inProgressResponse = await client.patch(`/api/tasks/${taskId}`, {
        status: 'in_progress',
      });
      expect(inProgressResponse.status).toBe(200);
      const inProgress = getData(inProgressResponse.data);
      expect(inProgress.status).toBe('in_progress');

      // Move to done using PATCH
      const doneResponse = await client.patch(`/api/tasks/${taskId}`, {
        status: 'done',
      });
      expect(doneResponse.status).toBe(200);
      const done = getData(doneResponse.data);
      expect(done.status).toBe('done');
    });
  });
});
