-- Complete Sample Data for RockPoint Chain Core
-- This file contains all sample data from all sources consolidated
-- Run this after complete_schema.sql to populate with comprehensive test data

-- Start with a clean transaction
BEGIN;

-- =================================================================
-- CLEAR EXISTING DATA
-- =================================================================

-- Clear all existing data (in proper dependency order to avoid foreign key violations)
-- Delete child records first, then parent records

-- Clear transaction-related data
DELETE FROM payments;
DELETE FROM transaction_items;
DELETE FROM transactions;

-- Clear inventory and pricing data
DELETE FROM stock_movements;
DELETE FROM branch_inventory;
DELETE FROM branch_product_price_sync_status;
DELETE FROM branch_product_pricing;

-- Clear employee data
DELETE FROM employee_time_logs;
DELETE FROM employees;

-- Clear product data
DELETE FROM products;
DELETE FROM categories;

-- Clear customer data
DELETE FROM customers;

-- Clear promotional data
DELETE FROM promotions;

-- Clear infrastructure and logging data
DELETE FROM branch_sync_logs;
DELETE FROM onec_sync_logs;
DELETE FROM connection_health_logs;
DELETE FROM branch_servers;
DELETE FROM network_settings;
DELETE FROM api_keys;
DELETE FROM system_settings;
DELETE FROM sync_history;
DELETE FROM sync_tasks;

-- Clear core organizational data
DELETE FROM users;
DELETE FROM branches;
DELETE FROM chains;

-- =================================================================
-- CORE MASTER DATA
-- =================================================================

-- Insert chain information
INSERT INTO chains (name, code, description, headquarters_address, phone, email, website, timezone, base_currency) VALUES
('RockPoint Retail Chain', 'RPC001', 'Modern retail chain management system', '123 Corporate Plaza, Business District', '+1-555-0100', 'headquarters@rockpoint.com', 'https://rockpoint.com', 'America/New_York', 'USD');

-- Insert sample branches
INSERT INTO branches (name, code, address, phone, email, manager_name, timezone, currency, tax_rate, api_endpoint, api_key, server_ip, server_port, network_status) VALUES
('Downtown Store', 'DT001', '123 Main Street, Downtown', '+1-555-0101', 'downtown@rockpoint.com', 'John Smith', 'America/New_York', 'USD', 0.0875, 'http://localhost:3000/api', 'dt001_api_key_123', '127.0.0.1', 3000, 'online'),
('Mall Location', 'ML002', '456 Shopping Mall, Level 2', '+1-555-0102', 'mall@rockpoint.com', 'Sarah Johnson', 'America/New_York', 'USD', 0.0875, 'http://localhost:3001/api', 'ml002_api_key_456', '127.0.0.1', 3001, 'online'),
('Airport Terminal', 'AP003', '789 Airport Terminal B', '+1-555-0103', 'airport@rockpoint.com', 'Mike Davis', 'America/New_York', 'USD', 0.0875, 'http://localhost:3002/api', 'ap003_api_key_789', '127.0.0.1', 3002, 'offline'),
('Suburban Plaza', 'SP004', '321 Suburban Plaza Drive', '+1-555-0104', 'suburban@rockpoint.com', 'Lisa Chen', 'America/New_York', 'USD', 0.0875, 'http://localhost:3003/api', 'sp004_api_key_012', '127.0.0.1', 3003, 'maintenance'),
('City Center', 'CC005', '654 City Center Boulevard', '+1-555-0105', 'citycenter@rockpoint.com', 'Robert Wilson', 'America/New_York', 'USD', 0.0875, 'http://localhost:3004/api', 'cc005_api_key_345', '127.0.0.1', 3004, 'online');

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, name, role, permissions) VALUES 
('admin', 'admin@rockpoint.com', '$2a$12$U.YVJRPzrzwZ1qLpsE1EreHpOClgPqNRy5MFKjcV0ETH44FyEPrMO', 'System Administrator', 'super_admin', ARRAY['*']),
('manager', 'manager@rockpoint.com', '$2a$12$U.YVJRPzrzwZ1qLpsE1EreHpOClgPqNRy5MFKjcV0ETH44FyEPrMO', 'Chain Manager', 'chain_admin', ARRAY['branches:*', 'products:*', 'reports:*']),
('analyst', 'analyst@rockpoint.com', '$2a$12$U.YVJRPzrzwZ1qLpsE1EreHpOClgPqNRy5MFKjcV0ETH44FyEPrMO', 'Business Analyst', 'analyst', ARRAY['reports:read', 'analytics:read']);

-- =================================================================
-- PRODUCT CATALOG DATA
-- =================================================================

-- Insert sample categories with translations
INSERT INTO categories (key, name, name_en, name_ru, name_uz, description, description_en, description_ru, description_uz, sort_order) VALUES
('beverages', 'Beverages', 'Beverages', 'Напитки', 'Ichimliklar', 'Soft drinks, juices, water', 'Soft drinks, juices, water', 'Безалкогольные напитки, соки, вода', 'Alkogolsiz ichimliklar, sharbatlar, suv', 1),
('snacks', 'Snacks', 'Snacks', 'Закуски', 'Gazaklar', 'Chips, cookies, nuts', 'Chips, cookies, nuts', 'Чипсы, печенье, орехи', 'Chiplar, pechene, yong''oqlar', 2),
('dairy', 'Dairy', 'Dairy', 'Молочные продукты', 'Sut mahsulotlari', 'Milk, cheese, yogurt', 'Milk, cheese, yogurt', 'Молоко, сыр, йогурт', 'Sut, pishloq, yogurt', 3),
('bakery', 'Bakery', 'Bakery', 'Хлебобулочные', 'Non mahsulotlari', 'Bread, pastries, baked goods', 'Bread, pastries, baked goods', 'Хлеб, выпечка, кондитерские изделия', 'Non, pishiriqlar, pishirilgan mahsulotlar', 4),
('personal_care', 'Personal Care', 'Personal Care', 'Личная гигиена', 'Shaxsiy gigiyena', 'Toiletries, hygiene products', 'Toiletries, hygiene products', 'Туалетные принадлежности, средства гигиены', 'Hojatxona buyumlari, gigiyena vositalari', 5),
('household', 'Household', 'Household', 'Бытовые товары', 'Uy-ro''zg''or buyumlari', 'Cleaning supplies, paper products', 'Cleaning supplies, paper products', 'Чистящие средства, бумажные изделия', 'Tozalash vositalari, qog''oz mahsulotlar', 6),
('electronics', 'Electronics', 'Electronics', 'Электроника', 'Elektronika', 'Small electronics, accessories', 'Small electronics, accessories', 'Мелкая электроника, аксессуары', 'Kichik elektronika, aksessuarlar', 7),
('clothing', 'Clothing', 'Clothing', 'Одежда', 'Kiyim-kechak', 'Basic clothing items', 'Basic clothing items', 'Основная одежда', 'Asosiy kiyim-kechak', 8),
('frozen', 'Frozen Foods', 'Frozen Foods', 'Замороженные продукты', 'Muzlatilgan mahsulotlar', 'Frozen meals, ice cream', 'Frozen meals, ice cream', 'Замороженные блюда, мороженое', 'Muzlatilgan taomlar, muzqaymoq', 9),
('health', 'Health & Beauty', 'Health & Beauty', 'Здоровье и красота', 'Salomatlik va go''zallik', 'Vitamins, cosmetics', 'Vitamins, cosmetics', 'Витамины, косметика', 'Vitaminlar, kosmetika', 10);

-- Insert comprehensive sample products
INSERT INTO products (sku, barcode, name, name_en, name_ru, name_uz, description, description_en, description_ru, description_uz, category_id, brand, base_price, cost, image_url) 
SELECT * FROM (
    -- Beverages
    SELECT 'COCA-500ML', '123456789012', 'Coca Cola 500ml', 'Coca Cola 500ml', 'Кока-Кола 500мл', 'Koka-Kola 500ml', 
           'Classic Coca Cola 500ml bottle', 'Classic Coca Cola 500ml bottle', 'Классическая Кока-Кола 500мл бутылка', 'Klassik Koka-Kola 500ml shisha',
           c.id, 'Coca Cola', 2.50, 1.20, 'https://example.com/coca-cola.jpg'
    FROM categories c WHERE c.key = 'beverages'
    
    UNION ALL
    
    SELECT 'PEPSI-500ML', '123456789013', 'Pepsi 500ml', 'Pepsi 500ml', 'Пепси 500мл', 'Pepsi 500ml',
           'Pepsi Cola 500ml bottle', 'Pepsi Cola 500ml bottle', 'Пепси-Кола 500мл бутылка', 'Pepsi-Kola 500ml shisha',
           c.id, 'Pepsi', 2.45, 1.18, 'https://example.com/pepsi.jpg'
    FROM categories c WHERE c.key = 'beverages'
    
    UNION ALL
    
    SELECT 'WATER-1L', '123456789014', 'Water 1L', 'Water 1L', 'Вода 1л', 'Suv 1l',
           'Pure drinking water 1 liter', 'Pure drinking water 1 liter', 'Чистая питьевая вода 1 литр', 'Toza ichimlik suvi 1 litr',
           c.id, 'Pure Life', 1.00, 0.40, 'https://example.com/water.jpg'
    FROM categories c WHERE c.key = 'beverages'
    
    UNION ALL
    
    SELECT 'OJ-1L', '123456789015', 'Orange Juice 1L', 'Orange Juice 1L', 'Апельсиновый сок 1л', 'Apelsin sharbati 1l',
           'Fresh orange juice 1 liter', 'Fresh orange juice 1 liter', 'Свежий апельсиновый сок 1 литр', 'Yangi apelsin sharbati 1 litr',
           c.id, 'Tropicana', 3.99, 2.10, 'https://example.com/orange-juice.jpg'
    FROM categories c WHERE c.key = 'beverages'
    
    UNION ALL
    
    SELECT 'AJ-1L', '123456789016', 'Apple Juice 1L', 'Apple Juice 1L', 'Яблочный сок 1л', 'Olma sharbati 1l',
           'Fresh apple juice 1 liter', 'Fresh apple juice 1 liter', 'Свежий яблочный сок 1 литр', 'Yangi olma sharbati 1 litr',
           c.id, 'Minute Maid', 3.75, 2.00, 'https://example.com/apple-juice.jpg'
    FROM categories c WHERE c.key = 'beverages'
    
    UNION ALL
    
    SELECT 'ENERGY-250ML', '123456789017', 'Energy Drink 250ml', 'Energy Drink 250ml', 'Энергетик 250мл', 'Energetik ichimlik 250ml',
           'Energy drink 250ml can', 'Energy drink 250ml can', 'Энергетический напиток 250мл банка', 'Energetik ichimlik 250ml banka',
           c.id, 'Red Bull', 2.99, 1.50, 'https://example.com/redbull.jpg'
    FROM categories c WHERE c.key = 'beverages'
    
    UNION ALL
    
    -- Snacks
    SELECT 'CHIPS-ORG', '223456789012', 'Chips Original', 'Chips Original', 'Чипсы оригинальные', 'Chips original',
           'Original flavor potato chips', 'Original flavor potato chips', 'Картофельные чипсы оригинальный вкус', 'Original ta''mli kartoshka chipslari',
           c.id, 'Lays', 3.50, 1.75, 'https://example.com/chips.jpg'
    FROM categories c WHERE c.key = 'snacks'
    
    UNION ALL
    
    SELECT 'SNICKERS', '223456789013', 'Chocolate Bar', 'Chocolate Bar', 'Шоколадный батончик', 'Shokolad',
           'Milk chocolate with peanuts', 'Milk chocolate with peanuts', 'Молочный шоколад с арахисом', 'Yeryong''oqli sut shokoladi',
           c.id, 'Snickers', 2.99, 1.50, 'https://example.com/snickers.jpg'
    FROM categories c WHERE c.key = 'snacks'
    
    UNION ALL
    
    SELECT 'OREO-PACK', '223456789014', 'Cookies Pack', 'Cookies Pack', 'Печенье упаковка', 'Pechene paketi',
           'Chocolate sandwich cookies', 'Chocolate sandwich cookies', 'Шоколадное печенье-сэндвич', 'Shokoladli sendvich pechene',
           c.id, 'Oreo', 4.50, 2.25, 'https://example.com/oreo.jpg'
    FROM categories c WHERE c.key = 'snacks'
    
    UNION ALL
    
    SELECT 'PEANUTS', '223456789015', 'Peanuts Roasted', 'Peanuts Roasted', 'Арахис жареный', 'Yeryong''oq qovurilgan',
           'Salted roasted peanuts', 'Salted roasted peanuts', 'Соленый жареный арахис', 'Tuzlangan qovurilgan yeryong''oq',
           c.id, 'Planters', 2.25, 1.10, 'https://example.com/peanuts.jpg'
    FROM categories c WHERE c.key = 'snacks'
    
    UNION ALL
    
    SELECT 'POPCORN', '223456789016', 'Popcorn', 'Popcorn', 'Попкорн', 'Popkorn',
           'Microwave popcorn butter flavor', 'Microwave popcorn butter flavor', 'Попкорн для микроволновки вкус масла', 'Mikroto''lqinli popkorn sariyog'' ta''mi',
           c.id, 'Pop Secret', 1.99, 0.90, 'https://example.com/popcorn.jpg'
    FROM categories c WHERE c.key = 'snacks'
    
    UNION ALL
    
    SELECT 'GUMMY-BEARS', '223456789017', 'Gummy Bears', 'Gummy Bears', 'Желейные мишки', 'Jelatin ayiqchalar',
           'Fruit gummy bears candy', 'Fruit gummy bears candy', 'Фруктовые желейные мишки', 'Mevali jelatin ayiqcha konfetlari',
           c.id, 'Haribo', 3.25, 1.60, 'https://example.com/gummy-bears.jpg'
    FROM categories c WHERE c.key = 'snacks'
    
    UNION ALL
    
    -- Dairy
    SELECT 'MILK-1L', '323456789012', 'Milk 1L', 'Milk 1L', 'Молоко 1л', 'Sut 1l',
           'Whole milk 1 liter', 'Whole milk 1 liter', 'Цельное молоко 1 литр', 'To''liq sut 1 litr',
           c.id, 'Farm Fresh', 3.25, 2.00, 'https://example.com/milk.jpg'
    FROM categories c WHERE c.key = 'dairy'
    
    UNION ALL
    
    SELECT 'YOGURT-VAN', '323456789013', 'Yogurt Vanilla', 'Yogurt Vanilla', 'Йогурт ванильный', 'Yogurt vanil',
           'Vanilla flavored yogurt', 'Vanilla flavored yogurt', 'Йогурт с ванильным вкусом', 'Vanil ta''mli yogurt',
           c.id, 'Danone', 1.99, 0.95, 'https://example.com/yogurt.jpg'
    FROM categories c WHERE c.key = 'dairy'
    
    UNION ALL
    
    SELECT 'CHEESE-SLICE', '323456789014', 'Cheese Slices', 'Cheese Slices', 'Сыр ломтиками', 'Pishloq bo''laklari',
           'American cheese slices', 'American cheese slices', 'Американский сыр ломтиками', 'Amerika pishlog''i bo''laklari',
           c.id, 'Kraft', 4.99, 2.50, 'https://example.com/cheese.jpg'
    FROM categories c WHERE c.key = 'dairy'
    
    UNION ALL
    
    SELECT 'BUTTER-500G', '323456789015', 'Butter 500g', 'Butter 500g', 'Масло сливочное 500г', 'Sariyog'' 500g',
           'Salted butter 500 grams', 'Salted butter 500 grams', 'Соленое масло 500 грамм', 'Tuzlangan sariyog'' 500 gramm',
           c.id, 'Land O Lakes', 5.50, 3.20, 'https://example.com/butter.jpg'
    FROM categories c WHERE c.key = 'dairy'
    
    UNION ALL
    
    -- Bakery
    SELECT 'BREAD-WHITE', '423456789012', 'White Bread', 'White Bread', 'Хлеб белый', 'Oq non',
           'Sliced white bread loaf', 'Sliced white bread loaf', 'Нарезанный белый хлеб', 'To''g''ralgan oq non',
           c.id, 'Wonder', 2.75, 1.30, 'https://example.com/white-bread.jpg'
    FROM categories c WHERE c.key = 'bakery'
    
    UNION ALL
    
    SELECT 'BREAD-WHEAT', '423456789013', 'Whole Wheat Bread', 'Whole Wheat Bread', 'Хлеб цельнозерновой', 'Bug''doy noni',
           'Whole wheat bread loaf', 'Whole wheat bread loaf', 'Цельнозерновой хлеб', 'To''liq bug''doy noni',
           c.id, 'Pepperidge Farm', 3.25, 1.60, 'https://example.com/wheat-bread.jpg'
    FROM categories c WHERE c.key = 'bakery'
    
    UNION ALL
    
    SELECT 'CROISSANT', '423456789014', 'Croissant', 'Croissant', 'Круассан', 'Kruassan',
           'Buttery croissant pastry', 'Buttery croissant pastry', 'Масляный круассан', 'Sariyog''li kruassan',
           c.id, 'Fresh Baked', 1.50, 0.75, 'https://example.com/croissant.jpg'
    FROM categories c WHERE c.key = 'bakery'
    
    UNION ALL
    
    -- Personal Care
    SELECT 'TOOTHPASTE', '523456789012', 'Toothpaste', 'Toothpaste', 'Зубная паста', 'Tish pastasi',
           'Whitening toothpaste', 'Whitening toothpaste', 'Отбеливающая зубная паста', 'Oqartiruvchi tish pastasi',
           c.id, 'Colgate', 3.99, 2.10, 'https://example.com/toothpaste.jpg'
    FROM categories c WHERE c.key = 'personal_care'
    
    UNION ALL
    
    SELECT 'SHAMPOO-400ML', '523456789013', 'Shampoo 400ml', 'Shampoo 400ml', 'Шампунь 400мл', 'Shampun 400ml',
           'Dandruff shampoo 400ml', 'Dandruff shampoo 400ml', 'Шампунь от перхоти 400мл', 'Kepakka qarshi shampun 400ml',
           c.id, 'Head & Shoulders', 6.99, 3.50, 'https://example.com/shampoo.jpg'
    FROM categories c WHERE c.key = 'personal_care'
    
    UNION ALL
    
    -- Electronics
    SELECT 'CHARGER-USB', '723456789012', 'Phone Charger Cable', 'Phone Charger Cable', 'Кабель зарядки телефона', 'Telefon zaryadlash kabeli',
           'USB charging cable', 'USB charging cable', 'USB кабель для зарядки', 'USB zaryadlash kabeli',
           c.id, 'Generic', 9.99, 4.00, 'https://example.com/charger.jpg'
    FROM categories c WHERE c.key = 'electronics'
    
    UNION ALL
    
    SELECT 'BATTERIES-AA', '723456789013', 'Batteries AA 4-pack', 'Batteries AA 4-pack', 'Батарейки АА 4 шт', 'Batareyalar AA 4 dona',
           'Alkaline AA batteries', 'Alkaline AA batteries', 'Щелочные батарейки АА', 'Gidroksidli AA batareyalar',
           c.id, 'Duracell', 4.99, 2.20, 'https://example.com/batteries.jpg'
    FROM categories c WHERE c.key = 'electronics'
) sub;

-- =================================================================
-- BRANCH INFRASTRUCTURE DATA
-- =================================================================

-- Insert branch servers (network infrastructure)
INSERT INTO branch_servers (branch_id, server_name, ip_address, port, api_port, websocket_port, network_type, status, api_key, outbound_api_key)
SELECT 
    b.id,
    b.code || '_server',
    b.server_ip,
    b.server_port,
    b.server_port,
    b.server_port + 1,
    'lan',
    CASE 
        WHEN b.network_status = 'online' THEN 'online'
        WHEN b.network_status = 'offline' THEN 'offline'
        WHEN b.network_status = 'maintenance' THEN 'maintenance'
        ELSE 'error'
    END,
    b.api_key,
    'rp_' || LOWER(b.code) || '_outbound_' || EXTRACT(EPOCH FROM NOW())::TEXT
FROM branches b;

-- Insert network settings
INSERT INTO network_settings (setting_key, setting_value, description, category, is_system) VALUES
('default_branch_api_port', '3000', 'Default API port for branch servers', 'ports', true),
('default_branch_ws_port', '3001', 'Default WebSocket port for branch servers', 'ports', true),
('chain_core_port', '3001', 'Chain core server port', 'ports', true),
('connection_timeout_ms', '10000', 'Default connection timeout in milliseconds', 'timeouts', true),
('health_check_interval_ms', '30000', 'Health check interval in milliseconds', 'timeouts', true),
('max_response_time_ms', '5000', 'Maximum acceptable response time', 'timeouts', true),
('vpn_network_range', '10.0.0.0/8', 'VPN network IP range', 'security', true),
('allow_public_access', 'false', 'Allow access from public internet', 'security', true);

-- =================================================================
-- EMPLOYEE DATA
-- =================================================================

-- Insert sample employees for each branch
INSERT INTO employees (employee_id, branch_id, name, role, phone, email, hire_date, salary, pin_hash, status)
SELECT * FROM (
    -- Downtown Store (DT001)
    SELECT 'EMP001', b.id, 'Alice Manager', 'manager', '+1-555-1001', 'alice@rockpoint.com', 
           '2023-01-15'::DATE, 45000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'DT001'
    
    UNION ALL
    
    SELECT 'EMP002', b.id, 'Bob Cashier', 'cashier', '+1-555-1002', 'bob@rockpoint.com',
           '2023-02-01'::DATE, 28000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'DT001'
    
    UNION ALL
    
    SELECT 'EMP003', b.id, 'Charlie Supervisor', 'supervisor', '+1-555-1003', 'charlie@rockpoint.com',
           '2023-01-20'::DATE, 35000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'DT001'
    
    UNION ALL
    
    -- Mall Location (ML002)
    SELECT 'EMP004', b.id, 'Diana Manager', 'manager', '+1-555-2001', 'diana@rockpoint.com',
           '2023-01-10'::DATE, 46000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'ML002'
    
    UNION ALL
    
    SELECT 'EMP005', b.id, 'Edward Cashier', 'cashier', '+1-555-2002', 'edward@rockpoint.com',
           '2023-03-01'::DATE, 29000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'ML002'
    
    UNION ALL
    
    SELECT 'EMP006', b.id, 'Fiona Cashier', 'cashier', '+1-555-2003', 'fiona@rockpoint.com',
           '2023-04-15'::DATE, 28500.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'ML002'
    
    UNION ALL
    
    -- Airport Terminal (AP003)
    SELECT 'EMP007', b.id, 'George Manager', 'manager', '+1-555-3001', 'george@rockpoint.com',
           '2023-01-05'::DATE, 48000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'AP003'
    
    UNION ALL
    
    SELECT 'EMP008', b.id, 'Helen Supervisor', 'supervisor', '+1-555-3002', 'helen@rockpoint.com',
           '2023-02-20'::DATE, 36000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'AP003'
    
    UNION ALL
    
    SELECT 'EMP009', b.id, 'Ivan Cashier', 'cashier', '+1-555-3003', 'ivan@rockpoint.com',
           '2023-03-10'::DATE, 30000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'AP003'
    
    UNION ALL
    
    -- Suburban Plaza (SP004)
    SELECT 'EMP010', b.id, 'Julia Manager', 'manager', '+1-555-4001', 'julia@rockpoint.com',
           '2023-01-25'::DATE, 44000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'SP004'
    
    UNION ALL
    
    SELECT 'EMP011', b.id, 'Kevin Cashier', 'cashier', '+1-555-4002', 'kevin@rockpoint.com',
           '2023-04-01'::DATE, 27500.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'SP004'
    
    UNION ALL
    
    -- City Center (CC005)
    SELECT 'EMP012', b.id, 'Linda Manager', 'manager', '+1-555-5001', 'linda@rockpoint.com',
           '2023-02-10'::DATE, 47000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'CC005'
    
    UNION ALL
    
    SELECT 'EMP013', b.id, 'Mark Supervisor', 'supervisor', '+1-555-5002', 'mark@rockpoint.com',
           '2023-03-15'::DATE, 37000.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'CC005'
    
    UNION ALL
    
    SELECT 'EMP014', b.id, 'Nancy Cashier', 'cashier', '+1-555-5003', 'nancy@rockpoint.com',
           '2023-05-01'::DATE, 29500.00, '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', 'active'
    FROM branches b WHERE b.code = 'CC005'
) emp_data;

-- =================================================================
-- PRICING AND INVENTORY DATA
-- =================================================================

-- Insert branch-specific pricing (different prices per branch)
INSERT INTO branch_product_pricing (branch_id, product_id, price, cost, is_available, discount_percentage)
SELECT 
    b.id, p.id, 
    CASE b.code
        WHEN 'DT001' THEN p.base_price -- Downtown: base price
        WHEN 'ML002' THEN p.base_price * 1.05 -- Mall: 5% markup
        WHEN 'AP003' THEN p.base_price * 1.15 -- Airport: 15% markup
        WHEN 'SP004' THEN p.base_price * 0.98 -- Suburban: 2% discount
        WHEN 'CC005' THEN p.base_price * 1.03 -- City: 3% markup
    END as price,
    p.cost,
    CASE 
        WHEN b.code = 'AP003' AND p.sku IN ('MILK-1L', 'BREAD-WHITE') THEN false -- Airport doesn't sell perishables
        ELSE true
    END,
    CASE b.code
        WHEN 'ML002' THEN 2 -- Mall: 2% general discount
        WHEN 'SP004' THEN 3 -- Suburban: 3% family discount
        ELSE 0
    END as discount_percentage
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;

-- Initialize price sync tracking for all products and branches
-- This marks all products as initially needing sync (first time setup)
INSERT INTO branch_product_price_sync_status (branch_id, product_id, needs_sync, price_changed_at)
SELECT b.id, p.id, true, NOW() - INTERVAL '1 hour' -- Mark as changed 1 hour ago
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true AND p.barcode IS NOT NULL;

-- Insert sample inventory for each branch
INSERT INTO branch_inventory (branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level, reorder_point)
SELECT 
    b.id, p.id,
    CASE b.code
        WHEN 'DT001' THEN 120 + (RANDOM() * 80)::INT -- Downtown: 120-200
        WHEN 'ML002' THEN 150 + (RANDOM() * 100)::INT  -- Mall: 150-250
        WHEN 'AP003' THEN 50 + (RANDOM() * 30)::INT   -- Airport: 50-80
        WHEN 'SP004' THEN 80 + (RANDOM() * 60)::INT   -- Suburban: 80-140
        WHEN 'CC005' THEN 100 + (RANDOM() * 70)::INT  -- City: 100-170
    END as quantity_in_stock,
    CASE 
        WHEN p.sku LIKE '%500ML' OR p.sku LIKE '%1L' THEN 25
        WHEN p.sku LIKE 'CHIPS%' OR p.sku LIKE 'SNICKERS%' THEN 15
        WHEN p.sku LIKE 'BREAD%' OR p.sku LIKE 'MILK%' THEN 20
        ELSE 10
    END as min_stock_level,
    CASE 
        WHEN p.sku LIKE '%500ML' OR p.sku LIKE '%1L' THEN 200
        WHEN p.sku LIKE 'CHIPS%' OR p.sku LIKE 'SNICKERS%' THEN 150
        WHEN p.sku LIKE 'BREAD%' OR p.sku LIKE 'MILK%' THEN 180
        ELSE 100
    END as max_stock_level,
    CASE 
        WHEN p.sku LIKE '%500ML' OR p.sku LIKE '%1L' THEN 35
        WHEN p.sku LIKE 'CHIPS%' OR p.sku LIKE 'SNICKERS%' THEN 25
        WHEN p.sku LIKE 'BREAD%' OR p.sku LIKE 'MILK%' THEN 30
        ELSE 15
    END as reorder_point
FROM branches b
CROSS JOIN products p
WHERE b.is_active = true AND p.is_active = true;

-- =================================================================
-- CUSTOMER DATA
-- =================================================================

-- Insert sample customers
INSERT INTO customers (name, email, phone, address, date_of_birth, gender, loyalty_card_number, loyalty_points, discount_percentage, is_vip, is_active, notes, total_spent) VALUES
('John Customer', 'john.customer@email.com', '+1-555-9001', '123 Oak Street, Downtown', '1985-03-15', 'male', 'LC20230001', 150, 0, false, true, 'Regular customer since 2023', 75.50),
('Jane Smith', 'jane.smith@email.com', '+1-555-9002', '456 Maple Avenue, Suburbs', '1990-07-22', 'female', 'LC20230002', 320, 5, true, true, 'VIP customer, prefers organic products', 160.75),
('Mike Johnson', 'mike.johnson@email.com', '+1-555-9003', '789 Pine Road, City Center', '1988-11-08', 'male', 'LC20230003', 85, 0, false, true, 'Occasional buyer, mostly beverages', 42.25),
('Sarah Williams', 'sarah.williams@email.com', '+1-555-9004', '321 Elm Drive, Mall District', '1992-04-03', 'female', 'LC20230004', 220, 2, false, true, 'Frequent shopper, family of 4', 110.00),
('Robert Brown', 'robert.brown@email.com', '+1-555-9005', '654 Cedar Lane, Airport Area', '1975-12-18', 'male', 'LC20230005', 180, 3, false, true, 'Business traveler, convenience items', 90.30),
('Emily Davis', 'emily.davis@email.com', '+1-555-9006', '987 Birch Court, Residential', '1995-08-14', 'female', 'LC20230006', 95, 0, false, true, 'Student, limited budget purchases', 47.50),
('David Wilson', 'david.wilson@email.com', '+1-555-9007', '147 Willow Street, Downtown', '1980-06-25', 'male', 'LC20230007', 275, 10, true, true, 'VIP customer, corporate account', 137.75),
('Lisa Garcia', 'lisa.garcia@email.com', '+1-555-9008', '258 Spruce Avenue, Suburbs', '1987-01-11', 'female', 'LC20230008', 145, 0, false, true, 'Health-conscious shopper', 72.25),
('Tom Anderson', 'tom.anderson@email.com', '+1-555-9009', '369 Ash Boulevard, City', '1983-09-30', 'male', 'LC20230009', 310, 5, true, true, 'VIP customer, bulk purchases', 155.00),
('Maria Rodriguez', 'maria.rodriguez@email.com', '+1-555-9010', '741 Cherry Lane, Mall Area', '1991-02-17', 'female', 'LC20230010', 205, 2, false, true, 'Family shopper, weekly visits', 102.50),
('Kevin Thompson', 'kevin.thompson@email.com', '+1-555-9011', '852 Hickory Drive, Suburbs', '1986-05-09', 'male', 'LC20230011', 120, 0, false, true, 'Weekend shopper', 62.75),
('Rachel White', 'rachel.white@email.com', '+1-555-9012', '963 Poplar Street, Downtown', '1993-10-05', 'female', 'LC20230012', 380, 15, true, true, 'VIP customer, premium products only', 195.25),
('James Clark', 'james.clark@email.com', '+1-555-9013', '159 Dogwood Lane, Airport', '1979-12-22', 'male', 'LC20230013', 65, 0, false, false, 'Inactive customer, moved away', 35.80),
('Amanda Lewis', 'amanda.lewis@email.com', '+1-555-9014', '357 Magnolia Court, City', '1994-03-28', 'female', 'LC20230014', 240, 3, false, true, 'Young professional, convenient shopping', 128.90),
('Christopher Hall', 'christopher.hall@email.com', '+1-555-9015', '468 Sycamore Road, Residential', '1982-07-16', 'male', 'LC20230015', 175, 2, false, true, 'Regular customer, family purchases', 89.45);

-- =================================================================
-- TRANSACTION DATA (Sample from last 30 days)
-- =================================================================

-- Generate sample transactions for testing
INSERT INTO transactions (branch_id, transaction_number, employee_id, customer_id, terminal_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, status, completed_at)
SELECT * FROM (
    (SELECT 
        b.id,
        'TXN-' || LPAD((RANDOM() * 999999)::TEXT, 6, '0'),
        e.id,
        CASE WHEN RANDOM() < 0.7 THEN NULL ELSE (SELECT id FROM customers ORDER BY RANDOM() LIMIT 1) END,
        'TERM-' || (RANDOM() * 3 + 1)::TEXT,
        25.47, 2.23, 1.27, 26.43, 'card', 'completed',
        NOW() - (RANDOM() * INTERVAL '30 days')
    FROM branches b
    JOIN employees e ON b.id = e.branch_id
    WHERE b.code = 'DT001' AND e.role IN ('cashier', 'manager')
    ORDER BY RANDOM()
    LIMIT 5)
    
    UNION ALL
    
    (SELECT 
        b.id,
        'TXN-' || LPAD((RANDOM() * 999999)::TEXT, 6, '0'),
        e.id,
        CASE WHEN RANDOM() < 0.7 THEN NULL ELSE (SELECT id FROM customers ORDER BY RANDOM() LIMIT 1) END,
        'TERM-' || (RANDOM() * 3 + 1)::TEXT,
        15.98, 1.40, 0, 17.38, 'cash', 'completed',
        NOW() - (RANDOM() * INTERVAL '30 days')
    FROM branches b
    JOIN employees e ON b.id = e.branch_id
    WHERE b.code = 'ML002' AND e.role IN ('cashier', 'manager')
    ORDER BY RANDOM()
    LIMIT 5)
    
    UNION ALL
    
    (SELECT 
        b.id,
        'TXN-' || LPAD((RANDOM() * 999999)::TEXT, 6, '0'),
        e.id,
        CASE WHEN RANDOM() < 0.7 THEN NULL ELSE (SELECT id FROM customers ORDER BY RANDOM() LIMIT 1) END,
        'TERM-' || (RANDOM() * 3 + 1)::TEXT,
        32.50, 2.85, 0, 35.35, 'card', 'completed',
        NOW() - (RANDOM() * INTERVAL '30 days')
    FROM branches b
    JOIN employees e ON b.id = e.branch_id
    WHERE b.code = 'AP003' AND e.role IN ('cashier', 'manager')
    ORDER BY RANDOM()
    LIMIT 3)
) txn_data;

-- Insert sample transaction items
INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, original_price, unit_cost, discount_amount, tax_amount, total_amount)
SELECT 
    t.id,
    p.id,
    (RANDOM() * 3 + 1)::INTEGER,
    p.base_price * (0.9 + RANDOM() * 0.2), -- Price variation ±10%
    p.base_price,
    p.cost,
    p.base_price * 0.05, -- 5% discount
    p.base_price * 0.0875, -- 8.75% tax
    p.base_price * 1.0375 -- Final price with tax and discount
FROM transactions t
CROSS JOIN LATERAL (
    SELECT * FROM products ORDER BY RANDOM() LIMIT (RANDOM() * 3 + 1)::INTEGER
) p
LIMIT 50;

-- Insert corresponding payments
INSERT INTO payments (transaction_id, method, amount, reference_number, status)
SELECT 
    t.id, 
    t.payment_method, 
    t.total_amount, 
    CASE 
        WHEN t.payment_method = 'card' THEN 'CARD_' || EXTRACT(EPOCH FROM NOW())::TEXT
        ELSE NULL
    END,
    'completed'
FROM transactions t;

-- =================================================================
-- PROMOTIONS DATA
-- =================================================================

-- Insert sample promotions
INSERT INTO promotions (name, description, type, branch_id, product_id, category_id, discount_percentage, min_quantity, start_date, end_date, is_active)
SELECT * FROM (
    -- Chain-wide beverage promotion
    SELECT 
        'Summer Drink Special',
        'Get 10% off all beverages during summer',
        'percentage_discount',
        NULL, -- Chain-wide
        NULL, -- Category-wide
        c.id,
        10.00,
        1,
        NOW() - INTERVAL '1 week',
        NOW() + INTERVAL '2 months',
        true
    FROM categories c WHERE c.key = 'beverages'
    
    UNION ALL
    
    -- Branch-specific bulk promotion
    SELECT 
        'Buy 2+ Coca Cola Get 15% Off',
        'Get 15% discount when buying 2 or more Coca Cola at Downtown store',
        'bulk_discount',
        b.id,
        p.id,
        NULL, -- Product-specific
        15.00,
        2,
        NOW() - INTERVAL '1 week',
        NOW() + INTERVAL '1 month',
        true
    FROM branches b 
    CROSS JOIN products p
    WHERE b.code = 'DT001' AND p.sku = 'COCA-500ML'
    
    UNION ALL
    
    -- Mall weekend special
    SELECT 
        'Mall Weekend Snack Special',
        '5% off all snacks during weekends at Mall location',
        'percentage_discount',
        b.id,
        NULL, -- Category-wide
        c.id,
        5.00,
        1,
        NOW() - INTERVAL '1 week',
        NOW() + INTERVAL '2 months',
        true
    FROM branches b 
    CROSS JOIN categories c
    WHERE b.code = 'ML002' AND c.key = 'snacks'
) promo_data;

-- =================================================================
-- SYSTEM CONFIGURATION DATA
-- =================================================================

-- Insert API keys
INSERT INTO api_keys (name, key_hash, description, permissions, is_active) VALUES
('1C Integration', 'rp_1C_DEFAULT_KEY_REPLACE_IN_PRODUCTION', 'Default API key for 1C ERP system integration', ARRAY['products:write', 'inventory:write', 'employees:write', 'transactions:read', 'sync:execute'], true),
('Mobile App', 'rp_MOBILE_APP_KEY_SECURE_HASH', 'API key for mobile application', ARRAY['products:read', 'inventory:read', 'transactions:write'], true),
('Analytics Service', 'rp_ANALYTICS_SERVICE_KEY_HASH', 'API key for analytics and reporting service', ARRAY['reports:read', 'analytics:read'], true);

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
('enable_loyalty_program', 'true', 'Enable customer loyalty program'),
('chain_name', 'RockPoint Retail Chain', 'Official chain name'),
('support_email', 'support@rockpoint.com', 'Support contact email'),
('max_daily_sales_amount', '50000', 'Maximum daily sales amount per branch'),
('inventory_sync_interval_hours', '6', 'Hours between automatic inventory syncs'),
('report_generation_time', '02:00', 'Daily time to generate automated reports');

-- =================================================================
-- LOGGING DATA
-- =================================================================

-- Insert sample sync logs
INSERT INTO branch_sync_logs (branch_id, sync_type, direction, status, records_processed, initiated_by, started_at, completed_at)
SELECT * FROM (
    (SELECT 
        b.id, 'products', 'to_branch', 'completed', 24, u.id, 
        NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours' + INTERVAL '45 seconds'
    FROM branches b, users u 
    WHERE b.code = 'DT001' AND u.username = 'admin'
    LIMIT 1)
    
    UNION ALL
    
    (SELECT 
        b.id, 'inventory', 'from_branch', 'completed', 120, u.id,
        NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '1 minute 20 seconds'
    FROM branches b, users u 
    WHERE b.code = 'ML002' AND u.username = 'admin'
    LIMIT 1)
    
    UNION ALL
    
    (SELECT 
        b.id, 'transactions', 'from_branch', 'completed', 78, u.id,
        NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '35 seconds'
    FROM branches b, users u 
    WHERE b.code = 'AP003' AND u.username = 'manager'
    LIMIT 1)
) sync_data;

-- Insert 1C sync logs
INSERT INTO onec_sync_logs (sync_type, direction, status, records_processed, started_at, completed_at)
VALUES 
('products', 'import', 'completed', 24, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' + INTERVAL '3 minutes'),
('categories', 'import', 'completed', 10, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' + INTERVAL '45 seconds'),
('employees', 'import', 'completed', 14, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '1 minute 15 seconds'),
('transactions', 'export', 'completed', 45, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour' + INTERVAL '2 minutes'),
('inventory', 'import', 'failed', 0, NOW() - INTERVAL '30 minutes', NULL);

-- Insert sample connection health logs
INSERT INTO connection_health_logs (source_type, source_id, target_type, target_id, connection_status, response_time_ms, checked_at)
SELECT 
    'chain_core', 'main',
    'branch_core', b.code,
    CASE b.network_status
        WHEN 'online' THEN 'success'
        WHEN 'offline' THEN 'failed'
        WHEN 'maintenance' THEN 'success'
        ELSE 'error'
    END,
    CASE b.network_status
        WHEN 'online' THEN (RANDOM() * 200 + 50)::INTEGER
        WHEN 'maintenance' THEN (RANDOM() * 300 + 100)::INTEGER
        ELSE NULL
    END,
    NOW() - (RANDOM() * INTERVAL '1 hour')
FROM branches b;

-- =================================================================
-- FINAL VERIFICATION AND STATISTICS
-- =================================================================

-- Update inventory based on sales simulation
UPDATE branch_inventory 
SET quantity_in_stock = GREATEST(0, quantity_in_stock - (RANDOM() * 20)::INTEGER),
    last_movement_at = NOW() - (RANDOM() * INTERVAL '7 days')
WHERE product_id IN (SELECT id FROM products WHERE sku IN ('COCA-500ML', 'PEPSI-500ML', 'CHIPS-ORG', 'SNICKERS'));

-- Final verification: Show comprehensive data counts
DO $$
BEGIN
    RAISE NOTICE '=== COMPREHENSIVE SAMPLE DATA LOADED ===';
    RAISE NOTICE 'Chains: % | Branches: % | Users: % | Employees: %', 
        (SELECT COUNT(*) FROM chains),
        (SELECT COUNT(*) FROM branches),
        (SELECT COUNT(*) FROM users),
        (SELECT COUNT(*) FROM employees);
    RAISE NOTICE 'Categories: % | Products: % | Customers: %', 
        (SELECT COUNT(*) FROM categories),
        (SELECT COUNT(*) FROM products),
        (SELECT COUNT(*) FROM customers);
    RAISE NOTICE 'Transactions: % | Transaction Items: % | Payments: %',
        (SELECT COUNT(*) FROM transactions),
        (SELECT COUNT(*) FROM transaction_items),
        (SELECT COUNT(*) FROM payments);
    RAISE NOTICE 'Branch Inventory Records: % | Branch Pricing Records: %',
        (SELECT COUNT(*) FROM branch_inventory),
        (SELECT COUNT(*) FROM branch_product_pricing);
    RAISE NOTICE 'Branch Servers: % | Active Promotions: % | API Keys: %',
        (SELECT COUNT(*) FROM branch_servers),
        (SELECT COUNT(*) FROM promotions WHERE is_active = true),
        (SELECT COUNT(*) FROM api_keys WHERE is_active = true);
    RAISE NOTICE 'Network Settings: % | System Settings: %',
        (SELECT COUNT(*) FROM network_settings),
        (SELECT COUNT(*) FROM system_settings);
    RAISE NOTICE 'Branch Sync Logs: % | 1C Sync Logs: % | Connection Logs: %',
        (SELECT COUNT(*) FROM branch_sync_logs),
        (SELECT COUNT(*) FROM onec_sync_logs),
        (SELECT COUNT(*) FROM connection_health_logs);
    RAISE NOTICE '=== Sample data ready for comprehensive testing ===';
END $$;

-- Show sample pricing data
SELECT 
    'Branch Pricing Examples' as info,
    b.name as branch_name,
    p.name as product_name,
    p.base_price,
    bpp.price as branch_price,
    bpp.discount_percentage
FROM branch_product_pricing bpp
JOIN branches b ON bpp.branch_id = b.id
JOIN products p ON bpp.product_id = p.id
WHERE p.sku IN ('COCA-500ML', 'CHIPS-ORG')
ORDER BY p.name, b.name
LIMIT 10;

-- Show inventory status
SELECT 
    'Low Stock Alert' as info,
    b.name as branch_name,
    p.name as product_name,
    bi.quantity_in_stock,
    bi.min_stock_level
FROM branch_inventory bi
JOIN branches b ON bi.branch_id = b.id
JOIN products p ON bi.product_id = p.id
WHERE bi.quantity_in_stock <= bi.min_stock_level
ORDER BY bi.quantity_in_stock
LIMIT 5;

COMMIT;
