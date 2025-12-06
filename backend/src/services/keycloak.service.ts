import axios, { AxiosInstance } from 'axios';
import config from '../config';
import logger from '../utils/logger';

/**
 * Keycloak Admin Service
 *
 * Handles all interactions with the Keycloak Admin API for:
 * - Realm management (multi-tenant provisioning)
 * - User management within realms
 * - Client and role configuration
 * - Identity provider setup
 */
class KeycloakService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.client = axios.create({
      baseURL: config.keycloak.adminUrl,
      timeout: 10000,
    });
  }

  /**
   * Obtains an admin access token from Keycloak master realm.
   * Implements token caching to reduce authentication overhead.
   */
  private async getAdminToken(): Promise<string> {
    // Return cached token if still valid (with 30s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 30000) {
      return this.accessToken;
    }

    try {
      const response = await this.client.post(
        '/realms/master/protocol/openid-connect/token',
        new URLSearchParams({
          grant_type: 'password',
          client_id: 'admin-cli',
          username: config.keycloak.adminUser,
          password: config.keycloak.adminPassword,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      logger.debug('Keycloak admin token obtained');
      return this.accessToken!;
    } catch (error) {
      logger.error('Failed to obtain Keycloak admin token', { error });
      throw new Error('Failed to authenticate with Keycloak');
    }
  }

  /**
   * Makes an authenticated request to the Keycloak Admin API.
   */
  private async adminRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    data?: any
  ): Promise<T> {
    const token = await this.getAdminToken();

    try {
      const response = await this.client.request<T>({
        method,
        url: `/admin/realms${path}`,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.errorMessage || error.message;
      logger.error('Keycloak admin request failed', { path, error: message });
      throw new Error(`Keycloak API error: ${message}`);
    }
  }

  /**
   * Creates a new Keycloak realm for a tenant.
   * Each tenant gets their own isolated realm for complete IAM separation.
   */
  async createRealm(realmName: string, displayName: string): Promise<void> {
    logger.info('Creating Keycloak realm', { realmName, displayName });

    const realmConfig = {
      realm: realmName,
      displayName: displayName,
      enabled: true,
      registrationAllowed: false,
      resetPasswordAllowed: true,
      editUsernameAllowed: false,
      bruteForceProtected: true,
      permanentLockout: false,
      maxFailureWaitSeconds: 900,
      minimumQuickLoginWaitSeconds: 60,
      waitIncrementSeconds: 60,
      quickLoginCheckMilliSeconds: 1000,
      maxDeltaTimeSeconds: 43200,
      failureFactor: 5,
      // Session settings
      ssoSessionIdleTimeout: 1800,
      ssoSessionMaxLifespan: 36000,
      accessTokenLifespan: 300,
      accessTokenLifespanForImplicitFlow: 900,
      // Password policy for SOC2 compliance
      passwordPolicy: 'length(8) and upperCase(1) and lowerCase(1) and digits(1) and specialChars(1)',
      // Login settings
      loginWithEmailAllowed: true,
      duplicateEmailsAllowed: false,
      verifyEmail: true,
      // Token settings
      defaultSignatureAlgorithm: 'RS256',
    };

    const token = await this.getAdminToken();

    try {
      await this.client.post('/admin/realms', realmConfig, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      logger.info('Keycloak realm created successfully', { realmName });
    } catch (error: any) {
      if (error.response?.status === 409) {
        logger.warn('Realm already exists', { realmName });
        return;
      }
      throw error;
    }
  }

  /**
   * Creates the TaskHub client application within a realm.
   * Configures OAuth2/OIDC settings for the frontend application.
   */
  async createClient(realmName: string): Promise<{ clientId: string; clientSecret: string }> {
    logger.info('Creating Keycloak client', { realmName });

    const clientConfig = {
      clientId: config.keycloak.clientId,
      name: 'TaskHub Application',
      description: 'TaskHub Multi-Tenant Project Management Application',
      enabled: true,
      clientAuthenticatorType: 'client-secret',
      protocol: 'openid-connect',
      // Public client for SPA (no client secret required for auth)
      publicClient: true,
      // Standard OAuth2 flow settings
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: true,
      serviceAccountsEnabled: false,
      // Redirect URIs for the frontend
      redirectUris: [
        'http://localhost:3000/*',
        'http://localhost:3000/callback',
      ],
      webOrigins: [
        'http://localhost:3000',
        '+', // Allow all origins that match redirect URIs
      ],
      // Token settings
      attributes: {
        'access.token.lifespan': '300',
        'oauth2.device.authorization.grant.enabled': 'false',
        'oidc.ciba.grant.enabled': 'false',
      },
      // Default scopes
      defaultClientScopes: ['openid', 'profile', 'email', 'roles'],
    };

    await this.adminRequest('post', `/${realmName}/clients`, clientConfig);

    // Get the created client to retrieve its ID
    const clients = await this.adminRequest<any[]>(
      'get',
      `/${realmName}/clients?clientId=${config.keycloak.clientId}`
    );

    const client = clients[0];
    logger.info('Keycloak client created', { realmName, clientId: client.id });

    return {
      clientId: client.id,
      clientSecret: client.secret || '',
    };
  }

  /**
   * Creates realm-level roles for RBAC.
   * TaskHub uses three primary roles: admin, manager, member.
   */
  async createRealmRoles(realmName: string): Promise<void> {
    logger.info('Creating realm roles', { realmName });

    const roles = [
      {
        name: 'admin',
        description: 'Tenant administrator with full access',
        composite: false,
      },
      {
        name: 'manager',
        description: 'Project manager with elevated permissions',
        composite: false,
      },
      {
        name: 'member',
        description: 'Standard team member',
        composite: false,
      },
    ];

    for (const role of roles) {
      try {
        await this.adminRequest('post', `/${realmName}/roles`, role);
        logger.debug('Role created', { realmName, role: role.name });
      } catch (error: any) {
        if (error.message.includes('409') || error.message.includes('already exists')) {
          logger.debug('Role already exists', { realmName, role: role.name });
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Creates an initial admin user for a new tenant.
   */
  async createUser(
    realmName: string,
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    roles: string[] = ['admin']
  ): Promise<string> {
    logger.info('Creating user in realm', { realmName, email });

    const userConfig = {
      username: email,
      email: email,
      firstName: firstName,
      lastName: lastName,
      enabled: true,
      emailVerified: true, // Skip verification for demo purposes
      credentials: [
        {
          type: 'password',
          value: password,
          temporary: false,
        },
      ],
    };

    await this.adminRequest('post', `/${realmName}/users`, userConfig);

    // Get the created user
    const users = await this.adminRequest<any[]>(
      'get',
      `/${realmName}/users?email=${encodeURIComponent(email)}`
    );

    const user = users[0];
    if (!user) {
      throw new Error('User creation failed - user not found after creation');
    }

    // Assign roles to the user
    for (const roleName of roles) {
      const role = await this.adminRequest<any>(
        'get',
        `/${realmName}/roles/${roleName}`
      );

      await this.adminRequest(
        'post',
        `/${realmName}/users/${user.id}/role-mappings/realm`,
        [role]
      );
    }

    logger.info('User created with roles', { realmName, userId: user.id, roles });
    return user.id;
  }

  /**
   * Gets all users in a realm with optional filtering.
   */
  async getUsers(
    realmName: string,
    params?: { search?: string; max?: number; first?: number }
  ): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.max) queryParams.set('max', params.max.toString());
    if (params?.first) queryParams.set('first', params.first.toString());

    const query = queryParams.toString();
    return this.adminRequest<any[]>(
      'get',
      `/${realmName}/users${query ? `?${query}` : ''}`
    );
  }

  /**
   * Configures an identity provider (IdP) for social login or enterprise SSO.
   */
  async configureIdentityProvider(
    realmName: string,
    providerType: 'google' | 'github' | 'oidc',
    config: {
      alias: string;
      clientId: string;
      clientSecret: string;
      issuer?: string;
    }
  ): Promise<void> {
    logger.info('Configuring identity provider', { realmName, providerType });

    const providerConfigs: Record<string, any> = {
      google: {
        alias: config.alias || 'google',
        providerId: 'google',
        enabled: true,
        trustEmail: true,
        storeToken: false,
        addReadTokenRoleOnCreate: false,
        firstBrokerLoginFlowAlias: 'first broker login',
        config: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          defaultScope: 'openid profile email',
        },
      },
      github: {
        alias: config.alias || 'github',
        providerId: 'github',
        enabled: true,
        trustEmail: true,
        storeToken: false,
        config: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        },
      },
      oidc: {
        alias: config.alias,
        providerId: 'oidc',
        enabled: true,
        trustEmail: true,
        config: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          tokenUrl: `${config.issuer}/protocol/openid-connect/token`,
          authorizationUrl: `${config.issuer}/protocol/openid-connect/auth`,
          userInfoUrl: `${config.issuer}/protocol/openid-connect/userinfo`,
          issuer: config.issuer,
        },
      },
    };

    await this.adminRequest(
      'post',
      `/${realmName}/identity-provider/instances`,
      providerConfigs[providerType]
    );
  }

  /**
   * Deletes a realm (tenant removal).
   */
  async deleteRealm(realmName: string): Promise<void> {
    logger.warn('Deleting Keycloak realm', { realmName });
    await this.adminRequest('delete', `/${realmName}`);
  }

  /**
   * Gets realm configuration.
   */
  async getRealm(realmName: string): Promise<any> {
    return this.adminRequest<any>('get', `/${realmName}`);
  }

  /**
   * Lists all realms (for admin purposes).
   */
  async listRealms(): Promise<any[]> {
    return this.adminRequest<any[]>('get', '');
  }
}

export const keycloakService = new KeycloakService();
export default keycloakService;
