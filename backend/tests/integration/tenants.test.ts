/**
 * Tenant Integration Tests
 *
 * Tests tenant lookup and tenant-related functionality.
 */

import { apiClient } from '../helpers/api.helper';
import { TEST_CONFIG } from '../setup';

describe('Tenants', () => {
  describe('GET /api/tenants/lookup/:slug', () => {
    it('should return tenant info for valid slug', async () => {
      const response = await apiClient.get('/api/tenants/lookup/alpha');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: TEST_CONFIG.tenants.alpha.id,
        slug: 'alpha',
        keycloak_realm: 'alpha',
        status: 'active',
      });
      expect(response.data).toHaveProperty('name');
    });

    it('should return 404 for non-existent tenant', async () => {
      const response = await apiClient.get('/api/tenants/lookup/nonexistent');

      expect(response.status).toBe(404);
      expect(response.data.error).toBe('Not Found');
    });

    it('should return tenant info for beta tenant', async () => {
      const response = await apiClient.get('/api/tenants/lookup/beta');

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: TEST_CONFIG.tenants.beta.id,
        slug: 'beta',
        keycloak_realm: 'beta',
        status: 'active',
      });
    });

    it('should return suspended status for suspended tenant', async () => {
      const response = await apiClient.get('/api/tenants/lookup/suspended');

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('suspended');
    });

    it('should handle slugs case-insensitively or exactly', async () => {
      // Most implementations are case-sensitive for slugs
      const response = await apiClient.get('/api/tenants/lookup/ALPHA');

      // Either 404 (case-sensitive) or 200 (case-insensitive) is acceptable
      expect([200, 404]).toContain(response.status);
    });

    it('should not expose sensitive tenant data', async () => {
      const response = await apiClient.get('/api/tenants/lookup/alpha');

      expect(response.status).toBe(200);
      // Should not include internal schema name or settings
      expect(response.data).not.toHaveProperty('schema_name');
      // Settings might be exposed partially, that's acceptable
    });
  });

  describe('Tenant Data Isolation', () => {
    it('should return distinct tenant IDs for different tenants', async () => {
      const alphaResponse = await apiClient.get('/api/tenants/lookup/alpha');
      const betaResponse = await apiClient.get('/api/tenants/lookup/beta');

      expect(alphaResponse.status).toBe(200);
      expect(betaResponse.status).toBe(200);

      expect(alphaResponse.data.id).not.toBe(betaResponse.data.id);
      expect(alphaResponse.data.keycloak_realm).not.toBe(
        betaResponse.data.keycloak_realm
      );
    });
  });
});
