'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import Keycloak from 'keycloak-js';
import { api } from '@/services/api';
import type { User, Tenant } from '@/types';

/**
 * Authentication Context
 *
 * Provides Keycloak-based authentication with multi-tenant support.
 * Handles:
 * - Tenant lookup and Keycloak realm selection
 * - Login/logout flows
 * - Token management and refresh
 * - User and role extraction from JWT
 */

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  tenantSlug: string;
}

export function AuthProvider({ children, tenantSlug }: AuthProviderProps) {
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Keycloak with tenant-specific realm
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    let isMounted = true;

    const initAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Step 1: Look up tenant to get Keycloak realm
        const tenantData = await api.lookupTenant(tenantSlug);

        if (!isMounted) return;

        if (tenantData.status !== 'active') {
          throw new Error('This organization is not currently active');
        }

        setTenant(tenantData);

        // Step 2: Initialize Keycloak with tenant's realm
        const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';

        const kc = new Keycloak({
          url: keycloakUrl,
          realm: tenantData.realm,
          clientId: 'taskhub-app',
        });

        // Step 3: Initialize Keycloak
        // This will automatically handle the OAuth callback if present in URL
        const authenticated = await kc.init({
          pkceMethod: 'S256',
          checkLoginIframe: false,
          onLoad: 'check-sso',
          silentCheckSsoFallback: false,
        });

        if (!isMounted) return;

        setKeycloak(kc);
        setIsAuthenticated(authenticated);

        if (authenticated && kc.tokenParsed) {
          // Extract user info from token
          const userData: User = {
            id: kc.tokenParsed.sub || '',
            email: kc.tokenParsed.email || '',
            name: kc.tokenParsed.name || kc.tokenParsed.preferred_username || '',
            roles: extractRoles(kc.tokenParsed),
            realm: tenantData.realm,
          };
          setUser(userData);

          // Set up token getter for API calls
          api.setTokenGetter(() => kc.token || null);

          // Clean up URL after successful auth (remove code, state params)
          if (window.location.search.includes('code=')) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }

        // Set up token refresh
        refreshInterval = setInterval(async () => {
          if (kc.authenticated) {
            try {
              const refreshed = await kc.updateToken(30);
              if (refreshed) {
                api.setTokenGetter(() => kc.token || null);
              }
            } catch {
              console.warn('Failed to refresh token');
            }
          }
        }, 10000);

      } catch (err: any) {
        if (isMounted) {
          console.error('Auth initialization failed:', err);
          setError(err.message || 'Authentication failed');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [tenantSlug]);

  // Listen for token expiration events from API
  useEffect(() => {
    const handleExpired = () => {
      setIsAuthenticated(false);
      setUser(null);
      keycloak?.logout();
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [keycloak]);

  // Login function - redirects to Keycloak
  const login = useCallback(() => {
    if (keycloak) {
      keycloak.login({
        redirectUri: window.location.href,
      });
    }
  }, [keycloak]);

  // Logout function
  const logout = useCallback(() => {
    if (keycloak) {
      keycloak.logout({
        redirectUri: window.location.origin + '/' + tenantSlug,
      });
    }
  }, [keycloak, tenantSlug]);

  // Check if user has a specific role
  const hasRole = useCallback(
    (role: string): boolean => {
      return user?.roles.includes(role) || false;
    },
    [user]
  );

  // Get current access token
  const getToken = useCallback((): string | null => {
    return keycloak?.token || null;
  }, [keycloak]);

  const value: AuthContextType = {
    user,
    tenant,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Extracts roles from Keycloak token.
 */
function extractRoles(tokenParsed: any): string[] {
  const roles: string[] = [];

  // Realm roles
  if (tokenParsed.realm_access?.roles) {
    roles.push(...tokenParsed.realm_access.roles);
  }

  // Client roles
  if (tokenParsed.resource_access) {
    for (const [client, access] of Object.entries(tokenParsed.resource_access)) {
      const clientAccess = access as { roles?: string[] };
      if (clientAccess.roles) {
        roles.push(...clientAccess.roles.map((r) => `${client}:${r}`));
      }
    }
  }

  return [...new Set(roles)]; // Remove duplicates
}

export default AuthContext;
