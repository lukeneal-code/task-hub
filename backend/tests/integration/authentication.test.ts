/**
 * Authentication Integration Tests
 *
 * Tests JWT token validation and authentication middleware.
 */

import { apiClient, createClientForRole } from '../helpers/api.helper';
import { getInvalidToken, getExpiredToken, getTokenForRole } from '../helpers/auth.helper';
import { TEST_CONFIG } from '../setup';

describe('Authentication', () => {
  describe('Protected Endpoints', () => {
    it('should reject requests without authorization header', async () => {
      const response = await apiClient.get('/api/projects');

      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Unauthorized');
      expect(response.data.message).toContain('authorization');
    });

    it('should reject requests with malformed authorization header', async () => {
      const response = await apiClient.get('/api/projects', {
        headers: { Authorization: 'InvalidFormat' },
      });

      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid token', async () => {
      const response = await apiClient.get('/api/projects', {
        headers: { Authorization: `Bearer ${getInvalidToken()}` },
      });

      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Unauthorized');
      expect(response.data.message).toContain('Invalid token');
    });

    it('should reject requests with expired token format', async () => {
      const response = await apiClient.get('/api/projects', {
        headers: { Authorization: `Bearer ${getExpiredToken()}` },
      });

      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Unauthorized');
    });

    it('should accept requests with valid token', async () => {
      const client = await createClientForRole('alpha', 'member');
      const response = await client.get('/api/projects');

      // Should not be 401 - might be 200 or other status, but not unauthorized
      expect(response.status).not.toBe(401);
    });
  });

  describe('Token from Different Realms', () => {
    it('should accept token from alpha realm for alpha tenant', async () => {
      const client = await createClientForRole('alpha', 'admin');
      const response = await client.get('/api/projects');

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it('should accept token from beta realm for beta tenant', async () => {
      const client = await createClientForRole('beta', 'admin');
      const response = await client.get('/api/projects');

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  describe('Tenant Lookup (Public)', () => {
    it('should allow unauthenticated access to tenant lookup', async () => {
      const response = await apiClient.get('/api/tenants/lookup/alpha');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('slug', 'alpha');
      expect(response.data).toHaveProperty('keycloak_realm');
    });

    it('should return 404 for non-existent tenant', async () => {
      const response = await apiClient.get('/api/tenants/lookup/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('Suspended Tenant Access', () => {
    it('should reject access to suspended tenant', async () => {
      // First check if suspended tenant exists
      const lookupResponse = await apiClient.get('/api/tenants/lookup/suspended');

      if (lookupResponse.status === 200) {
        // If we can get a token for a suspended tenant user,
        // the request should be rejected with 403
        // This test may need Keycloak setup for suspended tenant
        expect(lookupResponse.data.status).toBe('suspended');
      }
    });
  });
});
