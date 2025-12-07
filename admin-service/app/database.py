import asyncpg
from typing import Optional, Any
from contextlib import asynccontextmanager
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_pool() -> asyncpg.Pool:
    """Initialize the database connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
        logger.info("Database connection pool initialized")
    return _pool


async def close_pool() -> None:
    """Close the database connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed")


async def get_pool() -> asyncpg.Pool:
    """Get the database connection pool, initializing if needed."""
    if _pool is None:
        await init_pool()
    return _pool


@asynccontextmanager
async def get_connection():
    """Get a database connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def execute(query: str, *args) -> str:
    """Execute a query and return the status."""
    async with get_connection() as conn:
        return await conn.execute(query, *args)


async def fetch(query: str, *args) -> list[asyncpg.Record]:
    """Fetch multiple rows."""
    async with get_connection() as conn:
        return await conn.fetch(query, *args)


async def fetchrow(query: str, *args) -> Optional[asyncpg.Record]:
    """Fetch a single row."""
    async with get_connection() as conn:
        return await conn.fetchrow(query, *args)


async def fetchval(query: str, *args) -> Any:
    """Fetch a single value."""
    async with get_connection() as conn:
        return await conn.fetchval(query, *args)


@asynccontextmanager
async def transaction():
    """Execute queries within a transaction."""
    async with get_connection() as conn:
        async with conn.transaction():
            yield conn


async def create_tenant_schema(schema_name: str) -> None:
    """Create an isolated schema for a tenant with all required tables."""
    async with get_connection() as conn:
        # Create schema
        await conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')

        # Create users table
        await conn.execute(f'''
            CREATE TABLE IF NOT EXISTS "{schema_name}".users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) NOT NULL UNIQUE,
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'member',
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        # Create projects table
        await conn.execute(f'''
            CREATE TABLE IF NOT EXISTS "{schema_name}".projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'active',
                owner_id UUID REFERENCES "{schema_name}".users(id),
                settings JSONB DEFAULT '{{}}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        # Create tasks table
        await conn.execute(f'''
            CREATE TABLE IF NOT EXISTS "{schema_name}".tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES "{schema_name}".projects(id) ON DELETE CASCADE,
                title VARCHAR(500) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'todo',
                priority VARCHAR(50) DEFAULT 'medium',
                assignee_id UUID REFERENCES "{schema_name}".users(id),
                due_date TIMESTAMPTZ,
                created_by UUID REFERENCES "{schema_name}".users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        # Create comments table
        await conn.execute(f'''
            CREATE TABLE IF NOT EXISTS "{schema_name}".comments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES "{schema_name}".tasks(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES "{schema_name}".users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        ''')

        logger.info(f"Created tenant schema: {schema_name}")


async def drop_tenant_schema(schema_name: str) -> None:
    """Drop a tenant's schema and all its data."""
    async with get_connection() as conn:
        await conn.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
        logger.info(f"Dropped tenant schema: {schema_name}")
