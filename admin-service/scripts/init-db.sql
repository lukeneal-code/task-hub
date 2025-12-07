-- TaskHub Admin Service Database Initialization

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create platform schema
CREATE SCHEMA IF NOT EXISTS platform;

-- Platform tenants table
CREATE TABLE IF NOT EXISTS platform.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    schema_name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'pending',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON platform.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON platform.tenants(status);

-- Audit logs table
CREATE TABLE IF NOT EXISTS platform.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES platform.tenants(id) ON DELETE SET NULL,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON platform.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON platform.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON platform.audit_logs(user_id);

-- Grant permissions (adjust as needed)
GRANT ALL ON SCHEMA platform TO taskhub;
GRANT ALL ON ALL TABLES IN SCHEMA platform TO taskhub;
GRANT ALL ON ALL SEQUENCES IN SCHEMA platform TO taskhub;
