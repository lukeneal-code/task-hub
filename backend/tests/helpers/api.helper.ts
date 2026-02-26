/**
 * API Helper for Integration Tests
 *
 * Provides a configured axios client and utility functions for API testing.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { TEST_CONFIG } from '../setup';
import { getTokenForRole, TestUser, getAccessToken } from './auth.helper';

/**
 * Creates an axios client configured for the test API.
 */
export function createApiClient(): AxiosInstance {
  return axios.create({
    baseURL: TEST_CONFIG.apiUrl,
    timeout: 10000,
    validateStatus: () => true, // Don't throw on non-2xx responses
  });
}

/**
 * Creates an authenticated axios client for a test user.
 */
export async function createAuthenticatedClient(user: TestUser): Promise<AxiosInstance> {
  const token = await getAccessToken(user);

  return axios.create({
    baseURL: TEST_CONFIG.apiUrl,
    timeout: 10000,
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Creates an authenticated axios client for a specific tenant/role.
 */
export async function createClientForRole(
  tenant: 'alpha' | 'beta',
  role: 'admin' | 'manager' | 'member'
): Promise<AxiosInstance> {
  const token = await getTokenForRole(tenant, role);

  return axios.create({
    baseURL: TEST_CONFIG.apiUrl,
    timeout: 10000,
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Default unauthenticated client
export const apiClient = createApiClient();

/**
 * Response type helpers
 */
export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Health check response type
 */
export interface HealthResponse {
  status: string;
  version?: string;
  uptime?: number;
}

/**
 * Error response type
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
}

/**
 * Paginated response type
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Project type
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner_id?: string;
  settings?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Task type
 */
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee_id?: string;
  due_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tenant lookup response type
 */
export interface TenantLookup {
  id: string;
  name: string;
  slug: string;
  keycloak_realm: string;
  status: string;
}

/**
 * Waits for the API to be ready.
 * Useful at the start of test runs.
 */
export async function waitForApi(maxAttempts = 30, delayMs = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await apiClient.get('/health');
      if (response.status === 200) {
        console.log(`API ready after ${i + 1} attempts`);
        return true;
      }
    } catch {
      // API not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`API not ready after ${maxAttempts} attempts`);
}

/**
 * Extracts error message from API response.
 */
export function getErrorMessage(response: AxiosResponse): string {
  const data = response.data as ErrorResponse;
  return data.message || data.error || 'Unknown error';
}
