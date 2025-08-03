-- Database schema for RockPoint Chain Core
-- PostgreSQL 14+
-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS branch_sync_logs CASCADE;
DROP TABLE IF EXISTS onec_sync_logs CASCADE;
DROP TABLE IF EXISTS branch_product_pricing CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS branch_inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS employee_time_logs CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Branches table (removed chain_id - single chain system)
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

-- Create indexes for optimal performance
CREATE INDEX idx_branches_code ON branches(code);
CREATE INDEX idx_branches_is_active ON branches(is_active);

CREATE INDEX idx_employees_branch_id ON employees(branch_id);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_onec_id ON employees(onec_id);

CREATE INDEX idx_employee_time_logs_employee_id ON employee_time_logs(employee_id);
CREATE INDEX idx_employee_time_logs_branch_id ON employee_time_logs(branch_id);
CREATE INDEX idx_employee_time_logs_clock_in ON employee_time_logs(clock_in);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_key ON categories(key);
CREATE INDEX idx_categories_onec_id ON categories(onec_id);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_onec_id ON products(onec_id);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

CREATE INDEX idx_branch_product_pricing_branch_id ON branch_product_pricing(branch_id);
CREATE INDEX idx_branch_product_pricing_product_id ON branch_product_pricing(product_id);
CREATE INDEX idx_branch_product_pricing_is_available ON branch_product_pricing(is_available);
CREATE INDEX idx_branch_product_pricing_effective_from ON branch_product_pricing(effective_from);
CREATE INDEX idx_branch_product_pricing_effective_until ON branch_product_pricing(effective_until);

CREATE INDEX idx_branch_inventory_branch_id ON branch_inventory(branch_id);
CREATE INDEX idx_branch_inventory_product_id ON branch_inventory(product_id);
CREATE INDEX idx_branch_inventory_quantity ON branch_inventory(quantity_in_stock);

CREATE INDEX idx_stock_movements_branch_id ON stock_movements(branch_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_movement_type ON stock_movements(movement_type);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE INDEX idx_transactions_branch_id ON transactions(branch_id);
CREATE INDEX idx_transactions_employee_id ON transactions(employee_id);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_completed_at ON transactions(completed_at);
CREATE INDEX idx_transactions_onec_id ON transactions(onec_id);
CREATE INDEX idx_transactions_transaction_number ON transactions(transaction_number);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product_id ON transaction_items(product_id);

CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_promotions_branch_id ON promotions(branch_id);
CREATE INDEX idx_promotions_product_id ON promotions(product_id);
CREATE INDEX idx_promotions_category_id ON promotions(category_id);
CREATE INDEX idx_promotions_active_dates ON promotions(start_date, end_date) WHERE is_active = true;

CREATE INDEX idx_branch_sync_logs_branch_id ON branch_sync_logs(branch_id);
CREATE INDEX idx_branch_sync_logs_sync_type ON branch_sync_logs(sync_type);
CREATE INDEX idx_branch_sync_logs_status ON branch_sync_logs(status);
CREATE INDEX idx_branch_sync_logs_started_at ON branch_sync_logs(started_at);

CREATE INDEX idx_onec_sync_logs_sync_type ON onec_sync_logs(sync_type);
CREATE INDEX idx_onec_sync_logs_status ON onec_sync_logs(status);
CREATE INDEX idx_onec_sync_logs_started_at ON onec_sync_logs(started_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
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

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW branch_summary AS
SELECT 
    b.id,
    b.name,
    b.code,
    b.is_active,
    COUNT(DISTINCT e.id) as employee_count,
    COUNT(DISTINCT bi.product_id) as product_count,
    COALESCE(SUM(t.total_amount), 0) as total_sales_30d,
    MAX(t.completed_at) as last_sale_at,
    b.last_sync_at,
    COUNT(DISTINCT t.id) as transaction_count_30d
FROM branches b
LEFT JOIN employees e ON b.id = e.branch_id AND e.status = 'active'
LEFT JOIN branch_inventory bi ON b.id = bi.branch_id
LEFT JOIN transactions t ON b.id = t.branch_id AND t.status = 'completed' 
    AND t.completed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.id, b.name, b.code, b.is_active, b.last_sync_at;

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

-- Create a function to get effective price for a product in a branch (including promotions)
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch_product ON branch_inventory(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_branch_product_pricing_branch_product ON branch_product_pricing(branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_date ON transactions(branch_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_branch_sync_logs_branch_type ON branch_sync_logs(branch_id, sync_type);

-- Update table statistics for query optimization
ANALYZE;

COMMIT;
