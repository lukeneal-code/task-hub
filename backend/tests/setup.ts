/**
 * Jest Integration Test Setup
 *
 * This file runs before all integration tests and sets up the test environment.
 */

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8081';
process.env.KEYCLOAK_PUBLIC_URL = process.env.KEYCLOAK_PUBLIC_URL || 'http://localhost:8081';
process.env.KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
process.env.KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://taskhub_test:test_secret@localhost:5434/taskhub_test';
process.env.KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'taskhub-app';

// Test configuration
export const TEST_CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3002',
  keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8081',
  clientId: 'taskhub-app',

  // Test tenants (seeded from test-seed.sql)
  tenants: {
    alpha: {
      id: '11111111-1111-1111-1111-111111111111',
      slug: 'alpha',
      realm: 'alpha',
      schema: 'tenant_alpha',
    },
    beta: {
      id: '22222222-2222-2222-2222-222222222222',
      slug: 'beta',
      realm: 'beta',
      schema: 'tenant_beta',
    },
    suspended: {
      id: '33333333-3333-3333-3333-333333333333',
      slug: 'suspended',
      realm: 'suspended',
      schema: 'tenant_suspended',
    },
  },

  // Test users (credentials in Keycloak)
  users: {
    alpha: {
      admin: {
        id: 'aaaa1111-1111-1111-1111-111111111111',
        email: 'admin@alpha.com',
        password: 'password123',
        realm: 'alpha',
        role: 'admin',
      },
      manager: {
        id: 'aaaa2222-2222-2222-2222-222222222222',
        email: 'manager@alpha.com',
        password: 'password123',
        realm: 'alpha',
        role: 'manager',
      },
      member: {
        id: 'aaaa3333-3333-3333-3333-333333333333',
        email: 'member@alpha.com',
        password: 'password123',
        realm: 'alpha',
        role: 'member',
      },
    },
    beta: {
      admin: {
        id: 'bbbb1111-1111-1111-1111-111111111111',
        email: 'admin@beta.com',
        password: 'password123',
        realm: 'beta',
        role: 'admin',
      },
      manager: {
        id: 'bbbb2222-2222-2222-2222-222222222222',
        email: 'manager@beta.com',
        password: 'password123',
        realm: 'beta',
        role: 'manager',
      },
      member: {
        id: 'bbbb3333-3333-3333-3333-333333333333',
        email: 'member@beta.com',
        password: 'password123',
        realm: 'beta',
        role: 'member',
      },
    },
  },

  // Test projects
  projects: {
    alpha: {
      one: {
        id: 'aaaa0001-0001-0001-0001-000000000001',
        name: 'Alpha Project One',
      },
      two: {
        id: 'aaaa0002-0002-0002-0002-000000000002',
        name: 'Alpha Project Two',
      },
    },
    beta: {
      one: {
        id: 'bbbb0001-0001-0001-0001-000000000001',
        name: 'Beta Project One',
      },
      two: {
        id: 'bbbb0002-0002-0002-0002-000000000002',
        name: 'Beta Project Two',
      },
    },
  },

  // Test tasks
  tasks: {
    alpha: {
      task1: {
        id: 'aaaa0101-0101-0101-0101-010101010101',
        title: 'Alpha Task 1',
      },
      task2: {
        id: 'aaaa0102-0102-0102-0102-010201020102',
        title: 'Alpha Task 2',
      },
      task3: {
        id: 'aaaa0103-0103-0103-0103-010301030103',
        title: 'Alpha Task 3',
      },
    },
    beta: {
      task1: {
        id: 'bbbb0101-0101-0101-0101-010101010101',
        title: 'Beta Task 1',
      },
      task2: {
        id: 'bbbb0102-0102-0102-0102-010201020102',
        title: 'Beta Task 2',
      },
      task3: {
        id: 'bbbb0103-0103-0103-0103-010301030103',
        title: 'Beta Task 3',
      },
    },
  },
};

// Log test configuration on start
console.log('Integration Test Configuration:');
console.log(`  API URL: ${TEST_CONFIG.apiUrl}`);
console.log(`  Keycloak URL: ${TEST_CONFIG.keycloakUrl}`);
