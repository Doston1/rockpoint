-- Sample data for RockPoint Chain Core
-- Run this file after schema.sql to populate the database with test data
-- PostgreSQL 14+

-- Start with a clean transaction
BEGIN;

-- Clear all existing data (in reverse dependency order)
TRUNCATE TABLE onec_sync_logs CASCADE;
TRUNCATE TABLE branch_sync_logs CASCADE;
TRUNCATE TABLE system_settings CASCADE;
TRUNCATE TABLE promotions CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE transaction_items CASCADE;
TRUNCATE TABLE transactions CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE branch_inventory CASCADE;
TRUNCATE TABLE branch_product_pricing CASCADE;
TRUNCATE TABLE employees CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE categories CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE branches CASCADE;

-- Insert sample branches
INSERT INTO branches (name, code, address, phone, email, manager_name, timezone, currency, tax_rate, api_endpoint, api_key) VALUES
('Downtown Store', 'DT001', '123 Main Street, Downtown', '+1-555-0101', 'downtown@rockpoint.com', 'John Smith', 'America/New_York', 'USD', 0.0875, 'http://localhost:3000/api', 'dt001_api_key_123'),
('Mall Location', 'ML002', '456 Shopping Mall, Level 2', '+1-555-0102', 'mall@rockpoint.com', 'Sarah Johnson', 'America/New_York', 'USD', 0.0875, 'http://localhost:3001/api', 'ml002_api_key_456'),
('Airport Terminal', 'AP003', '789 Airport Terminal B', '+1-555-0103', 'airport@rockpoint.com', 'Mike Davis', 'America/New_York', 'USD', 0.0875, 'http://localhost:3002/api', 'ap003_api_key_789');

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, name, role, permissions) 
VALUES (
    'admin', 
    'admin@rockpoint.com',
    '$2a$12$U.YVJRPzrzwZ1qLpsE1EreHpOClgPqNRy5MFKjcV0ETH44FyEPrMO', -- bcrypt hash of 'admin123'
    'System Administrator',
    'super_admin',
    ARRAY['*'] -- All permissions
);

-- Insert sample categories
INSERT INTO categories (key, name, name_ru, name_uz, description, sort_order) VALUES
('beverages', 'Beverages', 'Напитки', 'Ichimliklar', 'Soft drinks, juices, water', 1),
('snacks', 'Snacks', 'Закуски', 'Gazaklar', 'Chips, cookies, nuts', 2),
('dairy', 'Dairy', 'Молочные продукты', 'Sut mahsulotlari', 'Milk, cheese, yogurt', 3),
('bakery', 'Bakery', 'Хлебобулочные', 'Non mahsulotlari', 'Bread, pastries, baked goods', 4),
('personal_care', 'Personal Care', 'Личная гигиена', 'Shaxsiy gigiyena', 'Toiletries, hygiene products', 5),
('household', 'Household', 'Бытовые товары', 'Uy-ro''zg''or buyumlari', 'Cleaning supplies, paper products', 6),
('electronics', 'Electronics', 'Электроника', 'Elektronika', 'Small electronics, accessories', 7);

-- Insert sample products (based on branch-core sample-products.sql)
INSERT INTO products (sku, barcode, name, name_ru, name_uz, description, description_ru, description_uz, category_id, brand, base_price, cost, image_url) 
SELECT 
    'COCA-500ML', '123456789012', 'Coca Cola 500ml', 'Кока-Кола 500мл', 'Koka-Kola 500ml', 
    'Classic Coca Cola 500ml bottle', 'Классическая Кока-Кола 500мл бутылка', 'Klassik Koka-Kola 500ml shisha',
    c.id, 'Coca Cola', 2.50, 1.20, 'https://example.com/coca-cola.jpg'
FROM categories c WHERE c.key = 'beverages'

UNION ALL

SELECT 
    'PEPSI-500ML', '123456789013', 'Pepsi 500ml', 'Пепси 500мл', 'Pepsi 500ml',
    'Pepsi Cola 500ml bottle', 'Пепси-Кола 500мл бутылка', 'Pepsi-Kola 500ml shisha',
    c.id, 'Pepsi', 2.45, 1.18, 'https://example.com/pepsi.jpg'
FROM categories c WHERE c.key = 'beverages'

UNION ALL

SELECT 
    'WATER-1L', '123456789014', 'Water 1L', 'Вода 1л', 'Suv 1l',
    'Pure drinking water 1 liter', 'Чистая питьевая вода 1 литр', 'Toza ichimlik suvi 1 litr',
    c.id, 'Pure Life', 1.00, 0.40, 'https://example.com/water.jpg'
FROM categories c WHERE c.key = 'beverages'

UNION ALL

SELECT 
    'OJ-1L', '123456789015', 'Orange Juice 1L', 'Апельсиновый сок 1л', 'Apelsin sharbati 1l',
    'Fresh orange juice 1 liter', 'Свежий апельсиновый сок 1 литр', 'Yangi apelsin sharbati 1 litr',
    c.id, 'Tropicana', 3.99, 2.10, 'https://example.com/orange-juice.jpg'
FROM categories c WHERE c.key = 'beverages'

UNION ALL

SELECT 
    'CHIPS-ORG', '223456789012', 'Chips Original', 'Чипсы оригинальные', 'Chips original',
    'Original flavor potato chips', 'Картофельные чипсы оригинальный вкус', 'Original ta''mli kartoshka chipslari',
    c.id, 'Lays', 3.50, 1.75, 'https://example.com/chips.jpg'
FROM categories c WHERE c.key = 'snacks'

UNION ALL

SELECT 
    'SNICKERS', '223456789013', 'Chocolate Bar', 'Шоколадный батончик', 'Shokolad',
    'Milk chocolate with peanuts', 'Молочный шоколад с арахисом', 'Yeryong''oqli sut shokoladi',
    c.id, 'Snickers', 2.99, 1.50, 'https://example.com/snickers.jpg'
FROM categories c WHERE c.key = 'snacks'

UNION ALL

SELECT 
    'OREO-PACK', '223456789014', 'Cookies Pack', 'Печенье упаковка', 'Pechene paketi',
    'Chocolate sandwich cookies', 'Шоколадное печенье-сэндвич', 'Shokoladli sendvich pechene',
    c.id, 'Oreo', 4.50, 2.25, 'https://example.com/oreo.jpg'
FROM categories c WHERE c.key = 'snacks'

UNION ALL

SELECT 
    'PEANUTS', '223456789015', 'Peanuts Roasted', 'Арахис жареный', 'Yeryong''oq qovurilgan',
    'Salted roasted peanuts', 'Соленый жареный арахис', 'Tuzlangan qovurilgan yeryong''oq',
    c.id, 'Planters', 2.25, 1.10, 'https://example.com/peanuts.jpg'
FROM categories c WHERE c.key = 'snacks'

UNION ALL

SELECT 
    'MILK-1L', '323456789012', 'Milk 1L', 'Молоко 1л', 'Sut 1l',
    'Whole milk 1 liter', 'Цельное молоко 1 литр', 'To''liq sut 1 litr',
    c.id, 'Farm Fresh', 3.25, 2.00, 'https://example.com/milk.jpg'
FROM categories c WHERE c.key = 'dairy'

UNION ALL

SELECT 
    'YOGURT-VAN', '323456789013', 'Yogurt Vanilla', 'Йогурт ванильный', 'Yogurt vanil',
    'Vanilla flavored yogurt', 'Йогурт с ванильным вкусом', 'Vanil ta''mli yogurt',
    c.id, 'Danone', 1.99, 0.95, 'https://example.com/yogurt.jpg'
FROM categories c WHERE c.key = 'dairy';

-- Insert sample employees for each branch
INSERT INTO employees (employee_id, branch_id, name, role, phone, email, hire_date, salary, pin_hash, status)
SELECT 
    'EMP001', b.id, 'Alice Manager', 'manager', '+1-555-1001', 'alice@rockpoint.com', 
    '2023-01-15'::DATE, 45000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
FROM branches b WHERE b.code = 'DT001'

UNION ALL

SELECT 
    'EMP002', b.id, 'Bob Cashier', 'cashier', '+1-555-1002', 'bob@rockpoint.com',
    '2023-02-01'::DATE, 28000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
FROM branches b WHERE b.code = 'DT001'

UNION ALL

SELECT 
    'EMP003', b.id, 'Carol Supervisor', 'supervisor', '+1-555-2001', 'carol@rockpoint.com',
    '2023-01-20'::DATE, 38000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
FROM branches b WHERE b.code = 'ML002'

UNION ALL

SELECT 
    'EMP004', b.id, 'David Cashier', 'cashier', '+1-555-2002', 'david@rockpoint.com',
    '2023-03-01'::DATE, 28000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
FROM branches b WHERE b.code = 'ML002'

UNION ALL

SELECT 
    'EMP005', b.id, 'Eva Manager', 'manager', '+1-555-3001', 'eva@rockpoint.com',
    '2023-01-10'::DATE, 47000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
FROM branches b WHERE b.code = 'AP003';

-- Insert branch-specific pricing (different prices per branch)
INSERT INTO branch_product_pricing (branch_id, product_id, price, cost, is_available, discount_percentage)
SELECT 
    b.id, p.id, 
    CASE b.code
        WHEN 'DT001' THEN p.base_price -- Downtown: base price
        WHEN 'ML002' THEN p.base_price * 1.1 -- Mall: 10% markup
        WHEN 'AP003' THEN p.base_price * 1.2 -- Airport: 20% markup
    END as price,
    p.cost,
    true,
    CASE b.code
        WHEN 'DT001' THEN 0 -- No discount
        WHEN 'ML002' THEN 5 -- 5% weekend discount
        WHEN 'AP003' THEN 0 -- No discount
    END as discount_percentage
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;

-- Insert sample inventory for each branch
INSERT INTO branch_inventory (branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level, reorder_point)
SELECT 
    b.id, p.id,
    CASE b.code
        WHEN 'DT001' THEN 150 + (RANDOM() * 100)::INT -- Downtown: 150-250
        WHEN 'ML002' THEN 100 + (RANDOM() * 80)::INT  -- Mall: 100-180
        WHEN 'AP003' THEN 50 + (RANDOM() * 50)::INT   -- Airport: 50-100
    END as quantity_in_stock,
    CASE p.sku
        WHEN 'COCA-500ML' THEN 20
        WHEN 'PEPSI-500ML' THEN 20
        WHEN 'WATER-1L' THEN 30
        WHEN 'OJ-1L' THEN 10
        WHEN 'CHIPS-ORG' THEN 15
        WHEN 'SNICKERS' THEN 10
        WHEN 'OREO-PACK' THEN 8
        WHEN 'PEANUTS' THEN 5
        WHEN 'MILK-1L' THEN 12
        WHEN 'YOGURT-VAN' THEN 8
        ELSE 10
    END as min_stock_level,
    CASE p.sku
        WHEN 'COCA-500ML' THEN 200
        WHEN 'PEPSI-500ML' THEN 200
        WHEN 'WATER-1L' THEN 300
        WHEN 'OJ-1L' THEN 100
        WHEN 'CHIPS-ORG' THEN 150
        WHEN 'SNICKERS' THEN 100
        WHEN 'OREO-PACK' THEN 80
        WHEN 'PEANUTS' THEN 50
        WHEN 'MILK-1L' THEN 120
        WHEN 'YOGURT-VAN' THEN 80
        ELSE 100
    END as max_stock_level,
    CASE p.sku
        WHEN 'COCA-500ML' THEN 30
        WHEN 'PEPSI-500ML' THEN 30
        WHEN 'WATER-1L' THEN 45
        WHEN 'OJ-1L' THEN 15
        WHEN 'CHIPS-ORG' THEN 20
        WHEN 'SNICKERS' THEN 15
        WHEN 'OREO-PACK' THEN 12
        WHEN 'PEANUTS' THEN 8
        WHEN 'MILK-1L' THEN 18
        WHEN 'YOGURT-VAN' THEN 12
        ELSE 15
    END as reorder_point
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;

-- Insert sample customers
INSERT INTO customers (name, email, phone, loyalty_points, total_spent) VALUES
('John Customer', 'john.customer@email.com', '+1-555-9001', 150, 75.50),
('Jane Smith', 'jane.smith@email.com', '+1-555-9002', 320, 160.75),
('Mike Johnson', 'mike.johnson@email.com', '+1-555-9003', 85, 42.25),
('Sarah Williams', 'sarah.williams@email.com', '+1-555-9004', 220, 110.00),
('Robert Brown', 'robert.brown@email.com', '+1-555-9005', 180, 90.30);

-- Insert sample transactions with different pricing scenarios
INSERT INTO transactions (branch_id, transaction_number, employee_id, customer_id, terminal_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, status, completed_at)
SELECT * FROM (
    SELECT 
        b.id,
        'TXN000001',
        e.id,
        (SELECT id FROM customers ORDER BY RANDOM() LIMIT 1),
        'TERM01',
        25.47,
        2.23,
        1.27, -- $1.27 discount applied
        26.43,
        'card',
        'completed',
        NOW() - INTERVAL '2 hours'
    FROM branches b
    JOIN employees e ON b.id = e.branch_id
    WHERE b.code = 'DT001' AND e.role = 'cashier'
    LIMIT 1
) sub1

UNION ALL

SELECT * FROM (
    SELECT 
        b.id,
        'TXN000002',
        e.id,
        NULL::UUID, -- No customer loyalty card - cast NULL to UUID
        'TERM02',
        15.98,
        1.40,
        0,
        17.38,
        'cash',
        'completed',
        NOW() - INTERVAL '1 hour'
    FROM branches b
    JOIN employees e ON b.id = e.branch_id
    WHERE b.code = 'ML002' AND e.role = 'cashier'
    LIMIT 1
) sub2

UNION ALL

SELECT * FROM (
    SELECT 
        b.id,
        'TXN000003',
        e.id,
        (SELECT id FROM customers ORDER BY RANDOM() LIMIT 1),
        'TERM01',
        32.50,
        2.85,
        0,
        35.35,
        'card',
        'completed',
        NOW() - INTERVAL '30 minutes'
    FROM branches b
    JOIN employees e ON b.id = e.branch_id
    WHERE b.code = 'AP003' AND e.role = 'manager'
    LIMIT 1
) sub3;

-- Insert sample transaction items showing bulk pricing example
-- Transaction 1: Customer buys 2x Coca Cola, gets bulk discount
INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, original_price, unit_cost, discount_amount, tax_amount, total_amount, promotion_applied)
SELECT 
    t.id,
    p.id,
    2, -- Buy 2 Coca Colas
    2.25, -- Discounted price ($0.25 off each)
    2.50, -- Original price
    1.20,
    0.50, -- Total discount ($0.25 × 2)
    0.44, -- Tax on discounted amount
    4.94,
    'Buy 2+ Get 10% Off'
FROM transactions t
JOIN products p ON p.sku = 'COCA-500ML'
WHERE t.transaction_number = 'TXN000001'

UNION ALL

-- Add chips to same transaction
SELECT 
    t.id,
    p.id,
    1,
    3.50, -- Regular price
    3.50,
    1.75,
    0,
    0.31,
    3.81,
    NULL
FROM transactions t
JOIN products p ON p.sku = 'CHIPS-ORG'
WHERE t.transaction_number = 'TXN000001'

UNION ALL

-- Add snickers
SELECT 
    t.id,
    p.id,
    1,
    2.99,
    2.99,
    1.50,
    0,
    0.26,
    3.25,
    NULL
FROM transactions t
JOIN products p ON p.sku = 'SNICKERS'
WHERE t.transaction_number = 'TXN000001';

-- Insert corresponding payments
INSERT INTO payments (transaction_id, method, amount, reference_number, status)
SELECT t.id, t.payment_method, t.total_amount, 
    CASE 
        WHEN t.payment_method = 'card' THEN 'CARD_' || EXTRACT(EPOCH FROM NOW())::TEXT
        ELSE NULL
    END,
    'completed'
FROM transactions t;

-- Insert sample promotions
INSERT INTO promotions (name, description, type, branch_id, product_id, category_id, discount_percentage, min_quantity, start_date, end_date, is_active)
SELECT 
    'Buy 2+ Coca Cola Get 10% Off',
    'Get 10% discount when buying 2 or more Coca Cola',
    'bulk_discount',
    NULL, -- Chain-wide promotion
    p.id,
    NULL, -- Product-specific, not category-specific
    10.00,
    2,
    NOW() - INTERVAL '1 week',
    NOW() + INTERVAL '1 month',
    true
FROM products p WHERE p.sku = 'COCA-500ML'

UNION ALL

SELECT 
    'Weekend Mall Special',
    '5% off all snacks during weekends at Mall location',
    'percentage_discount',
    b.id,
    NULL, -- Category-wide
    c.id, -- Category-specific promotion
    5.00,
    1,
    NOW() - INTERVAL '1 week',
    NOW() + INTERVAL '2 months',
    true
FROM branches b 
CROSS JOIN categories c
WHERE b.code = 'ML002' AND c.key = 'snacks';

-- Insert system settings
INSERT INTO system_settings (key, value, description) VALUES
('currency', 'USD', 'Default currency for the chain'),
('tax_rate', '0.0875', 'Default tax rate (8.75%)'),
('low_stock_threshold', '10', 'Default low stock threshold'),
('backup_retention_days', '30', 'Number of days to retain backups'),
('loyalty_points_ratio', '100', 'Points earned per $1 spent'),
('bulk_discount_threshold', '2', 'Minimum quantity for bulk discounts'),
('sync_batch_size', '1000', 'Number of records to sync in each batch'),
('max_transaction_items', '100', 'Maximum items per transaction'),
('session_timeout_minutes', '60', 'User session timeout in minutes'),
('enable_loyalty_program', 'true', 'Enable customer loyalty program');

-- Insert sample sync logs
INSERT INTO branch_sync_logs (branch_id, sync_type, direction, status, records_processed, initiated_by, started_at, completed_at)
SELECT * FROM (
    SELECT 
        b.id, 'products', 'to_branch', 'completed', 10, u.id, 
        NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '30 seconds'
    FROM branches b, users u 
    WHERE b.code = 'DT001' AND u.username = 'admin'
    LIMIT 1
) sub1

UNION ALL

SELECT * FROM (
    SELECT 
        b.id, 'inventory', 'from_branch', 'completed', 25, u.id,
        NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '45 seconds'
    FROM branches b, users u 
    WHERE b.code = 'ML002' AND u.username = 'admin'
    LIMIT 1
) sub2;

INSERT INTO onec_sync_logs (sync_type, direction, status, records_processed, started_at, completed_at)
VALUES 
('products', 'import', 'completed', 10, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours' + INTERVAL '2 minutes'),
('transactions', 'export', 'completed', 15, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '1 minute');

-- Final verification: Show sample data counts
DO $$
BEGIN
    RAISE NOTICE '=== SAMPLE DATA LOADED ===';
    RAISE NOTICE 'Branches: % | Categories: % | Products: %', 
        (SELECT COUNT(*) FROM branches),
        (SELECT COUNT(*) FROM categories),
        (SELECT COUNT(*) FROM products);
    RAISE NOTICE 'Employees: % | Customers: % | Transactions: % | Transaction Items: %',
        (SELECT COUNT(*) FROM employees),
        (SELECT COUNT(*) FROM customers),
        (SELECT COUNT(*) FROM transactions),
        (SELECT COUNT(*) FROM transaction_items);
    RAISE NOTICE 'Branch Inventory Records: % | Branch Pricing Records: % | Active Promotions: %',
        (SELECT COUNT(*) FROM branch_inventory),
        (SELECT COUNT(*) FROM branch_product_pricing),
        (SELECT COUNT(*) FROM promotions WHERE is_active = true);
    RAISE NOTICE '=== Sample data ready for testing ===';
END $$;

-- Example usage of the pricing function:
-- SELECT get_effective_price((SELECT id FROM branches WHERE code = 'DT001'), (SELECT id FROM products WHERE sku = 'COCA-500ML'), 2);
-- This will return the effective price for 2 Coca Colas at Downtown branch, including bulk discount

COMMIT;
