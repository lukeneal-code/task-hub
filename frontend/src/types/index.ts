/**
 * TaskHub Type Definitions
 *
 * Shared types for the frontend application.
 */

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  realm: string;
}

// Identity Provider types
export interface IdentityProvider {
  alias: string;
  displayName: string;
}

// Tenant types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  realm: string;
  status: 'active' | 'suspended' | 'pending';
  settings?: {
    theme?: string;
    logo?: string;
  };
  identityProviders?: IdentityProvider[];
}

// Project types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'completed';
  owner_id: string | null;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Task types
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Comment types
export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
