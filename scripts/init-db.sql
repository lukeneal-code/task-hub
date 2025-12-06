-- TaskHub Database Initialization Script
-- Creates the base schema and tenant management tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create base schema for platform-level data
CREATE SCHEMA IF NOT EXISTS platform;

-- Tenant Registry Table (platform-level)
-- Tracks all tenants and their associated Keycloak realms
CREATE TABLE IF NOT EXISTS platform.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    keycloak_realm VARCHAR(100) NOT NULL UNIQUE,
    schema_name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table (platform-level for SOC2 compliance)
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

-- Create index for efficient audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON platform.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON platform.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON platform.audit_logs(user_id);

-- Function to create tenant schema with all required tables
CREATE OR REPLACE FUNCTION platform.create_tenant_schema(schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Create the tenant-specific schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- Users table (synced from Keycloak)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY,
            keycloak_id VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
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

    -- Create indexes for common queries
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tasks_project ON %I.tasks(project_id)',
        replace(schema_name, 'tenant_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tasks_assignee ON %I.tasks(assignee_id)',
        replace(schema_name, 'tenant_', ''), schema_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_comments_task ON %I.comments(task_id)',
        replace(schema_name, 'tenant_', ''), schema_name);
END;
$$ LANGUAGE plpgsql;

-- Function to drop tenant schema (for cleanup/deletion)
CREATE OR REPLACE FUNCTION platform.drop_tenant_schema(schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
END;
$$ LANGUAGE plpgsql;

-- Create a demo tenant for testing
INSERT INTO platform.tenants (name, slug, keycloak_realm, schema_name, settings)
VALUES ('Demo Company', 'demo', 'demo', 'tenant_demo', '{"theme": "default", "features": ["projects", "tasks"]}')
ON CONFLICT (slug) DO NOTHING;

-- Create the demo tenant schema
SELECT platform.create_tenant_schema('tenant_demo');

-- Grant permissions (adjust based on your security requirements)
GRANT USAGE ON SCHEMA platform TO taskhub;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA platform TO taskhub;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA platform TO taskhub;
GRANT USAGE ON SCHEMA tenant_demo TO taskhub;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_demo TO taskhub;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_demo TO taskhub;
