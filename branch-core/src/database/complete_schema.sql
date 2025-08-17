-- Complete Database Schema for RockPoint Branch Core
-- PostgreSQL 14+
-- This file contains all tables, indexes, triggers, and functions

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================
-- MAIN BUSINESS TABLES
-- =================================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier', 'supervisor')),
    pin_hash TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    hire_date DATE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table with translations
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL, -- The category key used in products table
    name_en VARCHAR(255) NOT NULL,    -- English name (required)
    name_ru VARCHAR(255),             -- Russian translation (optional)
    name_uz VARCHAR(255),             -- Uzbek translation (optional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(255) UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) DEFAULT 0,
    quantity_in_stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    category VARCHAR(100),
    brand VARCHAR(100),
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    loyalty_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    terminal_id VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'voided', 'refunded')),
    void_reason TEXT,
    voided_by VARCHAR(50),
    voided_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transaction items table
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'digital_wallet', 'store_credit')),
    amount DECIMAL(10,2) NOT NULL,
    reference VARCHAR(255),
    card_last4 VARCHAR(4),
    change_given DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    old_quantity INTEGER,
    new_quantity INTEGER,
    change_quantity INTEGER NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('add', 'subtract', 'set')),
    reason VARCHAR(255),
    transaction_id UUID REFERENCES transactions(id),
    employee_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee time logs table
CREATE TABLE IF NOT EXISTS employee_time_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) NOT NULL,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    break_minutes INTEGER DEFAULT 0,
    terminal_id VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- NETWORK AND INFRASTRUCTURE TABLES
-- =================================================================

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

-- =================================================================
-- AUTHENTICATION AND SECURITY TABLES
-- =================================================================

-- API keys table for chain-core to branch-core authentication
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

-- =================================================================
-- SYNC AND LOGGING TABLES
-- =================================================================

-- Sync logs table
CREATE TABLE IF NOT EXISTS sync_logs (
    id VARCHAR(255) PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'transactions-only')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- INDEXES FOR PERFORMANCE
-- =================================================================

-- Employees indexes
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_key ON categories(key);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_terminal_id ON transactions(terminal_id);
CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_completed_at ON transactions(completed_at);

-- Transaction items indexes
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON transaction_items(product_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);

-- Stock movements indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_transaction_id ON stock_movements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

-- Employee time logs indexes
CREATE INDEX IF NOT EXISTS idx_employee_time_logs_employee_id ON employee_time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_time_logs_clock_in ON employee_time_logs(clock_in);

-- POS terminals indexes
CREATE INDEX IF NOT EXISTS idx_pos_terminals_status ON pos_terminals(status);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_ip ON pos_terminals(ip_address);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_active ON pos_terminals(is_active);

-- Branch network config indexes
CREATE INDEX IF NOT EXISTS idx_branch_network_config_key ON branch_network_config(config_key);
CREATE INDEX IF NOT EXISTS idx_branch_network_config_category ON branch_network_config(category);

-- Connection logs indexes
CREATE INDEX IF NOT EXISTS idx_connection_logs_source ON connection_health_logs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_target ON connection_health_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_connection_logs_checked_at ON connection_health_logs(checked_at);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_completed_at ON sync_logs(completed_at);

-- =================================================================
-- FUNCTIONS AND TRIGGERS
-- =================================================================

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create category entries when new ones are used
CREATE OR REPLACE FUNCTION ensure_category_exists()
RETURNS TRIGGER AS $$
BEGIN
    -- If category is provided and doesn't exist in categories table, create it
    IF NEW.category IS NOT NULL AND NEW.category != '' THEN
        INSERT INTO categories (key, name_en)
        VALUES (NEW.category, NEW.category)
        ON CONFLICT (key) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update API keys updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pos_terminals_updated_at BEFORE UPDATE ON pos_terminals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_network_config_updated_at BEFORE UPDATE ON branch_network_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically create categories
DROP TRIGGER IF EXISTS ensure_category_trigger ON products;
CREATE TRIGGER ensure_category_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION ensure_category_exists();

-- API keys updated_at trigger
CREATE TRIGGER trigger_update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- =================================================================
-- VIEWS FOR COMMON QUERIES
-- =================================================================

-- Transaction details view
CREATE OR REPLACE VIEW transaction_details AS
SELECT 
    t.id,
    t.terminal_id,
    t.employee_id,
    e.name as employee_name,
    t.customer_id,
    c.name as customer_name,
    t.subtotal,
    t.tax_amount,
    t.total_amount,
    t.status,
    t.created_at,
    t.completed_at,
    COUNT(ti.id) as item_count,
    SUM(ti.quantity) as total_items
FROM transactions t
LEFT JOIN employees e ON t.employee_id = e.employee_id
LEFT JOIN customers c ON t.customer_id = c.id
LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
GROUP BY t.id, e.name, c.name;

-- Low stock products view
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
    id, name, barcode, quantity_in_stock, 
    low_stock_threshold, category, price
FROM products 
WHERE is_active = true 
AND quantity_in_stock <= COALESCE(low_stock_threshold, 10)
ORDER BY quantity_in_stock ASC;

-- =================================================================
-- COMMENTS FOR DOCUMENTATION
-- =================================================================

COMMENT ON TABLE api_keys IS 'API keys for authenticating chain-core requests to branch-core';
COMMENT ON COLUMN api_keys.name IS 'Human-readable name for the API key';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA256 hash of the API key';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permissions granted to this API key';
COMMENT ON COLUMN api_keys.usage_count IS 'Number of times this API key has been used';

COMMENT ON TABLE categories IS 'Product categories with multi-language support';
COMMENT ON COLUMN categories.key IS 'Unique category identifier used in products table';
COMMENT ON COLUMN categories.name_en IS 'English category name (required)';
COMMENT ON COLUMN categories.name_ru IS 'Russian category name (optional)';
COMMENT ON COLUMN categories.name_uz IS 'Uzbek category name (optional)';

COMMENT ON TABLE connection_health_logs IS 'Health check logs for monitoring connectivity between systems';
COMMENT ON TABLE pos_terminals IS 'POS terminals registered with this branch';
COMMENT ON TABLE branch_network_config IS 'Branch-specific network and system configuration';

-- =================================================================
-- SUMMARY
-- =================================================================

-- This schema includes 14 tables:
-- 1. employees - Staff management
-- 2. categories - Product categories with translations
-- 3. products - Product catalog
-- 4. customers - Customer information
-- 5. transactions - Sales transactions
-- 6. transaction_items - Transaction line items
-- 7. payments - Payment information
-- 8. stock_movements - Inventory tracking
-- 9. employee_time_logs - Time tracking
-- 10. pos_terminals - POS terminal management
-- 11. branch_network_config - Network configuration
-- 12. connection_health_logs - Health monitoring
-- 13. api_keys - Authentication system
-- 14. sync_logs - Synchronization tracking
