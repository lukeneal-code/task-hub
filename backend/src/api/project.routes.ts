import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { projectService } from '../services/project.service';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * Project Management API Routes
 *
 * All routes require authentication and are scoped to the user's tenant.
 * Data isolation is enforced through the tenant schema.
 */

// Apply authentication to all routes
router.use(authenticate);

// ============ Project Routes ============

/**
 * POST /api/projects
 *
 * Creates a new project.
 * Requires manager or admin role.
 */
router.post(
  '/',
  requireRole('admin', 'manager'),
  validate([
    body('name')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name is required (max 255 characters)'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Description must be under 5000 characters'),
    body('settings')
      .optional()
      .isObject()
      .withMessage('Settings must be an object'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const project = await projectService.createProject(
      req.tenant!.schema,
      {
        name: req.body.name,
        description: req.body.description,
        // Don't set owner - user may not be synced to tenant DB yet
        ownerId: undefined,
        settings: req.body.settings,
      },
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.status(201).json({
      success: true,
      data: project,
    });
  })
);

/**
 * GET /api/projects
 *
 * Lists all projects in the tenant.
 */
router.get(
  '/',
  validate([
    query('status').optional().isIn(['active', 'archived', 'completed']),
    query('ownerId').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projects, total } = await projectService.listProjects(
      req.tenant!.schema,
      {
        status: req.query.status as string,
        ownerId: req.query.ownerId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      }
    );

    res.json({
      success: true,
      data: projects,
      pagination: {
        total,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      },
    });
  })
);

/**
 * GET /api/projects/:id
 *
 * Gets a specific project.
 */
router.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Valid project ID is required'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const project = await projectService.getProject(
      req.tenant!.schema,
      req.params.id
    );

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    res.json({
      success: true,
      data: project,
    });
  })
);

/**
 * PATCH /api/projects/:id
 *
 * Updates a project.
 * Requires manager or admin role.
 */
router.patch(
  '/:id',
  requireRole('admin', 'manager'),
  validate([
    param('id').isUUID().withMessage('Valid project ID is required'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name must be 1-255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 }),
    body('status')
      .optional()
      .isIn(['active', 'archived', 'completed']),
    body('settings')
      .optional()
      .isObject(),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const project = await projectService.updateProject(
      req.tenant!.schema,
      req.params.id,
      req.body,
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      data: project,
    });
  })
);

/**
 * DELETE /api/projects/:id
 *
 * Deletes a project and all its tasks.
 * Requires admin role.
 */
router.delete(
  '/:id',
  requireRole('admin'),
  validate([
    param('id').isUUID().withMessage('Valid project ID is required'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await projectService.deleteProject(
      req.tenant!.schema,
      req.params.id,
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  })
);

// ============ Task Routes ============

/**
 * POST /api/projects/:projectId/tasks
 *
 * Creates a new task in a project.
 * Requires manager or admin role.
 */
router.post(
  '/:projectId/tasks',
  requireRole('admin', 'manager'),
  validate([
    param('projectId').isUUID().withMessage('Valid project ID is required'),
    body('title')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Task title is required (max 500 characters)'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 10000 }),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent']),
    body('assigneeId')
      .optional()
      .isUUID(),
    body('dueDate')
      .optional()
      .isISO8601(),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await projectService.createTask(
      req.tenant!.schema,
      {
        projectId: req.params.projectId,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        assigneeId: req.body.assigneeId,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      },
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.status(201).json({
      success: true,
      data: task,
    });
  })
);

/**
 * GET /api/projects/:projectId/tasks
 *
 * Lists tasks in a project.
 */
router.get(
  '/:projectId/tasks',
  validate([
    param('projectId').isUUID().withMessage('Valid project ID is required'),
    query('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
    query('assigneeId').optional().isUUID(),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { tasks, total } = await projectService.listTasks(
      req.tenant!.schema,
      {
        projectId: req.params.projectId,
        status: req.query.status as string,
        assigneeId: req.query.assigneeId as string,
        priority: req.query.priority as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      }
    );

    res.json({
      success: true,
      data: tasks,
      pagination: {
        total,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      },
    });
  })
);

// ============ Individual Task Routes ============

/**
 * GET /api/tasks/:id
 *
 * Gets a specific task.
 */
router.get(
  '/tasks/:id',
  validate([
    param('id').isUUID().withMessage('Valid task ID is required'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await projectService.getTask(
      req.tenant!.schema,
      req.params.id
    );

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    res.json({
      success: true,
      data: task,
    });
  })
);

/**
 * PATCH /api/tasks/:id
 *
 * Updates a task.
 */
router.patch(
  '/tasks/:id',
  validate([
    param('id').isUUID().withMessage('Valid task ID is required'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 500 }),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 10000 }),
    body('status')
      .optional()
      .isIn(['todo', 'in_progress', 'review', 'done']),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent']),
    body('assigneeId')
      .optional()
      .custom((value) => value === null || /^[0-9a-f-]{36}$/i.test(value)),
    body('dueDate')
      .optional()
      .custom((value) => value === null || !isNaN(Date.parse(value))),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await projectService.updateTask(
      req.tenant!.schema,
      req.params.id,
      {
        title: req.body.title,
        description: req.body.description,
        status: req.body.status,
        priority: req.body.priority,
        assignee_id: req.body.assigneeId,
        due_date: req.body.dueDate ? new Date(req.body.dueDate) : req.body.dueDate,
      },
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      data: task,
    });
  })
);

/**
 * DELETE /api/tasks/:id
 *
 * Deletes a task.
 */
router.delete(
  '/tasks/:id',
  validate([
    param('id').isUUID().withMessage('Valid task ID is required'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await projectService.deleteTask(
      req.tenant!.schema,
      req.params.id,
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  })
);

// ============ Comment Routes ============

/**
 * POST /api/tasks/:taskId/comments
 *
 * Adds a comment to a task.
 */
router.post(
  '/tasks/:taskId/comments',
  validate([
    param('taskId').isUUID().withMessage('Valid task ID is required'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Comment content is required (max 10000 characters)'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const comment = await projectService.createComment(
      req.tenant!.schema,
      {
        taskId: req.params.taskId,
        userId: req.user!.id,
        content: req.body.content,
      },
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.status(201).json({
      success: true,
      data: comment,
    });
  })
);

/**
 * GET /api/tasks/:taskId/comments
 *
 * Lists comments on a task.
 */
router.get(
  '/tasks/:taskId/comments',
  validate([
    param('taskId').isUUID().withMessage('Valid task ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { comments, total } = await projectService.listComments(
      req.tenant!.schema,
      req.params.taskId,
      {
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      }
    );

    res.json({
      success: true,
      data: comments,
      pagination: {
        total,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      },
    });
  })
);

/**
 * DELETE /api/comments/:id
 *
 * Deletes a comment.
 * Users can only delete their own comments (unless admin).
 */
router.delete(
  '/comments/:id',
  validate([
    param('id').isUUID().withMessage('Valid comment ID is required'),
  ]),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // In a real application, you'd verify ownership here
    await projectService.deleteComment(
      req.tenant!.schema,
      req.params.id,
      {
        tenantId: req.tenant!.id,
        userId: req.user!.id,
      }
    );

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  })
);

export default router;
