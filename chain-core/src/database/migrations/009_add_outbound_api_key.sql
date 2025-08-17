-- Migration: Add outbound API key column to branch_servers table
-- File: 009_add_outbound_api_key.sql
-- Description: Add outbound_api_key column for chain-core to authenticate to branches

-- Add outbound API key column to branch_servers table
ALTER TABLE branch_servers 
ADD COLUMN IF NOT EXISTS outbound_api_key VARCHAR(255);

-- Update comments to clarify the purpose of each API key
COMMENT ON COLUMN branch_servers.api_key IS 'API key that the branch uses to authenticate to chain-core (inbound authentication)';
COMMENT ON COLUMN branch_servers.outbound_api_key IS 'API key that chain-core uses to authenticate to this branch (outbound authentication)';

-- Add index for outbound API key lookups
CREATE INDEX IF NOT EXISTS idx_branch_servers_outbound_api_key ON branch_servers(outbound_api_key) WHERE outbound_api_key IS NOT NULL;
