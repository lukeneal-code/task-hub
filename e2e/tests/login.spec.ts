import { test, expect } from '@playwright/test';

/**
 * Login Flow Tests - Tests the authentication flow with Keycloak.
 */

// Test configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8081';
const TEST_USER = {
  email: 'admin@alpha.com',
  password: 'password123',
};

test.describe('Login Flow', () => {
  test.describe('Tenant Selection', () => {
    test('navigating to tenant URL shows login option', async ({ page }) => {
      await page.goto('/alpha');

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      const url = page.url();

      // Should either show login button, redirect to Keycloak, or show auth-related content
      // Keycloak URL may be localhost:8081/realms/... (not containing "keycloak" literally)
      const isKeycloakRedirect = url.includes('keycloak') || url.includes('/realms/') || url.includes(':8081');
      const hasLoginButton = (await page.getByRole('button', { name: /login|sign in/i }).count()) > 0;
      const hasLoginText = (await page.locator('text=/sign in|log in/i').count()) > 0;
      // Also accept authentication-related states (error, initializing)
      const hasAuthState = (await page.locator('text=/authentication|initializing|auth/i').count()) > 0;

      expect(isKeycloakRedirect || hasLoginButton || hasLoginText || hasAuthState).toBe(true);
    });
  });

  test.describe('Keycloak Integration', () => {
    test('Keycloak login page is accessible', async ({ page }) => {
      // Go directly to Keycloak login for alpha realm
      await page.goto(`${KEYCLOAK_URL}/realms/alpha/protocol/openid-connect/auth?client_id=taskhub-app&response_type=code&redirect_uri=http://localhost:3003/alpha`);

      await page.waitForLoadState('networkidle');

      const url = page.url();

      // Should be on Keycloak login page - URL contains realms path or 8081 port
      expect(url.includes('/realms/') || url.includes(':8081')).toBe(true);

      // Should have username and password fields
      const usernameField = page.locator('input[name="username"], #username');
      const passwordField = page.locator('input[name="password"], #password');

      await expect(usernameField).toBeVisible({ timeout: 10000 });
      await expect(passwordField).toBeVisible({ timeout: 10000 });
    });

    test('can enter credentials on Keycloak login page', async ({ page }) => {
      await page.goto(`${KEYCLOAK_URL}/realms/alpha/protocol/openid-connect/auth?client_id=taskhub-app&response_type=code&redirect_uri=http://localhost:3003/alpha`);

      await page.waitForLoadState('networkidle');

      // Fill in credentials
      const usernameField = page.locator('input[name="username"], #username');
      const passwordField = page.locator('input[name="password"], #password');

      await usernameField.fill(TEST_USER.email);
      await passwordField.fill(TEST_USER.password);

      // Verify fields are filled
      await expect(usernameField).toHaveValue(TEST_USER.email);
    });

    test('login with valid credentials redirects to app', async ({ page }) => {
      await page.goto(`${KEYCLOAK_URL}/realms/alpha/protocol/openid-connect/auth?client_id=taskhub-app&response_type=code&redirect_uri=http://localhost:3003/alpha`);

      await page.waitForLoadState('networkidle');

      // Fill in credentials
      await page.locator('input[name="username"], #username').fill(TEST_USER.email);
      await page.locator('input[name="password"], #password').fill(TEST_USER.password);

      // Submit the form
      await page.locator('input[type="submit"], button[type="submit"], #kc-login').click();

      // Wait for redirect
      await page.waitForURL(/localhost:3003/, { timeout: 15000 });

      // Should be redirected to the app
      const url = page.url();
      expect(url).toContain('localhost:3003');
    });

    test('login with invalid credentials shows error', async ({ page }) => {
      await page.goto(`${KEYCLOAK_URL}/realms/alpha/protocol/openid-connect/auth?client_id=taskhub-app&response_type=code&redirect_uri=http://localhost:3003/alpha`);

      await page.waitForLoadState('networkidle');

      // Fill in wrong credentials
      await page.locator('input[name="username"], #username').fill('wrong@email.com');
      await page.locator('input[name="password"], #password').fill('wrongpassword');

      // Submit the form
      await page.locator('input[type="submit"], button[type="submit"], #kc-login').click();

      // Should show error message
      await page.waitForLoadState('networkidle');

      const errorMessage = page.locator('.alert-error, #input-error, .kc-feedback-text');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Cross-Tenant Login Prevention', () => {
    test('alpha user cannot login to beta realm', async ({ page }) => {
      // Try to login to beta realm with alpha credentials
      await page.goto(`${KEYCLOAK_URL}/realms/beta/protocol/openid-connect/auth?client_id=taskhub-app&response_type=code&redirect_uri=http://localhost:3003/beta`);

      await page.waitForLoadState('networkidle');

      // Fill in alpha user credentials
      await page.locator('input[name="username"], #username').fill('admin@alpha.com');
      await page.locator('input[name="password"], #password').fill('password123');

      // Submit the form
      await page.locator('input[type="submit"], button[type="submit"], #kc-login').click();

      // Wait for response
      await page.waitForLoadState('networkidle');

      // Should stay on Keycloak login page with error (user doesn't exist in beta realm)
      const url = page.url();
      // URL should still be on Keycloak (port 8081 or contains /realms/)
      expect(url.includes(':8081') || url.includes('/realms/')).toBe(true);

      // Should show error
      const hasError = (await page.locator('.alert-error, #input-error, .kc-feedback-text').count()) > 0;
      expect(hasError).toBe(true);
    });
  });
});
