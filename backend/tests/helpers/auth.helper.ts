/**
 * Authentication Helper for Integration Tests
 *
 * Provides functions to obtain JWT tokens from Keycloak for test users.
 */

import axios from 'axios';
import { TEST_CONFIG } from '../setup';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  realm: string;
  role: string;
}

// Token cache to avoid repeated Keycloak requests
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Gets an access token for a test user from Keycloak.
 * Uses caching to avoid redundant token requests.
 */
export async function getAccessToken(user: TestUser): Promise<string> {
  const cacheKey = `${user.realm}:${user.email}`;
  const cached = tokenCache.get(cacheKey);

  // Return cached token if still valid (with 30 second buffer)
  if (cached && cached.expiresAt > Date.now() + 30000) {
    return cached.token;
  }

  const tokenUrl = `${TEST_CONFIG.keycloakUrl}/realms/${user.realm}/protocol/openid-connect/token`;

  try {
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'password',
        client_id: TEST_CONFIG.clientId,
        username: user.email,
        password: user.password,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const token = response.data.access_token;
    const expiresIn = response.data.expires_in || 300; // Default 5 minutes

    // Cache the token
    tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return token;
  } catch (error: any) {
    const message = error.response?.data?.error_description || error.message;
    throw new Error(`Failed to get access token for ${user.email}: ${message}`);
  }
}

/**
 * Gets an access token for a specific tenant and role.
 */
export async function getTokenForRole(
  tenant: 'alpha' | 'beta',
  role: 'admin' | 'manager' | 'member'
): Promise<string> {
  const user = TEST_CONFIG.users[tenant][role];
  return getAccessToken(user);
}

/**
 * Creates an Authorization header value for a test user.
 */
export async function getAuthHeader(user: TestUser): Promise<string> {
  const token = await getAccessToken(user);
  return `Bearer ${token}`;
}

/**
 * Clears the token cache. Useful between test runs.
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/**
 * Generates an invalid/expired token for negative testing.
 */
export function getInvalidToken(): string {
  // This is a malformed JWT that will fail verification
  return 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.invalid_signature';
}

/**
 * Generates an expired token structure for testing.
 * Note: This won't be valid since it's not signed by Keycloak.
 */
export function getExpiredToken(): string {
  // A token that claims to be expired (exp in the past)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'test-user',
      iss: `${TEST_CONFIG.keycloakUrl}/realms/alpha`,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    })
  ).toString('base64url');
  const signature = 'fake_signature';

  return `${header}.${payload}.${signature}`;
}
