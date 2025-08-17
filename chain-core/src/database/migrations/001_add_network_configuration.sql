-- Migration: Add network configuration tables
-- Date: 2025-08-17
-- Description: Add tables for managing IP addresses and ports across the POS system

-- Branch Servers table for chain-core to track all branch servers
CREATE TABLE IF NOT EXISTS branch_servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    server_name VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    port INTEGER NOT NULL DEFAULT 3000,
    api_port INTEGER NOT NULL DEFAULT 3000,
    websocket_port INTEGER NOT NULL DEFAULT 3001,
    vpn_ip_address INET, -- VPN IP for chain communication
    public_ip_address INET, -- Public IP if accessible from internet
    network_type VARCHAR(20) DEFAULT 'lan' CHECK (network_type IN ('lan', 'vpn', 'public')),
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance', 'error')),
    last_ping TIMESTAMP WITH TIME ZONE,
    response_time_ms INTEGER, -- Latest ping response time
    server_info JSONB, -- Store server specs, OS, etc.
    api_key VARCHAR(255), -- API key for secure communication
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, server_name)
);

-- Network Settings table for system-wide network configuration
CREATE TABLE IF NOT EXISTS network_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'security', 'timeouts', 'ports')),
    is_system BOOLEAN DEFAULT false, -- System settings cannot be deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connection Health Logs table for monitoring network status between chain-core and branch servers
CREATE TABLE IF NOT EXISTS connection_health_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('chain_core', 'branch_core')),
    source_id VARCHAR(100) NOT NULL, -- Could be branch_id, etc.
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('chain_core', 'branch_core')),
    target_id VARCHAR(100) NOT NULL,
    connection_status VARCHAR(20) NOT NULL CHECK (connection_status IN ('success', 'failed', 'timeout', 'error')),
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_branch_servers_branch_id ON branch_servers(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_servers_status ON branch_servers(status);
CREATE INDEX IF NOT EXISTS idx_branch_servers_ip ON branch_servers(ip_address);
CREATE INDEX IF NOT EXISTS idx_branch_servers_network_type ON branch_servers(network_type);

CREATE INDEX IF NOT EXISTS idx_network_settings_key ON network_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_network_settings_category ON network_settings(category);

CREATE INDEX IF NOT EXISTS idx_connection_logs_source ON connection_health_logs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_target ON connection_health_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_checked_at ON connection_health_logs(checked_at);

-- Insert default network settings
INSERT INTO network_settings (setting_key, setting_value, description, category, is_system) VALUES
('default_branch_api_port', '3000', 'Default API port for branch servers', 'ports', true),
('default_branch_ws_port', '3001', 'Default WebSocket port for branch servers', 'ports', true),
('chain_core_port', '3001', 'Chain core server port', 'ports', true),
('connection_timeout_ms', '10000', 'Default connection timeout in milliseconds', 'timeouts', true),
('health_check_interval_ms', '30000', 'Health check interval in milliseconds', 'timeouts', true),
('max_response_time_ms', '5000', 'Maximum acceptable response time', 'timeouts', true),
('vpn_network_range', '10.0.0.0/8', 'VPN network IP range', 'security', true),
('allow_public_access', 'false', 'Allow access from public internet', 'security', true);

-- Add network configuration columns to existing branches table
-- (Only add if they don't exist)
DO $$
BEGIN
    -- Add server_ip column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'branches' AND column_name = 'server_ip') THEN
        ALTER TABLE branches ADD COLUMN server_ip INET;
    END IF;
    
    -- Add server_port column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'branches' AND column_name = 'server_port') THEN
        ALTER TABLE branches ADD COLUMN server_port INTEGER DEFAULT 3000;
    END IF;
    
    -- Add vpn_ip column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'branches' AND column_name = 'vpn_ip') THEN
        ALTER TABLE branches ADD COLUMN vpn_ip INET;
    END IF;
    
    -- Add network_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'branches' AND column_name = 'network_status') THEN
        ALTER TABLE branches ADD COLUMN network_status VARCHAR(20) DEFAULT 'unknown' 
            CHECK (network_status IN ('online', 'offline', 'maintenance', 'error', 'unknown'));
    END IF;
    
    -- Add last_health_check column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'branches' AND column_name = 'last_health_check') THEN
        ALTER TABLE branches ADD COLUMN last_health_check TIMESTAMP WITH TIME ZONE;
    END IF;
END
$$;
