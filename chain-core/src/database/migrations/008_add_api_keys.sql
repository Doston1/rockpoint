-- Migration: Add API Keys table for 1C integration authentication
-- File: 008_add_api_keys.sql

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0
);

-- Create index for fast lookups
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Insert default API key for 1C integration
INSERT INTO api_keys (
    name, 
    key_hash, 
    description, 
    permissions, 
    is_active
) VALUES (
    '1C Integration',
    'rp_1C_DEFAULT_KEY_REPLACE_IN_PRODUCTION',
    'Default API key for 1C ERP system integration',
    ARRAY['products:write', 'inventory:write', 'employees:write', 'transactions:read', 'sync:execute'],
    true
) ON CONFLICT (key_hash) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

COMMENT ON TABLE api_keys IS 'API keys for external system authentication';
COMMENT ON COLUMN api_keys.key_hash IS 'Hashed API key for security';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permission strings (e.g., products:write, inventory:read)';
COMMENT ON COLUMN api_keys.usage_count IS 'Number of times this API key has been used';
