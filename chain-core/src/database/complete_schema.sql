-- Complete Database Schema for RockPoint Chain Core
-- PostgreSQL 14+
-- This file contains all tables, indexes, triggers, functions, and views

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS onec_sync_logs CASCADE;
DROP TABLE IF EXISTS branch_sync_logs CASCADE;
DROP TABLE IF EXISTS connection_health_logs CASCADE;
DROP TABLE IF EXISTS network_settings CASCADE;
DROP TABLE IF EXISTS branch_servers CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS branch_inventory CASCADE;
DROP TABLE IF EXISTS branch_product_pricing CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS employee_time_logs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS chains CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =================================================================
-- CORE BUSINESS TABLES
-- =================================================================

-- Chains table (top-level organization)
CREATE TABLE chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    headquarters_address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'UTC',
    base_currency VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branches table
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    manager_name VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'UTC',
    currency VARCHAR(10) DEFAULT 'USD',
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    api_endpoint VARCHAR(500),
    api_key VARCHAR(255),
    server_ip INET,
    server_port INTEGER DEFAULT 3000,
    vpn_ip INET,
    network_status VARCHAR(20) DEFAULT 'unknown' CHECK (network_status IN ('online', 'offline', 'maintenance', 'error', 'unknown')),
    last_health_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Main office users (different from branch employees)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'chain_admin', 'manager', 'analyst', 'auditor')),
    permissions TEXT[], -- Array of permission strings
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chain-wide employees (aggregated from all branches)
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(100) NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'supervisor', 'cashier')),
    phone VARCHAR(50),
    email VARCHAR(255),
    hire_date DATE,
    salary DECIMAL(10,2),
    pin_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    last_login TIMESTAMP WITH TIME ZONE,
    onec_id VARCHAR(100), -- Reference to 1C employee ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, branch_id)
);

-- Employee time logs (aggregated from all branches)
CREATE TABLE employee_time_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    break_start TIMESTAMP WITH TIME ZONE,
    break_end TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(5,2),
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'incomplete')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories (chain-wide)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_ru VARCHAR(255),
    name_uz VARCHAR(255),
    description TEXT,
    description_ru TEXT,
    description_uz TEXT,
    parent_id UUID REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    onec_id VARCHAR(100), -- Reference to 1C category ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products (chain-wide master data)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    name_ru VARCHAR(255),
    name_uz VARCHAR(255),
    description TEXT,
    description_ru TEXT,
    description_uz TEXT,
    category_id UUID REFERENCES categories(id),
    brand VARCHAR(255),
    unit_of_measure VARCHAR(50) DEFAULT 'pcs',
    base_price DECIMAL(10,2) NOT NULL, -- Default price, can be overridden per branch
    cost DECIMAL(10,2),
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    image_url VARCHAR(500),
    images TEXT[], -- Array of image URLs
    attributes JSONB, -- Flexible attributes storage
    is_active BOOLEAN DEFAULT true,
    onec_id VARCHAR(100), -- Reference to 1C product ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branch-specific product pricing and availability
CREATE TABLE branch_product_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL, -- Branch-specific price
    cost DECIMAL(10,2), -- Branch-specific cost
    is_available BOOLEAN DEFAULT true, -- Product availability in this branch
    min_quantity_discount DECIMAL(10,3), -- Minimum quantity for bulk discount
    bulk_price DECIMAL(10,2), -- Price when buying in bulk
    discount_percentage DECIMAL(5,2) DEFAULT 0, -- Percentage discount
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, product_id)
);

-- Branch inventory (stock levels per branch)
CREATE TABLE branch_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity_in_stock DECIMAL(10,3) DEFAULT 0,
    reserved_quantity DECIMAL(10,3) DEFAULT 0,
    min_stock_level DECIMAL(10,3) DEFAULT 0,
    max_stock_level DECIMAL(10,3),
    reorder_point DECIMAL(10,3),
    last_counted_at TIMESTAMP WITH TIME ZONE,
    last_movement_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, product_id)
);

-- Stock movements (aggregated from all branches)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('sale', 'return', 'adjustment', 'transfer_in', 'transfer_out', 'damaged', 'expired')),
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2),
    reference_id UUID, -- Transaction ID or adjustment ID
    reference_type VARCHAR(50), -- 'transaction', 'adjustment', 'transfer'
    notes TEXT,
    employee_id UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers (optional - for loyalty programs, etc.)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    loyalty_points INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions (aggregated from all branches)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    transaction_number VARCHAR(100) NOT NULL,
    employee_id UUID REFERENCES employees(id),
    customer_id UUID REFERENCES customers(id),
    terminal_id VARCHAR(100),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    onec_id VARCHAR(100), -- Reference to 1C transaction ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(transaction_number, branch_id)
);

-- Transaction items (aggregated from all branches)
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL, -- Actual price paid (including discounts)
    original_price DECIMAL(10,2) NOT NULL, -- Original price before discounts
    unit_cost DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    promotion_applied VARCHAR(255), -- Name of promotion if any
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments (aggregated from all branches)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'digital_wallet', 'bank_transfer', 'check')),
    amount DECIMAL(10,2) NOT NULL,
    reference_number VARCHAR(255),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Promotions/Sales rules
CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('percentage_discount', 'fixed_discount', 'buy_x_get_y', 'bulk_discount')),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL for chain-wide promotions
    product_id UUID REFERENCES products(id) ON DELETE CASCADE, -- NULL for category-wide promotions
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE, -- NULL for product-specific promotions
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    min_quantity INTEGER DEFAULT 1,
    buy_quantity INTEGER, -- For buy X get Y promotions
    get_quantity INTEGER, -- For buy X get Y promotions
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- NETWORK AND INFRASTRUCTURE TABLES
-- =================================================================

-- Branch Servers table for chain-core to track all branch servers
CREATE TABLE branch_servers (
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
    api_key VARCHAR(255), -- API key for branch to authenticate to chain-core (inbound)
    outbound_api_key VARCHAR(255), -- API key for chain-core to authenticate to branch (outbound)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, server_name)
);

-- Network Settings table for system-wide network configuration
CREATE TABLE network_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'security', 'timeouts', 'ports')),
    is_system BOOLEAN DEFAULT false, -- System settings cannot be deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connection Health Logs table for monitoring network status
CREATE TABLE connection_health_logs (
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

-- =================================================================
-- AUTHENTICATION AND SECURITY TABLES
-- =================================================================

-- API Keys table for external system authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0
);

-- =================================================================
-- SYNC AND LOGGING TABLES
-- =================================================================

-- Branch sync logs (for manual syncs between chain-core and branches)
CREATE TABLE branch_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('products', 'inventory', 'transactions', 'employees', 'full_sync')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('to_branch', 'from_branch')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed')),
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    initiated_by UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1C sync logs (for syncs triggered from 1C side)
CREATE TABLE onec_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('products', 'categories', 'employees', 'transactions', 'inventory')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('import', 'export')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed')),
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Legacy support tables (placeholders to maintain count of 24 tables)
-- These maintain compatibility with existing code that might reference them

-- Sync history placeholder (removed automatic sync system)
CREATE TABLE sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_note TEXT DEFAULT 'This table exists for compatibility. Use branch_sync_logs or onec_sync_logs instead.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync tasks placeholder (removed automatic sync system)  
CREATE TABLE sync_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_note TEXT DEFAULT 'This table exists for compatibility. Use manual sync endpoints instead.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =================================================================
-- INDEXES FOR PERFORMANCE
-- =================================================================

-- Chains indexes
CREATE INDEX idx_chains_code ON chains(code);

-- Branches indexes
CREATE INDEX idx_branches_code ON branches(code);
CREATE INDEX idx_branches_is_active ON branches(is_active);
CREATE INDEX idx_branches_network_status ON branches(network_status);

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Employees indexes
CREATE INDEX idx_employees_branch_id ON employees(branch_id);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_onec_id ON employees(onec_id);

-- Employee time logs indexes
CREATE INDEX idx_employee_time_logs_employee_id ON employee_time_logs(employee_id);
CREATE INDEX idx_employee_time_logs_branch_id ON employee_time_logs(branch_id);
CREATE INDEX idx_employee_time_logs_clock_in ON employee_time_logs(clock_in);

-- Categories indexes
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_key ON categories(key);
CREATE INDEX idx_categories_onec_id ON categories(onec_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- Products indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_onec_id ON products(onec_id);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

-- Branch product pricing indexes
CREATE INDEX idx_branch_product_pricing_branch_id ON branch_product_pricing(branch_id);
CREATE INDEX idx_branch_product_pricing_product_id ON branch_product_pricing(product_id);
CREATE INDEX idx_branch_product_pricing_is_available ON branch_product_pricing(is_available);
CREATE INDEX idx_branch_product_pricing_effective_from ON branch_product_pricing(effective_from);
CREATE INDEX idx_branch_product_pricing_effective_until ON branch_product_pricing(effective_until);
CREATE INDEX idx_branch_product_pricing_branch_product ON branch_product_pricing(branch_id, product_id);

-- Branch inventory indexes
CREATE INDEX idx_branch_inventory_branch_id ON branch_inventory(branch_id);
CREATE INDEX idx_branch_inventory_product_id ON branch_inventory(product_id);
CREATE INDEX idx_branch_inventory_quantity ON branch_inventory(quantity_in_stock);
CREATE INDEX idx_branch_inventory_branch_product ON branch_inventory(branch_id, product_id);

-- Stock movements indexes
CREATE INDEX idx_stock_movements_branch_id ON stock_movements(branch_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_movement_type ON stock_movements(movement_type);

-- Customers indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- Transactions indexes
CREATE INDEX idx_transactions_branch_id ON transactions(branch_id);
CREATE INDEX idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_completed_at ON transactions(completed_at);
CREATE INDEX idx_transactions_onec_id ON transactions(onec_id);
CREATE INDEX idx_transactions_transaction_number ON transactions(transaction_number);
CREATE INDEX idx_transactions_branch_date ON transactions(branch_id, completed_at);

-- Transaction items indexes
CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product_id ON transaction_items(product_id);
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);

-- Payments indexes
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_status ON payments(status);

-- Promotions indexes
CREATE INDEX idx_promotions_branch_id ON promotions(branch_id);
CREATE INDEX idx_promotions_product_id ON promotions(product_id);
CREATE INDEX idx_promotions_category_id ON promotions(category_id);
CREATE INDEX idx_promotions_active_dates ON promotions(start_date, end_date) WHERE is_active = true;

-- Branch servers indexes
CREATE INDEX idx_branch_servers_branch_id ON branch_servers(branch_id);
CREATE INDEX idx_branch_servers_status ON branch_servers(status);
CREATE INDEX idx_branch_servers_ip ON branch_servers(ip_address);
CREATE INDEX idx_branch_servers_network_type ON branch_servers(network_type);
CREATE INDEX idx_branch_servers_outbound_api_key ON branch_servers(outbound_api_key) WHERE outbound_api_key IS NOT NULL;

-- Network settings indexes
CREATE INDEX idx_network_settings_key ON network_settings(setting_key);
CREATE INDEX idx_network_settings_category ON network_settings(category);

-- Connection logs indexes
CREATE INDEX idx_connection_logs_source ON connection_health_logs(source_type, source_id);
CREATE INDEX idx_connection_logs_target ON connection_health_logs(target_type, target_id);
CREATE INDEX idx_connection_logs_checked_at ON connection_health_logs(checked_at);

-- API keys indexes
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Branch sync logs indexes
CREATE INDEX idx_branch_sync_logs_branch_id ON branch_sync_logs(branch_id);
CREATE INDEX idx_branch_sync_logs_sync_type ON branch_sync_logs(sync_type);
CREATE INDEX idx_branch_sync_logs_status ON branch_sync_logs(status);
CREATE INDEX idx_branch_sync_logs_started_at ON branch_sync_logs(started_at);
CREATE INDEX idx_branch_sync_logs_branch_type ON branch_sync_logs(branch_id, sync_type);

-- 1C sync logs indexes
CREATE INDEX idx_onec_sync_logs_sync_type ON onec_sync_logs(sync_type);
CREATE INDEX idx_onec_sync_logs_status ON onec_sync_logs(status);
CREATE INDEX idx_onec_sync_logs_started_at ON onec_sync_logs(started_at);

-- System settings indexes
CREATE INDEX idx_system_settings_key ON system_settings(key);

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

-- Function to update API keys updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_chains_updated_at BEFORE UPDATE ON chains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_product_pricing_updated_at BEFORE UPDATE ON branch_product_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_inventory_updated_at BEFORE UPDATE ON branch_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_servers_updated_at BEFORE UPDATE ON branch_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_network_settings_updated_at BEFORE UPDATE ON network_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- API keys updated_at trigger
CREATE TRIGGER trigger_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- =================================================================
-- VIEWS FOR COMMON QUERIES
-- =================================================================

-- Branch summary view
CREATE OR REPLACE VIEW branch_summary AS
SELECT 
    b.id,
    b.name,
    b.code,
    b.is_active,
    b.network_status,
    COUNT(DISTINCT e.id) as employee_count,
    COUNT(DISTINCT bi.product_id) as product_count,
    COALESCE(SUM(t.total_amount), 0) as total_sales_30d,
    MAX(t.completed_at) as last_sale_at,
    b.last_sync_at,
    b.last_health_check,
    COUNT(DISTINCT t.id) as transaction_count_30d
FROM branches b
LEFT JOIN employees e ON b.id = e.branch_id AND e.status = 'active'
LEFT JOIN branch_inventory bi ON b.id = bi.branch_id
LEFT JOIN transactions t ON b.id = t.branch_id AND t.status = 'completed' 
    AND t.completed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.id, b.name, b.code, b.is_active, b.network_status, b.last_sync_at, b.last_health_check;

-- Low stock alert view
CREATE OR REPLACE VIEW low_stock_alert AS
SELECT 
    b.name as branch_name,
    b.code as branch_code,
    p.name as product_name,
    p.sku,
    bi.quantity_in_stock,
    bi.min_stock_level,
    bi.reorder_point,
    bpp.price as current_price
FROM branch_inventory bi
JOIN branches b ON bi.branch_id = b.id
JOIN products p ON bi.product_id = p.id
LEFT JOIN branch_product_pricing bpp ON bi.branch_id = bpp.branch_id AND bi.product_id = bpp.product_id
WHERE bi.quantity_in_stock <= bi.min_stock_level
AND b.is_active = true
AND p.is_active = true
ORDER BY b.name, bi.quantity_in_stock ASC;

-- Product pricing overview view
CREATE OR REPLACE VIEW product_pricing_overview AS
SELECT 
    p.name as product_name,
    p.sku,
    p.base_price,
    b.name as branch_name,
    b.code as branch_code,
    COALESCE(bpp.price, p.base_price) as branch_price,
    COALESCE(bpp.is_available, true) as is_available,
    bpp.discount_percentage,
    bpp.bulk_price,
    bpp.min_quantity_discount
FROM products p
CROSS JOIN branches b
LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND b.id = bpp.branch_id
WHERE p.is_active = true AND b.is_active = true
ORDER BY p.name, b.name;

-- Sales summary view
CREATE OR REPLACE VIEW sales_summary AS
SELECT 
    b.name as branch_name,
    b.code as branch_code,
    DATE(t.completed_at) as sale_date,
    COUNT(t.id) as transaction_count,
    SUM(t.total_amount) as total_sales,
    SUM(t.subtotal) as subtotal,
    SUM(t.tax_amount) as total_tax,
    SUM(t.discount_amount) as total_discounts,
    AVG(t.total_amount) as avg_transaction_value
FROM transactions t
JOIN branches b ON t.branch_id = b.id
WHERE t.status = 'completed'
AND t.completed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.id, b.name, b.code, DATE(t.completed_at)
ORDER BY sale_date DESC, b.name;

-- =================================================================
-- UTILITY FUNCTIONS
-- =================================================================

-- Function to get effective price for a product in a branch (including promotions)
CREATE OR REPLACE FUNCTION get_effective_price(p_branch_id UUID, p_product_id UUID, p_quantity DECIMAL DEFAULT 1)
RETURNS DECIMAL AS $$
DECLARE
    base_price DECIMAL;
    discounted_price DECIMAL;
    promotion_discount DECIMAL DEFAULT 0;
BEGIN
    -- Get base price for this branch
    SELECT COALESCE(bpp.price, p.base_price)
    INTO base_price
    FROM products p
    LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = p_branch_id
    WHERE p.id = p_product_id;
    
    -- Check for active promotions
    SELECT COALESCE(MAX(
        CASE 
            WHEN pr.type = 'percentage_discount' THEN base_price * (pr.discount_percentage / 100)
            WHEN pr.type = 'fixed_discount' THEN pr.discount_amount
            WHEN pr.type = 'bulk_discount' AND p_quantity >= pr.min_quantity THEN base_price * (pr.discount_percentage / 100)
            ELSE 0
        END
    ), 0)
    INTO promotion_discount
    FROM promotions pr
    WHERE pr.is_active = true
    AND NOW() BETWEEN pr.start_date AND pr.end_date
    AND (pr.branch_id IS NULL OR pr.branch_id = p_branch_id)
    AND (pr.product_id IS NULL OR pr.product_id = p_product_id)
    AND (pr.min_quantity IS NULL OR p_quantity >= pr.min_quantity);
    
    discounted_price := base_price - promotion_discount;
    
    RETURN GREATEST(discounted_price, 0); -- Ensure price doesn't go negative
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- COMMENTS FOR DOCUMENTATION
-- =================================================================

COMMENT ON TABLE api_keys IS 'API keys for external system authentication';
COMMENT ON COLUMN api_keys.key_hash IS 'Hashed API key for security';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permission strings (e.g., products:write, inventory:read)';
COMMENT ON COLUMN api_keys.usage_count IS 'Number of times this API key has been used';

COMMENT ON COLUMN branch_servers.api_key IS 'API key that the branch uses to authenticate to chain-core (inbound authentication)';
COMMENT ON COLUMN branch_servers.outbound_api_key IS 'API key that chain-core uses to authenticate to this branch (outbound authentication)';

COMMENT ON TABLE connection_health_logs IS 'Health check logs for monitoring connectivity between systems';
COMMENT ON TABLE branch_servers IS 'Branch servers registered with chain-core for network management';
COMMENT ON TABLE network_settings IS 'System-wide network and connectivity configuration';

-- Update table statistics for query optimization
ANALYZE;

-- =================================================================
-- SUMMARY
-- =================================================================

-- This schema includes 24 tables:
-- 1. chains - Top-level chain organization
-- 2. branches - Individual store locations
-- 3. users - Main office/administrative users
-- 4. employees - Branch employees (aggregated)
-- 5. employee_time_logs - Time tracking
-- 6. categories - Product categories
-- 7. products - Product master data
-- 8. branch_product_pricing - Branch-specific pricing
-- 9. branch_inventory - Stock levels per branch
-- 10. stock_movements - Inventory movements
-- 11. customers - Customer information
-- 12. transactions - Sales transactions
-- 13. transaction_items - Transaction line items
-- 14. payments - Payment information
-- 15. promotions - Sales promotions
-- 16. branch_servers - Network server information
-- 17. network_settings - Network configuration
-- 18. connection_health_logs - Network health monitoring
-- 19. api_keys - Authentication system
-- 20. branch_sync_logs - Branch synchronization logs
-- 21. onec_sync_logs - 1C integration logs
-- 22. system_settings - System configuration
-- 23. sync_history - Legacy compatibility table
-- 24. sync_tasks - Legacy compatibility table

COMMIT;
