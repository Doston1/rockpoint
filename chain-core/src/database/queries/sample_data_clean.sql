-- Clean Sample Data for RockPoint Chain Core
-- This file contains sample data with the new image schema

BEGIN;

-- Clear existing data
DELETE FROM payments;
DELETE FROM transaction_items;
DELETE FROM transactions;
DELETE FROM stock_movements;
DELETE FROM branch_inventory;
DELETE FROM branch_product_price_sync_status;
DELETE FROM branch_product_pricing;
DELETE FROM employee_time_logs;
DELETE FROM employees;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM customers;
DELETE FROM promotions;
DELETE FROM payment_audit_log;
DELETE FROM payment_transactions;
DELETE FROM branch_payment_credentials;
DELETE FROM branch_payment_methods;
DELETE FROM payment_methods;
DELETE FROM branch_sync_logs;
DELETE FROM onec_sync_logs;
DELETE FROM connection_health_logs;
DELETE FROM branch_servers;
DELETE FROM network_settings;
DELETE FROM api_keys;
DELETE FROM system_settings;
DELETE FROM users;
DELETE FROM branches;
DELETE FROM chains;

-- Insert chain information
INSERT INTO chains (name, code, description, headquarters_address, phone, email, website, timezone, base_currency) VALUES
('RockPoint Retail Chain', 'RPC001', 'Modern retail chain management system', '123 Corporate Plaza, Business District', '+1-555-0100', 'headquarters@rockpoint.com', 'https://rockpoint.com', 'America/New_York', 'USD');

-- Insert sample branches
INSERT INTO branches (name, code, address, phone, email, manager_name, timezone, currency, tax_rate, api_endpoint, api_key, server_ip, server_port, network_status) VALUES
('Downtown Store', 'DT001', '123 Main Street, Downtown', '+1-555-0101', 'downtown@rockpoint.com', 'John Smith', 'America/New_York', 'USD', 0.0875, 'http://localhost:3000/api', 'dt001_api_key_123', '127.0.0.1', 3000, 'online'),
('Mall Location', 'ML002', '456 Shopping Mall, Level 2', '+1-555-0102', 'mall@rockpoint.com', 'Sarah Johnson', 'America/New_York', 'USD', 0.0875, 'http://localhost:3001/api', 'ml002_api_key_456', '127.0.0.1', 3001, 'online'),
('Airport Terminal', 'AP003', '789 Airport Terminal B', '+1-555-0103', 'airport@rockpoint.com', 'Mike Davis', 'America/New_York', 'USD', 0.0875, 'http://localhost:3002/api', 'ap003_api_key_789', '127.0.0.1', 3002, 'offline');

-- Insert default admin user
INSERT INTO users (username, email, password_hash, name, role, permissions) VALUES 
('admin', 'admin@rockpoint.com', '$2a$12$U.YVJRPzrzwZ1qLpsE1EreHpOClgPqNRy5MFKjcV0ETH44FyEPrMO', 'System Administrator', 'super_admin', ARRAY['*']);

-- Insert sample categories
INSERT INTO categories (key, name, name_en, name_ru, name_uz, description, description_en, description_ru, description_uz, sort_order) VALUES
('beverages', 'Beverages', 'Beverages', 'Напитки', 'Ichimliklar', 'Soft drinks, juices, water', 'Soft drinks, juices, water', 'Безалкогольные напитки, соки, вода', 'Alkogolsiz ichimliklar, sharbatlar, suv', 1),
('snacks', 'Snacks', 'Snacks', 'Закуски', 'Gazaklar', 'Chips, cookies, nuts', 'Chips, cookies, nuts', 'Чипсы, печенье, орехи', 'Chiplar, pechene, yong''oqlar', 2),
('dairy', 'Dairy', 'Dairy', 'Молочные продукты', 'Sut mahsulotlari', 'Milk, cheese, yogurt', 'Milk, cheese, yogurt', 'Молоко, сыр, йогурт', 'Sut, pishloq, yogurt', 3),
('electronics', 'Electronics', 'Electronics', 'Электроника', 'Elektronika', 'Small electronics, accessories', 'Small electronics, accessories', 'Мелкая электроника, аксессуары', 'Kichik elektronika, aksessuarlar', 4);

-- Insert sample products with new image schema
INSERT INTO products (sku, barcode, name, name_en, name_ru, name_uz, description, description_en, description_ru, description_uz, category_id, brand, base_price, cost, image_paths, has_image) 
VALUES 
    -- Beverages (with sample images)
    ('COCA-500ML', '123456789012', 'Coca Cola 500ml', 'Coca Cola 500ml', 'Кока-Кола 500мл', 'Koka-Kola 500ml', 
     'Classic Coca Cola 500ml bottle', 'Classic Coca Cola 500ml bottle', 'Классическая Кока-Кола 500мл бутылка', 'Klassik Koka-Kola 500ml shisha',
     (SELECT id FROM categories WHERE key = 'beverages'), 'Coca Cola', 2.50, 1.20, 
     '{"thumbnail": "/images/products/coca-500ml-thumb.jpg", "medium": "/images/products/coca-500ml-med.jpg", "large": "/images/products/coca-500ml-large.jpg"}'::jsonb, true),
    
    ('PEPSI-500ML', '123456789013', 'Pepsi 500ml', 'Pepsi 500ml', 'Пепси 500мл', 'Pepsi 500ml',
     'Pepsi Cola 500ml bottle', 'Pepsi Cola 500ml bottle', 'Пепси-Кола 500мл бутылка', 'Pepsi-Kola 500ml shisha',
     (SELECT id FROM categories WHERE key = 'beverages'), 'Pepsi', 2.45, 1.18, 
     '{"thumbnail": "/images/products/pepsi-500ml-thumb.jpg", "medium": "/images/products/pepsi-500ml-med.jpg", "large": "/images/products/pepsi-500ml-large.jpg"}'::jsonb, true),
    
    -- Beverages (without images)
    ('WATER-1L', '123456789014', 'Water 1L', 'Water 1L', 'Вода 1л', 'Suv 1l',
     'Pure drinking water 1 liter', 'Pure drinking water 1 liter', 'Чистая питьевая вода 1 литр', 'Toza ichimlik suvi 1 litr',
     (SELECT id FROM categories WHERE key = 'beverages'), 'Pure Life', 1.00, 0.40, NULL, false),
    
    -- Snacks (with sample images)
    ('CHIPS-ORG', '223456789012', 'Chips Original', 'Chips Original', 'Чипсы оригинальные', 'Chips original',
     'Original flavor potato chips', 'Original flavor potato chips', 'Картофельные чипсы оригинальный вкус', 'Original ta''mli kartoshka chipslari',
     (SELECT id FROM categories WHERE key = 'snacks'), 'Lays', 3.50, 1.75, 
     '{"thumbnail": "/images/products/chips-thumb.jpg", "medium": "/images/products/chips-med.jpg", "large": "/images/products/chips-large.jpg"}'::jsonb, true),
    
    -- Snacks (without images)
    ('SNICKERS', '223456789013', 'Chocolate Bar', 'Chocolate Bar', 'Шоколадный батончик', 'Shokolad',
     'Milk chocolate with peanuts', 'Milk chocolate with peanuts', 'Молочный шоколад с арахисом', 'Yeryong''oqli sut shokoladi',
     (SELECT id FROM categories WHERE key = 'snacks'), 'Snickers', 2.99, 1.50, NULL, false),
    
    -- Dairy (with sample images)
    ('MILK-1L', '323456789012', 'Milk 1L', 'Milk 1L', 'Молоко 1л', 'Sut 1l',
     'Fresh whole milk', 'Fresh whole milk', 'Свежее цельное молоко', 'Yangi to''liq sut',
     (SELECT id FROM categories WHERE key = 'dairy'), 'Farm Fresh', 3.25, 2.00, 
     '{"thumbnail": "/images/products/milk-thumb.jpg", "medium": "/images/products/milk-med.jpg", "large": "/images/products/milk-large.jpg"}'::jsonb, true),
    
    -- Dairy (without images)
    ('YOGURT', '323456789013', 'Greek Yogurt', 'Greek Yogurt', 'Греческий йогурт', 'Yunon yogurt',
     'Greek style yogurt', 'Greek style yogurt', 'Йогурт в греческом стиле', 'Yunon uslubidagi yogurt',
     (SELECT id FROM categories WHERE key = 'dairy'), 'Danone', 1.99, 0.95, NULL, false),
    
    -- Electronics (with sample images)
    ('USB-32GB', '723456789012', 'USB Flash Drive 32GB', 'USB Flash Drive 32GB', 'USB флешка 32ГБ', 'USB flesh disk 32GB',
     'High-speed USB 3.0 flash drive', 'High-speed USB 3.0 flash drive', 'Высокоскоростная USB 3.0 флешка', 'Yuqori tezlikli USB 3.0 flesh disk',
     (SELECT id FROM categories WHERE key = 'electronics'), 'SanDisk', 12.99, 6.50, 
     '{"thumbnail": "/images/products/usb-thumb.jpg", "medium": "/images/products/usb-med.jpg", "large": "/images/products/usb-large.jpg"}'::jsonb, true),
    
    -- Electronics (without images)
    ('BATTERIES-AA', '723456789013', 'Batteries AA 4-pack', 'Batteries AA 4-pack', 'Батарейки АА 4 шт', 'Batareyalar AA 4 dona',
     'Alkaline AA batteries', 'Alkaline AA batteries', 'Щелочные батарейки АА', 'Gidroksidli AA batareyalar',
     (SELECT id FROM categories WHERE key = 'electronics'), 'Duracell', 4.99, 2.20, NULL, false);

-- Insert branch-specific pricing
INSERT INTO branch_product_pricing (branch_id, product_id, price, cost, is_available, discount_percentage)
SELECT 
    b.id, p.id, 
    p.base_price * (0.9 + (RANDOM() * 0.2)), -- Price between 90% and 110% of base price
    p.cost * (0.95 + (RANDOM() * 0.1)), -- Cost between 95% and 105% of base cost
    true,
    CASE WHEN RANDOM() > 0.8 THEN (RANDOM() * 10) ELSE 0 END -- 20% chance of discount
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;

-- Initialize price sync tracking
INSERT INTO branch_product_price_sync_status (branch_id, product_id, needs_sync, price_changed_at)
SELECT b.id, p.id, false, NOW()
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;

-- Insert sample inventory
INSERT INTO branch_inventory (branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level, reorder_point)
SELECT 
    b.id, p.id,
    (50 + (RANDOM() * 200))::INTEGER, -- Stock between 50-250
    10, -- Min stock
    300, -- Max stock
    25 -- Reorder point
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;

-- Insert sample customers
INSERT INTO customers (name, email, phone, address, loyalty_card_number, loyalty_points, is_active) VALUES
('John Customer', 'john.customer@email.com', '+1-555-9001', '123 Oak Street, Downtown', 'LC20230001', 150, true),
('Jane Smith', 'jane.smith@email.com', '+1-555-9002', '456 Maple Avenue, Suburbs', 'LC20230002', 320, true),
('Mike Johnson', 'mike.johnson@email.com', '+1-555-9003', '789 Pine Road, City Center', 'LC20230003', 85, true);

COMMIT;

-- Verification queries
SELECT 'Products with images:' as info, COUNT(*) as count FROM products WHERE has_image = true;
SELECT 'Products without images:' as info, COUNT(*) as count FROM products WHERE has_image = false;
SELECT 'Categories:' as info, COUNT(*) as count FROM categories;
SELECT 'Branches:' as info, COUNT(*) as count FROM branches;
SELECT 'Customers:' as info, COUNT(*) as count FROM customers;
