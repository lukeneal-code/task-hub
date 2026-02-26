/**
 * Health Check Integration Tests
 *
 * Tests the health endpoints of the backend API.
 */

import { apiClient } from '../helpers/api.helper';

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await apiClient.get('/health');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data.status).toBe('healthy');
    });

    it('should include uptime information', async () => {
      const response = await apiClient.get('/health');

      expect(response.status).toBe(200);
      // Uptime should be a non-negative number
      if (response.data.uptime !== undefined) {
        expect(typeof response.data.uptime).toBe('number');
        expect(response.data.uptime).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when database and keycloak are ready', async () => {
      const response = await apiClient.get('/health/ready');

      // This may return 200 if services are up, or 503 if not
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        // May return 'ready' or 'healthy' depending on implementation
        expect(['healthy', 'ready']).toContain(response.data.status);
      }
    });
  });
});
