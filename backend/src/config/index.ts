import dotenv from 'dotenv';

dotenv.config();

/**
 * Application configuration loaded from environment variables.
 * All sensitive values should be set via environment variables,
 * never hardcoded for production use.
 */
export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://taskhub:taskhub_secret@localhost:5432/taskhub',
  },

  // Keycloak configuration
  keycloak: {
    // Internal URL for server-to-server communication
    url: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    // Admin URL for realm management
    adminUrl: process.env.KEYCLOAK_ADMIN_URL || 'http://localhost:8080',
    // Public URL that clients use (for JWT issuer validation)
    publicUrl: process.env.KEYCLOAK_PUBLIC_URL || 'http://localhost:8080',
    // Admin credentials for realm provisioning
    adminUser: process.env.KEYCLOAK_ADMIN_USER || 'admin',
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
    // Client configuration for the TaskHub application
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'taskhub-app',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  },

  // JWT configuration
  jwt: {
    // Issuer base URL (realm-specific issuer will be: {issuer}/{realm})
    issuer: process.env.JWT_ISSUER || 'http://localhost:8080/realms',
    // Audience for token validation
    audience: process.env.JWT_AUDIENCE || 'taskhub-app',
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    // Enable detailed audit logging for SOC2 compliance
    auditEnabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
  },
};

export default config;
