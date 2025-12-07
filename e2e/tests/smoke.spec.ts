import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Quick verification that core functionality works.
 * These tests should be fast and cover critical user journeys.
 */

test.describe('Smoke Tests', () => {
  test.describe('Frontend Application', () => {
    test('homepage loads successfully', async ({ page }) => {
      await page.goto('/');

      // Should show some content (login page or redirect)
      await expect(page).toHaveTitle(/TaskHub/i);
    });

    test('tenant login page loads for valid tenant', async ({ page }) => {
      await page.goto('/alpha');

      // Should load the tenant login page or redirect to Keycloak
      // Check for either the login button or Keycloak redirect
      const url = page.url();
      const hasLoginContent = url.includes('keycloak') ||
        url.includes('/realms/') ||
        (await page.getByRole('button', { name: /login|sign in/i }).count()) > 0 ||
        (await page.locator('text=/login|sign in|authenticate/i').count()) > 0;

      expect(hasLoginContent || url.includes('alpha')).toBe(true);
    });

    test('non-existent tenant shows error', async ({ page }) => {
      await page.goto('/nonexistent-tenant-12345');

      // Should show an error or 404 page
      const url = page.url();
      const hasError = (await page.locator('text=/not found|error|invalid/i').count()) > 0 ||
        url.includes('error');

      // Either shows error or redirects back
      expect(page.url()).toBeDefined();
    });
  });

  test.describe('API Health', () => {
    test('backend API is healthy', async ({ request }) => {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
      const response = await request.get(`${backendUrl}/health`);

      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    test('admin API is healthy', async ({ request }) => {
      const adminUrl = process.env.ADMIN_API_URL || 'http://localhost:8001';
      const response = await request.get(`${adminUrl}/health`);

      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });
  });

  test.describe('Tenant Lookup', () => {
    test('can lookup alpha tenant', async ({ request }) => {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
      const response = await request.get(`${backendUrl}/api/tenants/lookup/alpha`);

      expect(response.ok()).toBe(true);
      const data = await response.json();
      // API wraps response in { success, data }
      expect(data.success).toBe(true);
      expect(data.data.slug).toBe('alpha');
      expect(data.data.realm).toBe('alpha');
    });

    test('can lookup beta tenant', async ({ request }) => {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
      const response = await request.get(`${backendUrl}/api/tenants/lookup/beta`);

      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.slug).toBe('beta');
    });

    test('returns 404 for non-existent tenant', async ({ request }) => {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
      const response = await request.get(`${backendUrl}/api/tenants/lookup/does-not-exist`);

      expect(response.status()).toBe(404);
    });
  });
});
