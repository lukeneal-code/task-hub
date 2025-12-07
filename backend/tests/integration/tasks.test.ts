/**
 * Tasks Integration Tests
 *
 * Tests CRUD operations for tasks.
 */

import { createClientForRole, Task } from '../helpers/api.helper';
import { TEST_CONFIG } from '../setup';

describe('Tasks', () => {
  const alphaProjectId = TEST_CONFIG.projects.alpha.one.id;
  const betaProjectId = TEST_CONFIG.projects.beta.one.id;

  describe('GET /api/projects/:id/tasks', () => {
    it('should list tasks for a project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get(`/api/projects/${alphaProjectId}/tasks`);

      expect(response.status).toBe(200);

      const tasks = response.data.data || response.data;
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should include seeded tasks', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get(`/api/projects/${alphaProjectId}/tasks`);

      expect(response.status).toBe(200);

      const tasks = response.data.data || response.data;
      const taskTitles = tasks.map((t: Task) => t.title);

      expect(taskTitles).toContain('Alpha Task 1');
    });

    it('should return 404 for non-existent project', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const fakeProjectId = '00000000-0000-0000-0000-000000000000';

      const response = await client.get(`/api/projects/${fakeProjectId}/tasks`);

      expect(response.status).toBe(404);
    });

    it('should not return tasks from another tenant project', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');

      // Try to access beta's project tasks with alpha's token
      const response = await alphaClient.get(
        `/api/projects/${betaProjectId}/tasks`
      );

      // Should be 404 - project doesn't exist in Alpha's schema
      expect(response.status).toBe(404);
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
      expect(response.data).toHaveProperty('id');
      expect(response.data.title).toBe(taskData.title);
      expect(response.data.project_id).toBe(alphaProjectId);
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
      expect(response.data.status).toBe('todo');
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
      expect(response.data.priority).toBe('medium');
    });

    it('should allow assigning a task to a user', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const assigneeId = TEST_CONFIG.users.alpha.member.id;

      const response = await client.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Assigned Task ${Date.now()}`,
          assignee_id: assigneeId,
        }
      );

      expect([200, 201]).toContain(response.status);
      expect(response.data.assignee_id).toBe(assigneeId);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return a specific task', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const taskId = TEST_CONFIG.tasks.alpha.task1.id;

      const response = await client.get(`/api/tasks/${taskId}`);

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(taskId);
      expect(response.data.title).toBe(TEST_CONFIG.tasks.alpha.task1.title);
    });

    it('should return 404 for non-existent task', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await client.get(`/api/tasks/${fakeId}`);

      expect(response.status).toBe(404);
    });

    it('should not return task from another tenant', async () => {
      const alphaClient = await createClientForRole('alpha', 'admin');
      const betaTaskId = TEST_CONFIG.tasks.beta.task1.id;

      const response = await alphaClient.get(`/api/tasks/${betaTaskId}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/tasks/:id', () => {
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
      const taskId = createResponse.data.id;

      // Update it
      const updateResponse = await client.put(`/api/tasks/${taskId}`, {
        title: 'Updated Task Title',
        status: 'in_progress',
        priority: 'high',
      });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.title).toBe('Updated Task Title');
      expect(updateResponse.data.status).toBe('in_progress');
      expect(updateResponse.data.priority).toBe('high');
    });

    it('should allow member to update their assigned task', async () => {
      const adminClient = await createClientForRole('alpha', 'admin');
      const memberClient = await createClientForRole('alpha', 'member');
      const memberId = TEST_CONFIG.users.alpha.member.id;

      // Admin creates task assigned to member
      const createResponse = await adminClient.post(
        `/api/projects/${alphaProjectId}/tasks`,
        {
          title: `Member Task ${Date.now()}`,
          assignee_id: memberId,
        }
      );

      expect([200, 201]).toContain(createResponse.status);
      const taskId = createResponse.data.id;

      // Member updates the task
      const updateResponse = await memberClient.put(`/api/tasks/${taskId}`, {
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
      const taskId = createResponse.data.id;

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
      const taskId = createResponse.data.id;
      expect(createResponse.data.status).toBe('todo');

      // Move to in_progress
      const inProgressResponse = await client.put(`/api/tasks/${taskId}`, {
        status: 'in_progress',
      });
      expect(inProgressResponse.status).toBe(200);
      expect(inProgressResponse.data.status).toBe('in_progress');

      // Move to done
      const doneResponse = await client.put(`/api/tasks/${taskId}`, {
        status: 'done',
      });
      expect(doneResponse.status).toBe(200);
      expect(doneResponse.data.status).toBe('done');
    });
  });
});
