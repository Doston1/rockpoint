-- Complete Sample Data for RockPoint Branch Core
-- This file contains all sample data including default users, configuration, categories, and products

-- =================================================================
-- DEFAULT SYSTEM DATA
-- =================================================================

-- Insert default admin user (password: admin1234)
INSERT INTO employees (employee_id, name, role, pin_hash) 
VALUES (
    'admin', 
    'System Administrator', 
    'admin', 
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm'  -- bcrypt hash of 'admin1234'
) ON CONFLICT (employee_id) DO NOTHING;

-- Insert sample cashier (password: 1111)
INSERT INTO employees (employee_id, name, role, pin_hash)
VALUES (
    'cashier',
    'Sample Cashier',
    'cashier',
    '$2a$12$YourBcryptHashHere'  -- bcrypt hash of '1111'
) ON CONFLICT (employee_id) DO NOTHING;

-- =================================================================
-- NETWORK CONFIGURATION DATA
-- =================================================================

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
('health_check_interval_ms', '30000', 'Health check interval in milliseconds', 'general', true)
ON CONFLICT (config_key) DO NOTHING;

-- =================================================================
-- CATEGORIES WITH TRANSLATIONS
-- =================================================================

-- Insert categories with multi-language support
INSERT INTO categories (key, name_en, name_ru, name_uz) VALUES
('Beverages', 'Beverages', 'Напитки', 'Ichimliklar'),
('Snacks', 'Snacks', 'Закуски', 'Gazaklar'),
('Dairy', 'Dairy', 'Молочные продукты', 'Sut mahsulotlari'),
('Meat', 'Meat', 'Мясо и птица', 'Go''sht va parrandachilik'),
('Bakery', 'Bakery', 'Хлебобулочные изделия', 'Non mahsulotlari'),
('Frozen', 'Frozen', 'Замороженные продукты', 'Muzlatilgan mahsulotlar'),
('Personal Care', 'Personal Care', 'Личная гигиена', 'Shaxsiy gigiyena'),
('Household', 'Household', 'Бытовая химия', 'Maishiy kimyoviy moddalar'),
('Electronics', 'Electronics', 'Электроника', 'Elektronika'),
('Clothing', 'Clothing', 'Одежда', 'Kiyim-kechak')
ON CONFLICT (key) DO NOTHING;

-- =================================================================
-- SAMPLE PRODUCTS DATA
-- =================================================================

-- Clear existing products first
DELETE FROM products;

-- Insert comprehensive sample products
INSERT INTO products (name, barcode, price, cost, quantity_in_stock, low_stock_threshold, category, brand, description, image_url, is_active) 
VALUES 
    -- Beverages Category
    ('Coca Cola 500ml', '123456789012', 2.50, 1.20, 150, 20, 'Beverages', 'Coca Cola', 'Classic Coca Cola 500ml bottle', 'https://example.com/coca-cola.jpg', true),
    ('Pepsi 500ml', '123456789013', 2.45, 1.18, 120, 20, 'Beverages', 'Pepsi', 'Pepsi Cola 500ml bottle', 'https://example.com/pepsi.jpg', true),
    ('Water 1L', '123456789014', 1.00, 0.40, 200, 30, 'Beverages', 'Pure Life', 'Pure drinking water 1 liter', 'https://example.com/water.jpg', true),
    ('Orange Juice 1L', '123456789015', 3.99, 2.10, 50, 10, 'Beverages', 'Tropicana', 'Fresh orange juice 1 liter', 'https://example.com/orange-juice.jpg', true),
    ('Apple Juice 1L', '123456789016', 3.75, 2.00, 45, 10, 'Beverages', 'Minute Maid', 'Fresh apple juice 1 liter', 'https://example.com/apple-juice.jpg', true),
    ('Energy Drink 250ml', '123456789017', 2.99, 1.50, 80, 15, 'Beverages', 'Red Bull', 'Energy drink 250ml can', 'https://example.com/redbull.jpg', true),
    
    -- Snacks Category
    ('Chips Original', '223456789012', 3.50, 1.75, 80, 15, 'Snacks', 'Lays', 'Original flavor potato chips', 'https://example.com/chips.jpg', true),
    ('Chocolate Bar', '223456789013', 2.99, 1.50, 60, 10, 'Snacks', 'Snickers', 'Milk chocolate with peanuts', 'https://example.com/snickers.jpg', true),
    ('Cookies Pack', '223456789014', 4.50, 2.25, 40, 8, 'Snacks', 'Oreo', 'Chocolate sandwich cookies', 'https://example.com/oreo.jpg', true),
    ('Peanuts Roasted', '223456789015', 2.25, 1.10, 35, 5, 'Snacks', 'Planters', 'Salted roasted peanuts', 'https://example.com/peanuts.jpg', true),
    ('Popcorn', '223456789016', 1.99, 0.90, 25, 5, 'Snacks', 'Pop Secret', 'Microwave popcorn butter flavor', 'https://example.com/popcorn.jpg', true),
    ('Gummy Bears', '223456789017', 3.25, 1.60, 30, 6, 'Snacks', 'Haribo', 'Fruit gummy bears candy', 'https://example.com/gummy-bears.jpg', true),
    
    -- Dairy Category
    ('Milk 1L', '323456789012', 3.25, 2.00, 75, 12, 'Dairy', 'Farm Fresh', 'Whole milk 1 liter', 'https://example.com/milk.jpg', true),
    ('Yogurt Vanilla', '323456789013', 1.99, 0.95, 45, 8, 'Dairy', 'Danone', 'Vanilla flavored yogurt', 'https://example.com/yogurt.jpg', true),
    ('Cheese Slices', '323456789014', 4.99, 2.50, 30, 5, 'Dairy', 'Kraft', 'American cheese slices', 'https://example.com/cheese.jpg', true),
    ('Butter 500g', '323456789015', 5.50, 3.20, 25, 3, 'Dairy', 'Land O Lakes', 'Salted butter 500 grams', 'https://example.com/butter.jpg', true),
    ('Greek Yogurt', '323456789016', 2.49, 1.25, 35, 6, 'Dairy', 'Chobani', 'Plain Greek yogurt', 'https://example.com/greek-yogurt.jpg', true),
    ('Cream Cheese', '323456789017', 3.99, 2.10, 20, 4, 'Dairy', 'Philadelphia', 'Original cream cheese', 'https://example.com/cream-cheese.jpg', true),
    
    -- Bakery Category
    ('White Bread', '423456789012', 2.75, 1.30, 40, 8, 'Bakery', 'Wonder', 'Sliced white bread loaf', 'https://example.com/white-bread.jpg', true),
    ('Whole Wheat Bread', '423456789013', 3.25, 1.60, 35, 6, 'Bakery', 'Pepperidge Farm', 'Whole wheat bread loaf', 'https://example.com/wheat-bread.jpg', true),
    ('Croissant', '423456789014', 1.50, 0.75, 20, 4, 'Bakery', 'Fresh Baked', 'Buttery croissant pastry', 'https://example.com/croissant.jpg', true),
    ('Bagels 6-pack', '423456789015', 4.99, 2.40, 15, 3, 'Bakery', 'Thomas', 'Everything bagels 6 pack', 'https://example.com/bagels.jpg', true),
    ('Donuts 12-pack', '423456789016', 6.99, 3.50, 10, 2, 'Bakery', 'Krispy Kreme', 'Glazed donuts 12 pack', 'https://example.com/donuts.jpg', true),
    ('Muffins 4-pack', '423456789017', 3.99, 2.00, 18, 3, 'Bakery', 'Fresh Baked', 'Blueberry muffins 4 pack', 'https://example.com/muffins.jpg', true),
    
    -- Personal Care Category
    ('Toothpaste', '523456789012', 3.99, 2.10, 50, 8, 'Personal Care', 'Colgate', 'Whitening toothpaste', 'https://example.com/toothpaste.jpg', true),
    ('Shampoo 400ml', '523456789013', 6.99, 3.50, 30, 5, 'Personal Care', 'Head & Shoulders', 'Dandruff shampoo 400ml', 'https://example.com/shampoo.jpg', true),
    ('Soap Bar', '523456789014', 1.99, 0.80, 60, 10, 'Personal Care', 'Dove', 'Moisturizing soap bar', 'https://example.com/soap.jpg', true),
    ('Deodorant', '523456789015', 4.50, 2.25, 25, 5, 'Personal Care', 'Axe', 'Body spray deodorant', 'https://example.com/deodorant.jpg', true),
    ('Razors 3-pack', '523456789016', 7.99, 4.00, 20, 4, 'Personal Care', 'Gillette', 'Disposable razors 3 pack', 'https://example.com/razors.jpg', true),
    ('Hand Sanitizer', '523456789017', 2.99, 1.50, 40, 8, 'Personal Care', 'Purell', 'Hand sanitizer gel 8oz', 'https://example.com/sanitizer.jpg', true),
    
    -- Household Category
    ('Paper Towels', '623456789012', 5.99, 3.00, 40, 6, 'Household', 'Bounty', 'Absorbent paper towels', 'https://example.com/paper-towels.jpg', true),
    ('Toilet Paper 12-pack', '623456789013', 12.99, 6.50, 20, 3, 'Household', 'Charmin', 'Ultra soft toilet paper', 'https://example.com/toilet-paper.jpg', true),
    ('Dish Soap', '623456789014', 2.99, 1.40, 35, 6, 'Household', 'Dawn', 'Grease-fighting dish soap', 'https://example.com/dish-soap.jpg', true),
    ('Laundry Detergent', '623456789015', 8.99, 4.50, 18, 3, 'Household', 'Tide', 'High efficiency detergent', 'https://example.com/detergent.jpg', true),
    ('Trash Bags 30-pack', '623456789016', 4.99, 2.50, 25, 5, 'Household', 'Glad', 'Kitchen trash bags 30 pack', 'https://example.com/trash-bags.jpg', true),
    ('All-Purpose Cleaner', '623456789017', 3.49, 1.75, 30, 5, 'Household', 'Mr. Clean', 'Multi-surface cleaner spray', 'https://example.com/cleaner.jpg', true),
    
    -- Electronics Category
    ('Phone Charger Cable', '723456789012', 9.99, 4.00, 25, 5, 'Electronics', 'Generic', 'USB charging cable', 'https://example.com/charger.jpg', true),
    ('Batteries AA 4-pack', '723456789013', 4.99, 2.20, 30, 5, 'Electronics', 'Duracell', 'Alkaline AA batteries', 'https://example.com/batteries.jpg', true),
    ('Phone Case', '723456789014', 14.99, 7.50, 15, 3, 'Electronics', 'OtterBox', 'Protective phone case', 'https://example.com/phone-case.jpg', true),
    ('Earbuds', '723456789015', 19.99, 10.00, 12, 2, 'Electronics', 'Apple', 'Wired earbuds with mic', 'https://example.com/earbuds.jpg', true),
    ('Power Bank', '723456789016', 24.99, 12.50, 8, 2, 'Electronics', 'Anker', 'Portable power bank 10000mAh', 'https://example.com/power-bank.jpg', true),
    ('USB Flash Drive', '723456789017', 12.99, 6.50, 20, 4, 'Electronics', 'SanDisk', '32GB USB flash drive', 'https://example.com/usb-drive.jpg', true);

-- =================================================================
-- SAMPLE CUSTOMERS DATA
-- =================================================================

INSERT INTO customers (name, email, phone, loyalty_points) VALUES
('John Smith', 'john.smith@email.com', '+1-555-0123', 150),
('Maria Garcia', 'maria.garcia@email.com', '+1-555-0124', 275),
('Ahmed Al-Rashid', 'ahmed.rashid@email.com', '+1-555-0125', 89),
('Elena Petrov', 'elena.petrov@email.com', '+1-555-0126', 340),
('James Wilson', 'james.wilson@email.com', '+1-555-0127', 67),
('Sarah Johnson', 'sarah.johnson@email.com', '+1-555-0128', 198),
('Chen Wei', 'chen.wei@email.com', '+1-555-0129', 422),
('Isabella Rodriguez', 'isabella.rodriguez@email.com', '+1-555-0130', 156),
('Mohammed Hassan', 'mohammed.hassan@email.com', '+1-555-0131', 78),
('Anna Kowalski', 'anna.kowalski@email.com', '+1-555-0132', 234);

-- =================================================================
-- SAMPLE POS TERMINALS DATA
-- =================================================================

INSERT INTO pos_terminals (terminal_id, name, ip_address, port, location, status, hardware_info, software_version) VALUES
('POS-001', 'Checkout Counter 1', '192.168.1.101', 5173, 'Front entrance - Register 1', 'online', '{"cpu": "Intel i5", "ram": "8GB", "storage": "256GB SSD"}', '1.0.0'),
('POS-002', 'Checkout Counter 2', '192.168.1.102', 5173, 'Front entrance - Register 2', 'online', '{"cpu": "Intel i5", "ram": "8GB", "storage": "256GB SSD"}', '1.0.0'),
('POS-003', 'Customer Service', '192.168.1.103', 5173, 'Customer service desk', 'offline', '{"cpu": "Intel i3", "ram": "4GB", "storage": "128GB SSD"}', '1.0.0'),
('POS-004', 'Self-Checkout 1', '192.168.1.104', 5173, 'Self-checkout area', 'maintenance', '{"cpu": "Intel i5", "ram": "8GB", "storage": "256GB SSD"}', '1.0.0');

-- =================================================================
-- VERIFICATION QUERIES
-- =================================================================

-- Verify the data was inserted correctly
DO $$
BEGIN
    RAISE NOTICE 'Sample data insertion completed!';
    RAISE NOTICE 'Total employees: %', (SELECT COUNT(*) FROM employees);
    RAISE NOTICE 'Total categories: %', (SELECT COUNT(*) FROM categories);
    RAISE NOTICE 'Total products: %', (SELECT COUNT(*) FROM products);
    RAISE NOTICE 'Total customers: %', (SELECT COUNT(*) FROM customers);
    RAISE NOTICE 'Total POS terminals: %', (SELECT COUNT(*) FROM pos_terminals);
    RAISE NOTICE 'Total network configs: %', (SELECT COUNT(*) FROM branch_network_config);
END $$;

-- Show products by category
SELECT 
    category, 
    COUNT(*) as product_count,
    ROUND(AVG(price), 2) as avg_price,
    SUM(quantity_in_stock) as total_stock
FROM products 
WHERE is_active = true
GROUP BY category 
ORDER BY category;

-- Show low stock products (if any)
SELECT 
    name,
    category,
    quantity_in_stock,
    low_stock_threshold,
    price
FROM products 
WHERE quantity_in_stock <= low_stock_threshold
ORDER BY quantity_in_stock ASC;

-- Show categories with translations
SELECT 
    key,
    name_en,
    name_ru,
    name_uz
FROM categories
ORDER BY key;

-- Show network configuration
SELECT 
    config_key,
    config_value,
    description,
    category
FROM branch_network_config
ORDER BY category, config_key;
