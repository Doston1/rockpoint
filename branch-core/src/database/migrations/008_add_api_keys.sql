-- Migration: Create API keys table for branch-core authentication
-- Description: Add API key authentication system for chain-core to branch-core communication

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID -- References user who created the key
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);

-- Create default API key for chain-core communication
INSERT INTO api_keys (
    name, 
    key_hash, 
    description, 
    permissions
) VALUES (
    'Chain-Core Default',
    -- This is the hash of 'rp_CHAIN_CORE_DEFAULT_KEY_REPLACE_IN_PRODUCTION'
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
    'Default API key for chain-core communication. REPLACE IN PRODUCTION!',
    ARRAY['*']
) ON CONFLICT (key_hash) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- Add comments for documentation
COMMENT ON TABLE api_keys IS 'API keys for authenticating chain-core requests to branch-core';
COMMENT ON COLUMN api_keys.name IS 'Human-readable name for the API key';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA256 hash of the API key';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permissions granted to this API key';
COMMENT ON COLUMN api_keys.usage_count IS 'Number of times this API key has been used';
