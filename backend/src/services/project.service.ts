import { v4 as uuidv4 } from 'uuid';
import db from '../utils/database';
import { auditService } from './audit.service';
import logger from '../utils/logger';

/**
 * Project data structure
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  owner_id: string | null;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Task data structure
 */
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id: string | null;
  due_date: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Comment data structure
 */
export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Project Service
 *
 * Handles all project, task, and comment operations within a tenant.
 * All operations are scoped to the tenant's schema for data isolation.
 */
class ProjectService {
  /**
   * Creates a new project.
   */
  async createProject(
    tenantSchema: string,
    data: {
      name: string;
      description?: string;
      ownerId?: string;
      settings?: Record<string, any>;
    },
    context: { tenantId: string; userId: string }
  ): Promise<Project> {
    const projectId = uuidv4();

    const result = await db.queryWithTenant<Project>(
      tenantSchema,
      `INSERT INTO projects (id, name, description, owner_id, settings)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        projectId,
        data.name,
        data.description || null,
        data.ownerId || null,
        JSON.stringify(data.settings || {}),
      ]
    );

    await auditService.logDataAccess('CREATE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'project',
      resourceId: projectId,
    });

    logger.info('Project created', { tenantSchema, projectId, name: data.name });
    return result.rows[0];
  }

  /**
   * Gets a project by ID.
   */
  async getProject(
    tenantSchema: string,
    projectId: string
  ): Promise<Project | null> {
    const result = await db.queryWithTenant<Project>(
      tenantSchema,
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    return result.rows[0] || null;
  }

  /**
   * Lists all projects in a tenant.
   */
  async listProjects(
    tenantSchema: string,
    options?: {
      status?: string;
      ownerId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ projects: Project[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }

    if (options?.ownerId) {
      conditions.push(`owner_id = $${paramIndex++}`);
      params.push(options.ownerId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.queryWithTenant<{ count: string }>(
      tenantSchema,
      `SELECT COUNT(*) as count FROM projects ${whereClause}`,
      params
    );

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await db.queryWithTenant<Project>(
      tenantSchema,
      `SELECT * FROM projects ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      projects: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Updates a project.
   */
  async updateProject(
    tenantSchema: string,
    projectId: string,
    data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'settings'>>,
    context: { tenantId: string; userId: string }
  ): Promise<Project> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.settings !== undefined) {
      updates.push(`settings = settings || $${paramIndex++}`);
      params.push(JSON.stringify(data.settings));
    }

    updates.push('updated_at = NOW()');
    params.push(projectId);

    const result = await db.queryWithTenant<Project>(
      tenantSchema,
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }

    await auditService.logDataAccess('UPDATE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'project',
      resourceId: projectId,
      changes: data,
    });

    return result.rows[0];
  }

  /**
   * Deletes a project and all associated tasks.
   */
  async deleteProject(
    tenantSchema: string,
    projectId: string,
    context: { tenantId: string; userId: string }
  ): Promise<void> {
    await db.queryWithTenant(
      tenantSchema,
      'DELETE FROM projects WHERE id = $1',
      [projectId]
    );

    await auditService.logDataAccess('DELETE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'project',
      resourceId: projectId,
    });

    logger.info('Project deleted', { tenantSchema, projectId });
  }

  // ============ Task Operations ============

  /**
   * Creates a new task.
   */
  async createTask(
    tenantSchema: string,
    data: {
      projectId: string;
      title: string;
      description?: string;
      priority?: string;
      assigneeId?: string;
      dueDate?: Date;
    },
    context: { tenantId: string; userId: string }
  ): Promise<Task> {
    const taskId = uuidv4();

    const result = await db.queryWithTenant<Task>(
      tenantSchema,
      `INSERT INTO tasks (id, project_id, title, description, priority, assignee_id, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        taskId,
        data.projectId,
        data.title,
        data.description || null,
        data.priority || 'medium',
        data.assigneeId || null,
        data.dueDate || null,
      ]
    );

    await auditService.logDataAccess('CREATE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'task',
      resourceId: taskId,
    });

    return result.rows[0];
  }

  /**
   * Gets a task by ID.
   */
  async getTask(tenantSchema: string, taskId: string): Promise<Task | null> {
    const result = await db.queryWithTenant<Task>(
      tenantSchema,
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );
    return result.rows[0] || null;
  }

  /**
   * Lists tasks with filtering.
   */
  async listTasks(
    tenantSchema: string,
    options?: {
      projectId?: string;
      status?: string;
      assigneeId?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ tasks: Task[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.projectId) {
      conditions.push(`project_id = $${paramIndex++}`);
      params.push(options.projectId);
    }
    if (options?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options?.assigneeId) {
      conditions.push(`assignee_id = $${paramIndex++}`);
      params.push(options.assigneeId);
    }
    if (options?.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(options.priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.queryWithTenant<{ count: string }>(
      tenantSchema,
      `SELECT COUNT(*) as count FROM tasks ${whereClause}`,
      params
    );

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await db.queryWithTenant<Task>(
      tenantSchema,
      `SELECT * FROM tasks ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      tasks: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Updates a task.
   */
  async updateTask(
    tenantSchema: string,
    taskId: string,
    data: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee_id' | 'due_date'>>,
    context: { tenantId: string; userId: string }
  ): Promise<Task> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(data.priority);
    }
    if (data.assignee_id !== undefined) {
      updates.push(`assignee_id = $${paramIndex++}`);
      params.push(data.assignee_id);
    }
    if (data.due_date !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      params.push(data.due_date);
    }

    updates.push('updated_at = NOW()');
    params.push(taskId);

    const result = await db.queryWithTenant<Task>(
      tenantSchema,
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }

    await auditService.logDataAccess('UPDATE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'task',
      resourceId: taskId,
      changes: data,
    });

    return result.rows[0];
  }

  /**
   * Deletes a task.
   */
  async deleteTask(
    tenantSchema: string,
    taskId: string,
    context: { tenantId: string; userId: string }
  ): Promise<void> {
    await db.queryWithTenant(
      tenantSchema,
      'DELETE FROM tasks WHERE id = $1',
      [taskId]
    );

    await auditService.logDataAccess('DELETE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'task',
      resourceId: taskId,
    });
  }

  // ============ Comment Operations ============

  /**
   * Creates a comment on a task.
   */
  async createComment(
    tenantSchema: string,
    data: {
      taskId: string;
      userId: string;
      content: string;
    },
    context: { tenantId: string; userId: string }
  ): Promise<Comment> {
    const commentId = uuidv4();

    const result = await db.queryWithTenant<Comment>(
      tenantSchema,
      `INSERT INTO comments (id, task_id, user_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [commentId, data.taskId, data.userId, data.content]
    );

    await auditService.logDataAccess('CREATE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'comment',
      resourceId: commentId,
    });

    return result.rows[0];
  }

  /**
   * Lists comments for a task.
   */
  async listComments(
    tenantSchema: string,
    taskId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ comments: Comment[]; total: number }> {
    const countResult = await db.queryWithTenant<{ count: string }>(
      tenantSchema,
      'SELECT COUNT(*) as count FROM comments WHERE task_id = $1',
      [taskId]
    );

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await db.queryWithTenant<Comment>(
      tenantSchema,
      `SELECT * FROM comments WHERE task_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [taskId, limit, offset]
    );

    return {
      comments: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Deletes a comment.
   */
  async deleteComment(
    tenantSchema: string,
    commentId: string,
    context: { tenantId: string; userId: string }
  ): Promise<void> {
    await db.queryWithTenant(
      tenantSchema,
      'DELETE FROM comments WHERE id = $1',
      [commentId]
    );

    await auditService.logDataAccess('DELETE', {
      tenantId: context.tenantId,
      userId: context.userId,
      resourceType: 'comment',
      resourceId: commentId,
    });
  }
}

export const projectService = new ProjectService();
export default projectService;
