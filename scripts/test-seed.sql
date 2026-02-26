-- Test Seed Data for Integration Tests
-- Creates deterministic test tenants, users, projects, and tasks

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create base schema for platform-level data
CREATE SCHEMA IF NOT EXISTS platform;

-- Tenant Registry Table
CREATE TABLE IF NOT EXISTS platform.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    keycloak_realm VARCHAR(100) UNIQUE,
    schema_name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS platform.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES platform.tenants(id),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON platform.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON platform.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON platform.audit_logs(user_id);

-- Function to create tenant schema with all required tables
CREATE OR REPLACE FUNCTION platform.create_tenant_schema(schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- Users table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            password_hash VARCHAR(255),
            role VARCHAR(50) DEFAULT ''member'',
            status VARCHAR(50) DEFAULT ''active'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Projects table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.projects (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT ''active'',
            owner_id UUID,
            settings JSONB DEFAULT ''{}'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Tasks table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.tasks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            project_id UUID NOT NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT ''todo'',
            priority VARCHAR(50) DEFAULT ''medium'',
            assignee_id UUID,
            due_date TIMESTAMP WITH TIME ZONE,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Comments table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.comments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            task_id UUID NOT NULL,
            user_id UUID NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- Add foreign key constraints
    EXECUTE format('
        ALTER TABLE %I.projects
        ADD CONSTRAINT fk_projects_owner
        FOREIGN KEY (owner_id) REFERENCES %I.users(id) ON DELETE SET NULL
    ', schema_name, schema_name);

    EXECUTE format('
        ALTER TABLE %I.tasks
        ADD CONSTRAINT fk_tasks_project
        FOREIGN KEY (project_id) REFERENCES %I.projects(id) ON DELETE CASCADE
    ', schema_name, schema_name);

    EXECUTE format('
        ALTER TABLE %I.tasks
        ADD CONSTRAINT fk_tasks_assignee
        FOREIGN KEY (assignee_id) REFERENCES %I.users(id) ON DELETE SET NULL
    ', schema_name, schema_name);

    EXECUTE format('
        ALTER TABLE %I.tasks
        ADD CONSTRAINT fk_tasks_creator
        FOREIGN KEY (created_by) REFERENCES %I.users(id) ON DELETE SET NULL
    ', schema_name, schema_name);

    EXECUTE format('
        ALTER TABLE %I.comments
        ADD CONSTRAINT fk_comments_task
        FOREIGN KEY (task_id) REFERENCES %I.tasks(id) ON DELETE CASCADE
    ', schema_name, schema_name);

    EXECUTE format('
        ALTER TABLE %I.comments
        ADD CONSTRAINT fk_comments_user
        FOREIGN KEY (user_id) REFERENCES %I.users(id) ON DELETE CASCADE
    ', schema_name, schema_name);

    -- Create indexes
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tasks_project ON %I.tasks(project_id)',
        replace(schema_name, 'tenant_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tasks_assignee ON %I.tasks(assignee_id)',
        replace(schema_name, 'tenant_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_comments_task ON %I.comments(task_id)',
        replace(schema_name, 'tenant_', ''), schema_name);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TEST DATA: Tenant Alpha
-- ============================================================================

-- Create Tenant Alpha with deterministic UUID
INSERT INTO platform.tenants (id, name, slug, keycloak_realm, schema_name, settings)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Alpha Corporation',
    'alpha',
    'alpha',
    'tenant_alpha',
    '{"theme": "default", "features": ["projects", "tasks"]}'
)
ON CONFLICT (slug) DO NOTHING;

-- Create Alpha tenant schema
SELECT platform.create_tenant_schema('tenant_alpha');

-- Create Alpha users with deterministic UUIDs
INSERT INTO tenant_alpha.users (id, email, first_name, last_name, role, status)
VALUES
    ('aaaa1111-1111-1111-1111-111111111111', 'admin@alpha.com', 'Alpha', 'Admin', 'admin', 'active'),
    ('aaaa2222-2222-2222-2222-222222222222', 'manager@alpha.com', 'Alpha', 'Manager', 'manager', 'active'),
    ('aaaa3333-3333-3333-3333-333333333333', 'member@alpha.com', 'Alpha', 'Member', 'member', 'active')
ON CONFLICT DO NOTHING;

-- Create Alpha projects
INSERT INTO tenant_alpha.projects (id, name, description, status, owner_id)
VALUES
    ('aaaa0001-0001-0001-0001-000000000001', 'Alpha Project One', 'First project for Alpha Corp', 'active', 'aaaa1111-1111-1111-1111-111111111111'),
    ('aaaa0002-0002-0002-0002-000000000002', 'Alpha Project Two', 'Second project for Alpha Corp', 'active', 'aaaa2222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- Create Alpha tasks
INSERT INTO tenant_alpha.tasks (id, project_id, title, description, status, priority, assignee_id, created_by)
VALUES
    ('aaaa0101-0101-0101-0101-010101010101', 'aaaa0001-0001-0001-0001-000000000001', 'Alpha Task 1', 'Description for task 1', 'todo', 'high', 'aaaa3333-3333-3333-3333-333333333333', 'aaaa1111-1111-1111-1111-111111111111'),
    ('aaaa0102-0102-0102-0102-010201020102', 'aaaa0001-0001-0001-0001-000000000001', 'Alpha Task 2', 'Description for task 2', 'in_progress', 'medium', 'aaaa2222-2222-2222-2222-222222222222', 'aaaa2222-2222-2222-2222-222222222222'),
    ('aaaa0103-0103-0103-0103-010301030103', 'aaaa0002-0002-0002-0002-000000000002', 'Alpha Task 3', 'Description for task 3', 'done', 'low', 'aaaa3333-3333-3333-3333-333333333333', 'aaaa2222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST DATA: Tenant Beta
-- ============================================================================

-- Create Tenant Beta with deterministic UUID
INSERT INTO platform.tenants (id, name, slug, keycloak_realm, schema_name, settings)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Beta Industries',
    'beta',
    'beta',
    'tenant_beta',
    '{"theme": "dark", "features": ["projects", "tasks", "comments"]}'
)
ON CONFLICT (slug) DO NOTHING;

-- Create Beta tenant schema
SELECT platform.create_tenant_schema('tenant_beta');

-- Create Beta users with deterministic UUIDs
INSERT INTO tenant_beta.users (id, email, first_name, last_name, role, status)
VALUES
    ('bbbb1111-1111-1111-1111-111111111111', 'admin@beta.com', 'Beta', 'Admin', 'admin', 'active'),
    ('bbbb2222-2222-2222-2222-222222222222', 'manager@beta.com', 'Beta', 'Manager', 'manager', 'active'),
    ('bbbb3333-3333-3333-3333-333333333333', 'member@beta.com', 'Beta', 'Member', 'member', 'active')
ON CONFLICT DO NOTHING;

-- Create Beta projects
INSERT INTO tenant_beta.projects (id, name, description, status, owner_id)
VALUES
    ('bbbb0001-0001-0001-0001-000000000001', 'Beta Project One', 'First project for Beta Industries', 'active', 'bbbb1111-1111-1111-1111-111111111111'),
    ('bbbb0002-0002-0002-0002-000000000002', 'Beta Project Two', 'Second project for Beta Industries', 'active', 'bbbb2222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- Create Beta tasks
INSERT INTO tenant_beta.tasks (id, project_id, title, description, status, priority, assignee_id, created_by)
VALUES
    ('bbbb0101-0101-0101-0101-010101010101', 'bbbb0001-0001-0001-0001-000000000001', 'Beta Task 1', 'Description for task 1', 'todo', 'high', 'bbbb3333-3333-3333-3333-333333333333', 'bbbb1111-1111-1111-1111-111111111111'),
    ('bbbb0102-0102-0102-0102-010201020102', 'bbbb0001-0001-0001-0001-000000000001', 'Beta Task 2', 'Description for task 2', 'in_progress', 'medium', 'bbbb2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222'),
    ('bbbb0103-0103-0103-0103-010301030103', 'bbbb0002-0002-0002-0002-000000000002', 'Beta Task 3', 'Description for task 3', 'done', 'low', 'bbbb3333-3333-3333-3333-333333333333', 'bbbb2222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TEST DATA: Suspended Tenant (for testing access control)
-- ============================================================================

INSERT INTO platform.tenants (id, name, slug, keycloak_realm, schema_name, status, settings)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Suspended Corp',
    'suspended',
    'suspended',
    'tenant_suspended',
    'suspended',
    '{}'
)
ON CONFLICT (slug) DO NOTHING;

-- Create suspended tenant schema
SELECT platform.create_tenant_schema('tenant_suspended');

-- Grant permissions
GRANT USAGE ON SCHEMA platform TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA platform TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA platform TO taskhub_test;
GRANT USAGE ON SCHEMA tenant_alpha TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_alpha TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_alpha TO taskhub_test;
GRANT USAGE ON SCHEMA tenant_beta TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_beta TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_beta TO taskhub_test;
GRANT USAGE ON SCHEMA tenant_suspended TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_suspended TO taskhub_test;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_suspended TO taskhub_test;
