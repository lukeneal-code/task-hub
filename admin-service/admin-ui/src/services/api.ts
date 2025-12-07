import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  schema_name: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  user_count: number | null;
}

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  roles: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_password: string;
  settings?: Record<string, unknown>;
}

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  roles: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Tenant API
export const tenantApi = {
  list: async (params?: { status?: string; limit?: number; offset?: number }) => {
    const response = await api.get<PaginatedResponse<Tenant>>('/api/tenants', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get<Tenant>(`/api/tenants/${id}`);
    return response.data;
  },

  create: async (data: CreateTenantRequest) => {
    const response = await api.post<Tenant>('/api/tenants', data);
    return response.data;
  },

  suspend: async (id: string, reason: string) => {
    await api.post(`/api/tenants/${id}/suspend`, null, { params: { reason } });
  },

  reactivate: async (id: string) => {
    await api.post(`/api/tenants/${id}/reactivate`);
  },

  delete: async (id: string) => {
    await api.delete(`/api/tenants/${id}`);
  },
};

// User API
export const userApi = {
  list: async (tenantId: string, params?: { limit?: number; offset?: number }) => {
    const response = await api.get<PaginatedResponse<User>>(`/api/tenants/${tenantId}/users`, { params });
    return response.data;
  },

  get: async (tenantId: string, userId: string) => {
    const response = await api.get<User>(`/api/tenants/${tenantId}/users/${userId}`);
    return response.data;
  },

  create: async (tenantId: string, data: CreateUserRequest) => {
    const response = await api.post<User>(`/api/tenants/${tenantId}/users`, data);
    return response.data;
  },

  assignRoles: async (tenantId: string, userId: string, roles: string[]) => {
    const response = await api.post<User>(`/api/tenants/${tenantId}/users/${userId}/roles`, { roles });
    return response.data;
  },

  delete: async (tenantId: string, userId: string) => {
    await api.delete(`/api/tenants/${tenantId}/users/${userId}`);
  },
};

export default api;
