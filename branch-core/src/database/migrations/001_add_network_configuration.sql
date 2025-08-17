-- Migration: Add network configuration tables for branch-core
-- Date: 2025-08-17
-- Description: Add tables for managing POS terminals in the branch

-- POS Terminals table for tracking all POS terminals in this branch
CREATE TABLE IF NOT EXISTS pos_terminals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    terminal_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    port INTEGER NOT NULL DEFAULT 5173,
    mac_address VARCHAR(17), -- MAC address for identification
    location VARCHAR(255), -- Physical location in the store
    assigned_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance', 'error')),
    last_seen TIMESTAMP WITH TIME ZONE,
    hardware_info JSONB, -- Store hardware details like CPU, RAM, etc.
    software_version VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branch Network Configuration table
CREATE TABLE IF NOT EXISTS branch_network_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'chain_connection', 'pos_terminals', 'security')),
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connection Health Logs table for this branch
CREATE TABLE IF NOT EXISTS connection_health_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('branch_core', 'pos_terminal', 'chain_core')),
    source_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('branch_core', 'pos_terminal', 'chain_core')),
    target_id VARCHAR(100) NOT NULL,
    connection_status VARCHAR(20) NOT NULL CHECK (connection_status IN ('success', 'failed', 'timeout', 'error')),
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pos_terminals_status ON pos_terminals(status);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_ip ON pos_terminals(ip_address);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_active ON pos_terminals(is_active);

CREATE INDEX IF NOT EXISTS idx_branch_network_config_key ON branch_network_config(config_key);
CREATE INDEX IF NOT EXISTS idx_branch_network_config_category ON branch_network_config(category);

CREATE INDEX IF NOT EXISTS idx_connection_logs_source ON connection_health_logs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_target ON connection_health_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_checked_at ON connection_health_logs(checked_at);

-- Insert default branch network configuration
INSERT INTO branch_network_config (config_key, config_value, description, category, is_system) VALUES
('chain_core_ip', 'localhost', 'Chain core server IP address', 'chain_connection', true),
('chain_core_port', '3001', 'Chain core server port', 'chain_connection', true),
('branch_api_port', '3000', 'This branch API server port', 'general', true),
('branch_ws_port', '3001', 'This branch WebSocket server port', 'general', true),
('pos_default_port', '5173', 'Default port for new POS terminals', 'pos_terminals', true),
('network_scan_range', '192.168.1.0/24', 'Local network range to scan for POS terminals', 'pos_terminals', true),
('auto_discover_pos', 'true', 'Automatically discover POS terminals on network', 'pos_terminals', true),
('connection_timeout_ms', '10000', 'Connection timeout in milliseconds', 'general', true),
('health_check_interval_ms', '30000', 'Health check interval in milliseconds', 'general', true);
