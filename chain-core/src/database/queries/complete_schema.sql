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
    name_en VARCHAR(255),
    name_ru VARCHAR(255),
    name_uz VARCHAR(255),
    description TEXT,
    description_en TEXT,
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
    image_paths JSONB, -- Local image file paths for different sizes
    has_image BOOLEAN DEFAULT false, -- Quick flag to check if product has images
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

-- Branch product price sync tracking (tracks which products need price sync to branches)
CREATE TABLE branch_product_price_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    needs_sync BOOLEAN DEFAULT true,
    last_synced_price DECIMAL(10,2),
    last_synced_cost DECIMAL(10,2),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    price_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    loyalty_card_number VARCHAR(50) UNIQUE,
    loyalty_points INTEGER DEFAULT 0,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    is_vip BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
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
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('products', 'inventory', 'transactions', 'employees', 'payment_methods', 'full_sync')),
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

-- =================================================================
-- PAYMENT METHODS MANAGEMENT TABLES
-- =================================================================

-- Payment methods definition table (Cash, Click, Uzum FastPay, Payme)
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method_code VARCHAR(50) UNIQUE NOT NULL, -- 'cash', 'click', 'uzum_fastpay', 'payme'
    method_name VARCHAR(255) NOT NULL,
    method_name_ru VARCHAR(255),
    method_name_uz VARCHAR(255),
    description TEXT,
    description_ru TEXT,
    description_uz TEXT,
    is_active BOOLEAN DEFAULT true,
    requires_qr BOOLEAN DEFAULT false, -- true for Click Pass and Payme QR
    requires_fiscal_receipt BOOLEAN DEFAULT false,
    api_documentation_url VARCHAR(500),
    logo_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Branch payment method configurations (which methods are enabled per branch)
CREATE TABLE branch_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Display order priority
    daily_limit DECIMAL(15,2), -- Optional daily transaction limit
    transaction_limit DECIMAL(15,2), -- Optional per-transaction limit
    enabled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enabled_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, payment_method_id)
);

-- Branch payment credentials (encrypted credentials for each payment method per branch)
CREATE TABLE branch_payment_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE CASCADE,
    credential_key VARCHAR(100) NOT NULL, -- e.g., 'merchant_id', 'service_id', 'secret_key', etc.
    credential_value TEXT NOT NULL, -- Encrypted credential value
    is_encrypted BOOLEAN DEFAULT true,
    is_test_environment BOOLEAN DEFAULT false,
    description TEXT,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, payment_method_id, credential_key)
);

-- Payment transactions tracking (aggregated from all branches)
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id),
    pos_transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    external_transaction_id VARCHAR(255), -- ID from payment provider
    external_order_id VARCHAR(255), -- Order ID from payment provider
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UZS',
    status VARCHAR(50) NOT NULL CHECK (status IN ('initiated', 'pending', 'completed', 'failed', 'cancelled', 'refunded')),
    payment_request_data JSONB, -- Original payment request
    payment_response_data JSONB, -- Response from payment provider
    error_code VARCHAR(100),
    error_message TEXT,
    employee_id UUID REFERENCES employees(id),
    terminal_id VARCHAR(100),
    qr_code_data TEXT, -- QR code content if applicable
    receipt_url VARCHAR(500), -- Link to receipt if provided by payment system
    fiscal_receipt_sent BOOLEAN DEFAULT false,
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment method audit log for security and compliance
CREATE TABLE payment_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id),
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'credentials_updated', 'payment_initiated', 'payment_completed', etc.
    actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('user', 'employee', 'system', 'api')),
    actor_id UUID, -- User ID or Employee ID
    actor_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_data JSONB,
    notes TEXT,
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
CREATE INDEX idx_products_has_image ON products(has_image) WHERE has_image = true;
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

-- Branch product pricing indexes
CREATE INDEX idx_branch_product_pricing_branch_id ON branch_product_pricing(branch_id);
CREATE INDEX idx_branch_product_pricing_product_id ON branch_product_pricing(product_id);
CREATE INDEX idx_branch_product_pricing_is_available ON branch_product_pricing(is_available);
CREATE INDEX idx_branch_product_pricing_effective_from ON branch_product_pricing(effective_from);
CREATE INDEX idx_branch_product_pricing_effective_until ON branch_product_pricing(effective_until);
CREATE INDEX idx_branch_product_pricing_branch_product ON branch_product_pricing(branch_id, product_id);

-- Branch product price sync status indexes
CREATE INDEX idx_price_sync_status_branch_id ON branch_product_price_sync_status(branch_id);
CREATE INDEX idx_price_sync_status_product_id ON branch_product_price_sync_status(product_id);
CREATE INDEX idx_price_sync_status_needs_sync ON branch_product_price_sync_status(needs_sync) WHERE needs_sync = true;
CREATE INDEX idx_price_sync_status_branch_product ON branch_product_price_sync_status(branch_id, product_id);

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
CREATE INDEX idx_customers_loyalty_card_number ON customers(loyalty_card_number);
CREATE INDEX idx_customers_is_active ON customers(is_active);
CREATE INDEX idx_customers_is_vip ON customers(is_vip);
CREATE INDEX idx_customers_name ON customers USING gin(to_tsvector('english', name));

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
-- PAYMENT METHODS INDEXES
-- =================================================================

-- Payment methods indexes
CREATE INDEX idx_payment_methods_code ON payment_methods(method_code);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX idx_payment_methods_sort_order ON payment_methods(sort_order);

-- Branch payment methods indexes
CREATE INDEX idx_branch_payment_methods_branch_id ON branch_payment_methods(branch_id);
CREATE INDEX idx_branch_payment_methods_payment_method_id ON branch_payment_methods(payment_method_id);
CREATE INDEX idx_branch_payment_methods_enabled ON branch_payment_methods(is_enabled);
CREATE INDEX idx_branch_payment_methods_priority ON branch_payment_methods(priority);
CREATE INDEX idx_branch_payment_methods_branch_enabled ON branch_payment_methods(branch_id, is_enabled);

-- Branch payment credentials indexes
CREATE INDEX idx_branch_payment_credentials_branch_id ON branch_payment_credentials(branch_id);
CREATE INDEX idx_branch_payment_credentials_payment_method_id ON branch_payment_credentials(payment_method_id);
CREATE INDEX idx_branch_payment_credentials_credential_key ON branch_payment_credentials(credential_key);
CREATE INDEX idx_branch_payment_credentials_test_env ON branch_payment_credentials(is_test_environment);
CREATE INDEX idx_branch_payment_credentials_branch_method ON branch_payment_credentials(branch_id, payment_method_id);

-- Payment transactions indexes
CREATE INDEX idx_payment_transactions_branch_id ON payment_transactions(branch_id);
CREATE INDEX idx_payment_transactions_payment_method_id ON payment_transactions(payment_method_id);
CREATE INDEX idx_payment_transactions_pos_transaction_id ON payment_transactions(pos_transaction_id);
CREATE INDEX idx_payment_transactions_external_id ON payment_transactions(external_transaction_id);
CREATE INDEX idx_payment_transactions_external_order_id ON payment_transactions(external_order_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_employee_id ON payment_transactions(employee_id);
CREATE INDEX idx_payment_transactions_terminal_id ON payment_transactions(terminal_id);
CREATE INDEX idx_payment_transactions_initiated_at ON payment_transactions(initiated_at);
CREATE INDEX idx_payment_transactions_completed_at ON payment_transactions(completed_at);
CREATE INDEX idx_payment_transactions_expires_at ON payment_transactions(expires_at);
CREATE INDEX idx_payment_transactions_branch_status ON payment_transactions(branch_id, status);
CREATE INDEX idx_payment_transactions_method_status ON payment_transactions(payment_method_id, status);

-- Payment audit log indexes
CREATE INDEX idx_payment_audit_log_branch_id ON payment_audit_log(branch_id);
CREATE INDEX idx_payment_audit_log_payment_method_id ON payment_audit_log(payment_method_id);
CREATE INDEX idx_payment_audit_log_payment_transaction_id ON payment_audit_log(payment_transaction_id);
CREATE INDEX idx_payment_audit_log_action ON payment_audit_log(action);
CREATE INDEX idx_payment_audit_log_actor_type ON payment_audit_log(actor_type);
CREATE INDEX idx_payment_audit_log_actor_id ON payment_audit_log(actor_id);
CREATE INDEX idx_payment_audit_log_created_at ON payment_audit_log(created_at);
CREATE INDEX idx_payment_audit_log_ip_address ON payment_audit_log(ip_address);
CREATE INDEX idx_payment_audit_log_branch_action ON payment_audit_log(branch_id, action);

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

-- Trigger for price sync status updated_at
CREATE TRIGGER update_price_sync_status_updated_at BEFORE UPDATE ON branch_product_price_sync_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers to automatically mark products for sync when prices change
CREATE TRIGGER products_price_change_sync_trigger
    AFTER UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION mark_product_for_price_sync();

CREATE TRIGGER branch_pricing_change_sync_trigger
    AFTER INSERT OR UPDATE ON branch_product_pricing
    FOR EACH ROW
    EXECUTE FUNCTION mark_product_for_price_sync();

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

-- Payment methods triggers
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_payment_methods_updated_at BEFORE UPDATE ON branch_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_payment_credentials_updated_at BEFORE UPDATE ON branch_payment_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
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

-- Branch payment methods overview view
CREATE OR REPLACE VIEW branch_payment_methods_overview AS
SELECT 
    b.id as branch_id,
    b.name as branch_name,
    b.code as branch_code,
    pm.id as payment_method_id,
    pm.method_code,
    pm.method_name,
    pm.method_name_ru,
    pm.method_name_uz,
    bpm.is_enabled,
    bpm.priority,
    bpm.daily_limit,
    bpm.transaction_limit,
    bpm.enabled_at,
    bpm.notes,
    COUNT(pt.id) as transaction_count_30d,
    COALESCE(SUM(pt.amount), 0) as total_amount_30d,
    COUNT(CASE WHEN pt.status = 'completed' THEN 1 END) as successful_transactions_30d,
    COUNT(CASE WHEN pt.status = 'failed' THEN 1 END) as failed_transactions_30d
FROM branches b
CROSS JOIN payment_methods pm
LEFT JOIN branch_payment_methods bpm ON b.id = bpm.branch_id AND pm.id = bpm.payment_method_id
LEFT JOIN payment_transactions pt ON b.id = pt.branch_id AND pm.id = pt.payment_method_id 
    AND pt.initiated_at >= CURRENT_DATE - INTERVAL '30 days'
WHERE b.is_active = true AND pm.is_active = true
GROUP BY b.id, b.name, b.code, pm.id, pm.method_code, pm.method_name, pm.method_name_ru, pm.method_name_uz,
         bpm.is_enabled, bpm.priority, bpm.daily_limit, bpm.transaction_limit, bpm.enabled_at, bpm.notes
ORDER BY b.name, bpm.priority NULLS LAST, pm.sort_order;

-- Payment transactions summary view
CREATE OR REPLACE VIEW payment_transactions_summary AS
SELECT 
    pt.id,
    b.name as branch_name,
    b.code as branch_code,
    pm.method_name,
    pm.method_code,
    pt.external_transaction_id,
    pt.external_order_id,
    pt.amount,
    pt.currency,
    pt.status,
    pt.error_code,
    pt.error_message,
    e.name as employee_name,
    pt.terminal_id,
    pt.initiated_at,
    pt.completed_at,
    pt.expires_at,
    CASE 
        WHEN pt.completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (pt.completed_at - pt.initiated_at))
        ELSE NULL 
    END as processing_time_seconds,
    pt.fiscal_receipt_sent
FROM payment_transactions pt
JOIN branches b ON pt.branch_id = b.id
JOIN payment_methods pm ON pt.payment_method_id = pm.id
LEFT JOIN employees e ON pt.employee_id = e.id
ORDER BY pt.initiated_at DESC;

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

-- Function to mark product for price sync when price changes
CREATE OR REPLACE FUNCTION mark_product_for_price_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark all branches to sync this product when base price changes
    IF TG_TABLE_NAME = 'products' THEN
        IF (OLD.base_price != NEW.base_price OR OLD.cost != NEW.cost) THEN
            INSERT INTO branch_product_price_sync_status (branch_id, product_id, needs_sync, price_changed_at)
            SELECT b.id, NEW.id, true, NOW()
            FROM branches b
            WHERE b.is_active = true
            ON CONFLICT (branch_id, product_id) 
            DO UPDATE SET 
                needs_sync = true, 
                price_changed_at = NOW(),
                updated_at = NOW();
        END IF;
    END IF;
    
    -- Mark specific branch to sync when branch-specific pricing changes
    IF TG_TABLE_NAME = 'branch_product_pricing' THEN
        IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD.price != NEW.price OR OLD.cost != NEW.cost)) THEN
            INSERT INTO branch_product_price_sync_status (branch_id, product_id, needs_sync, price_changed_at)
            VALUES (NEW.branch_id, NEW.product_id, true, NOW())
            ON CONFLICT (branch_id, product_id) 
            DO UPDATE SET 
                needs_sync = true, 
                price_changed_at = NOW(),
                updated_at = NOW();
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to mark products as synced
CREATE OR REPLACE FUNCTION mark_products_as_synced(
    p_branch_id UUID,
    p_product_ids UUID[],
    p_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE branch_product_price_sync_status 
    SET 
        needs_sync = false,
        last_synced_at = p_synced_at,
        updated_at = NOW()
    WHERE branch_id = p_branch_id 
        AND product_id = ANY(p_product_ids)
        AND needs_sync = true;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get products that need price sync for a branch
CREATE OR REPLACE FUNCTION get_products_needing_price_sync(p_branch_id UUID)
RETURNS TABLE (
    product_id UUID,
    sku VARCHAR,
    barcode VARCHAR,
    current_price DECIMAL(10,2),
    current_cost DECIMAL(10,2),
    last_synced_price DECIMAL(10,2),
    last_synced_cost DECIMAL(10,2),
    price_changed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as product_id,
        p.sku,
        p.barcode,
        COALESCE(bpp.price, p.base_price) as current_price,
        COALESCE(bpp.cost, p.cost) as current_cost,
        bpss.last_synced_price,
        bpss.last_synced_cost,
        bpss.price_changed_at
    FROM products p
    INNER JOIN branch_product_price_sync_status bpss ON p.id = bpss.product_id
    LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = p_branch_id
    WHERE bpss.branch_id = p_branch_id
        AND bpss.needs_sync = true
        AND p.is_active = true 
        AND p.barcode IS NOT NULL
    ORDER BY bpss.price_changed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =================================================================
-- COMMENTS FOR DOCUMENTATION
-- =================================================================

COMMENT ON TABLE api_keys IS 'API keys for external system authentication';
COMMENT ON COLUMN api_keys.key_hash IS 'Hashed API key for security';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permission strings (e.g., products:write, inventory:read)';
COMMENT ON COLUMN api_keys.usage_count IS 'Number of times this API key has been used';

COMMENT ON TABLE branch_product_price_sync_status IS 'Tracks which products need price synchronization to specific branches';
COMMENT ON COLUMN branch_product_price_sync_status.needs_sync IS 'True when product price has changed and needs to be synced to branch';
COMMENT ON COLUMN branch_product_price_sync_status.last_synced_price IS 'The price that was last successfully synced to the branch';
COMMENT ON COLUMN branch_product_price_sync_status.last_synced_cost IS 'The cost that was last successfully synced to the branch';
COMMENT ON COLUMN branch_product_price_sync_status.price_changed_at IS 'When the price was last changed (triggering need for sync)';

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

-- This schema includes 30 tables:
-- CORE BUSINESS TABLES:
-- 1. chains - Top-level chain organization
-- 2. branches - Individual store locations
-- 3. users - Main office/administrative users
-- 4. employees - Branch employees (aggregated)
-- 5. employee_time_logs - Time tracking
-- 6. categories - Product categories
-- 7. products - Product master data
-- 8. branch_product_pricing - Branch-specific pricing
-- 9. branch_product_price_sync_status - Price synchronization tracking
-- 10. branch_inventory - Stock levels per branch
-- 11. stock_movements - Inventory movements
-- 12. customers - Customer information
-- 13. transactions - Sales transactions
-- 14. transaction_items - Transaction line items
-- 15. payments - Payment information
-- 16. promotions - Sales promotions

-- NETWORK AND INFRASTRUCTURE TABLES:
-- 17. branch_servers - Network server information
-- 18. network_settings - Network configuration
-- 19. connection_health_logs - Network health monitoring

-- AUTHENTICATION AND SECURITY TABLES:
-- 20. api_keys - Authentication system

-- SYNC AND LOGGING TABLES:
-- 21. branch_sync_logs - Branch synchronization logs
-- 22. onec_sync_logs - 1C integration logs
-- 23. system_settings - System configuration

-- PAYMENT METHODS MANAGEMENT TABLES:
-- 24. payment_methods - Payment method definitions (Click, Uzum FastPay, Payme)
-- 25. branch_payment_methods - Branch-specific payment method configurations
-- 26. branch_payment_credentials - Encrypted payment credentials per branch
-- 27. payment_transactions - Payment transaction tracking (aggregated from branches)
-- 28. payment_audit_log - Payment system audit trail

COMMIT;
