import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Project,
  Task,
  Comment,
  Tenant,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

/**
 * API Service
 *
 * Handles all HTTP communication with the backend API.
 * Includes automatic JWT token injection from Keycloak.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiService {
  private client: AxiosInstance;
  private tokenGetter: (() => string | null) | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.tokenGetter) {
        const token = this.tokenGetter();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - trigger re-authentication
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Sets the function to get the current access token.
   * Called by the AuthContext when Keycloak initializes.
   */
  setTokenGetter(getter: () => string | null): void {
    this.tokenGetter = getter;
  }

  // ============ Tenant API ============

  /**
   * Looks up a tenant by slug.
   * Used to determine which Keycloak realm to authenticate against.
   */
  async lookupTenant(slug: string): Promise<Tenant> {
    const response = await this.client.get<ApiResponse<Tenant>>(
      `/api/tenants/lookup/${slug}`
    );
    return response.data.data;
  }

  /**
   * Creates a new tenant.
   */
  async createTenant(data: {
    name: string;
    slug: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
    adminPassword: string;
    settings?: Record<string, any>;
  }): Promise<Tenant> {
    const response = await this.client.post<ApiResponse<Tenant>>(
      '/api/tenants',
      data
    );
    return response.data.data;
  }

  // ============ Project API ============

  /**
   * Lists all projects.
   */
  async listProjects(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Project>> {
    const response = await this.client.get<PaginatedResponse<Project>>(
      '/api/projects',
      { params }
    );
    return response.data;
  }

  /**
   * Gets a single project.
   */
  async getProject(id: string): Promise<Project> {
    const response = await this.client.get<ApiResponse<Project>>(
      `/api/projects/${id}`
    );
    return response.data.data;
  }

  /**
   * Creates a new project.
   */
  async createProject(data: {
    name: string;
    description?: string;
    settings?: Record<string, any>;
  }): Promise<Project> {
    const response = await this.client.post<ApiResponse<Project>>(
      '/api/projects',
      data
    );
    return response.data.data;
  }

  /**
   * Updates a project.
   */
  async updateProject(
    id: string,
    data: Partial<Pick<Project, 'name' | 'description' | 'status' | 'settings'>>
  ): Promise<Project> {
    const response = await this.client.patch<ApiResponse<Project>>(
      `/api/projects/${id}`,
      data
    );
    return response.data.data;
  }

  /**
   * Deletes a project.
   */
  async deleteProject(id: string): Promise<void> {
    await this.client.delete(`/api/projects/${id}`);
  }

  // ============ Task API ============

  /**
   * Lists tasks in a project.
   */
  async listTasks(
    projectId: string,
    params?: {
      status?: string;
      assigneeId?: string;
      priority?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResponse<Task>> {
    const response = await this.client.get<PaginatedResponse<Task>>(
      `/api/projects/${projectId}/tasks`,
      { params }
    );
    return response.data;
  }

  /**
   * Gets a single task.
   */
  async getTask(id: string): Promise<Task> {
    const response = await this.client.get<ApiResponse<Task>>(
      `/api/tasks/${id}`
    );
    return response.data.data;
  }

  /**
   * Creates a new task.
   */
  async createTask(
    projectId: string,
    data: {
      title: string;
      description?: string;
      priority?: string;
      assigneeId?: string;
      dueDate?: string;
    }
  ): Promise<Task> {
    const response = await this.client.post<ApiResponse<Task>>(
      `/api/projects/${projectId}/tasks`,
      data
    );
    return response.data.data;
  }

  /**
   * Updates a task.
   */
  async updateTask(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      assigneeId: string | null;
      dueDate: string | null;
    }>
  ): Promise<Task> {
    const response = await this.client.patch<ApiResponse<Task>>(
      `/api/tasks/${id}`,
      data
    );
    return response.data.data;
  }

  /**
   * Deletes a task.
   */
  async deleteTask(id: string): Promise<void> {
    await this.client.delete(`/api/tasks/${id}`);
  }

  // ============ Comment API ============

  /**
   * Lists comments on a task.
   */
  async listComments(
    taskId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<Comment>> {
    const response = await this.client.get<PaginatedResponse<Comment>>(
      `/api/tasks/${taskId}/comments`,
      { params }
    );
    return response.data;
  }

  /**
   * Creates a comment on a task.
   */
  async createComment(taskId: string, content: string): Promise<Comment> {
    const response = await this.client.post<ApiResponse<Comment>>(
      `/api/tasks/${taskId}/comments`,
      { content }
    );
    return response.data.data;
  }

  /**
   * Deletes a comment.
   */
  async deleteComment(id: string): Promise<void> {
    await this.client.delete(`/api/comments/${id}`);
  }
}

export const api = new ApiService();
export default api;
