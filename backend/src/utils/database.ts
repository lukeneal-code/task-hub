import { Pool, PoolClient } from 'pg';
import config from '../config';
import logger from './logger';

/**
 * PostgreSQL connection pool for multi-tenant database operations.
 * Uses schema-per-tenant isolation pattern for GDPR compliance.
 */
const pool = new Pool({
  connectionString: config.database.url,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log pool events for monitoring
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

/**
 * Executes a query with automatic connection management.
 * For simple queries without tenant context.
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { duration, rows: result.rowCount });
    return { rows: result.rows, rowCount: result.rowCount || 0 };
  } catch (error) {
    logger.error('Query error', { error, text });
    throw error;
  }
}

/**
 * Gets a client from the pool for transaction support.
 * Remember to release the client after use.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Executes queries within a specific tenant's schema.
 * Sets the search_path to ensure complete data isolation.
 *
 * This is critical for GDPR compliance - each tenant's data
 * is isolated in their own PostgreSQL schema.
 */
export async function queryWithTenant<T = any>(
  tenantSchema: string,
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await pool.connect();
  try {
    // Set search path to tenant schema for this connection
    // This ensures all unqualified table references go to the tenant's schema
    await client.query(`SET search_path TO ${tenantSchema}, public`);

    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Tenant query executed', {
      tenantSchema,
      duration,
      rows: result.rowCount,
    });

    return { rows: result.rows, rowCount: result.rowCount || 0 };
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}

/**
 * Executes a transaction within a tenant's schema.
 * Provides automatic rollback on error.
 */
export async function transactionWithTenant<T>(
  tenantSchema: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${tenantSchema}, public`);
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a new tenant schema with all required tables.
 * Called during tenant provisioning.
 */
export async function createTenantSchema(schemaName: string): Promise<void> {
  logger.info('Creating tenant schema', { schemaName });
  await query('SELECT platform.create_tenant_schema($1)', [schemaName]);
}

/**
 * Drops a tenant schema (for cleanup/deletion).
 * Use with caution - this is destructive and irreversible.
 */
export async function dropTenantSchema(schemaName: string): Promise<void> {
  logger.warn('Dropping tenant schema', { schemaName });
  await query('SELECT platform.drop_tenant_schema($1)', [schemaName]);
}

/**
 * Gracefully closes the connection pool.
 * Call during application shutdown.
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export default {
  query,
  getClient,
  queryWithTenant,
  transactionWithTenant,
  createTenantSchema,
  dropTenantSchema,
  closePool,
};
