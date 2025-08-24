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
    '$2a$12$7dF5LdKMinraTIG.r881XudA1kRVOHaiFSFeZsmTCwnltia4JQJxu'  -- bcrypt hash of 'admin1234'
) ON CONFLICT (employee_id) DO NOTHING;

-- Insert sample cashier (password: 1111)
INSERT INTO employees (employee_id, name, role, pin_hash)
VALUES (
    'cashier',
    'Sample Cashier',
    'cashier',
    '$2a$12$WHOduAjEqFD2GvsFvHu2b.q9Teu8kWhajxYF157qP7F4eyUuRRxDW'  -- bcrypt hash of '1111'
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
INSERT INTO products (sku, name, name_en, name_ru, name_uz, barcode, price, cost, quantity_in_stock, low_stock_threshold, category, brand, description, description_en, description_ru, description_uz, unit_of_measure, tax_rate, image_url, is_active) 
VALUES 
    -- Beverages Category
    ('COCA-500ML', 'Coca Cola 500ml', 'Coca Cola 500ml', 'Кока-Кола 500мл', 'Koka-Kola 500ml', '123456789012', 2.50, 1.20, 150, 20, 'Beverages', 'Coca Cola', 'Classic Coca Cola 500ml bottle', 'Classic Coca Cola 500ml bottle', 'Классическая Кока-Кола бутылка 500мл', 'Klassik Koka-Kola shisha 500ml', 'bottle', 0.1200, 'https://example.com/coca-cola.jpg', true),
    ('PEPSI-500ML', 'Pepsi 500ml', 'Pepsi 500ml', 'Пепси 500мл', 'Pepsi 500ml', '123456789013', 2.45, 1.18, 120, 20, 'Beverages', 'Pepsi', 'Pepsi Cola 500ml bottle', 'Pepsi Cola 500ml bottle', 'Пепси Кола бутылка 500мл', 'Pepsi Kola shisha 500ml', 'bottle', 0.1200, 'https://example.com/pepsi.jpg', true),
    ('WATER-1L', 'Water 1L', 'Water 1L', 'Вода 1Л', 'Suv 1L', '123456789014', 1.00, 0.40, 200, 30, 'Beverages', 'Pure Life', 'Pure drinking water 1 liter', 'Pure drinking water 1 liter', 'Чистая питьевая вода 1 литр', 'Toza ichimlik suvi 1 litr', 'bottle', 0.0000, 'https://example.com/water.jpg', true),
    ('OJ-1L', 'Orange Juice 1L', 'Orange Juice 1L', 'Апельсиновый сок 1Л', 'Apelsin sharbati 1L', '123456789015', 3.99, 2.10, 50, 10, 'Beverages', 'Tropicana', 'Fresh orange juice 1 liter', 'Fresh orange juice 1 liter', 'Свежий апельсиновый сок 1 литр', 'Yangi apelsin sharbati 1 litr', 'carton', 0.1200, 'https://example.com/orange-juice.jpg', true),
    ('AJ-1L', 'Apple Juice 1L', 'Apple Juice 1L', 'Яблочный сок 1Л', 'Olma sharbati 1L', '123456789016', 3.75, 2.00, 45, 10, 'Beverages', 'Minute Maid', 'Fresh apple juice 1 liter', 'Fresh apple juice 1 liter', 'Свежий яблочный сок 1 литр', 'Yangi olma sharbati 1 litr', 'carton', 0.1200, 'https://example.com/apple-juice.jpg', true),
    ('ENERGY-250ML', 'Energy Drink 250ml', 'Energy Drink 250ml', 'Энергетик 250мл', 'Energetik ichimlik 250ml', '123456789017', 2.99, 1.50, 80, 15, 'Beverages', 'Red Bull', 'Energy drink 250ml can', 'Energy drink 250ml can', 'Энергетический напиток банка 250мл', 'Energetik ichimlik banka 250ml', 'can', 0.1200, 'https://example.com/redbull.jpg', true),
    
    -- Snacks Category
    ('CHIPS-ORG', 'Chips Original', 'Chips Original', 'Чипсы оригинальные', 'Chiplar original', '223456789012', 3.50, 1.75, 80, 15, 'Snacks', 'Lays', 'Original flavor potato chips', 'Original flavor potato chips', 'Картофельные чипсы оригинальный вкус', 'Kartoshka chipslari original ta''mi', 'bag', 0.1200, 'https://example.com/chips.jpg', true),
    ('SNICKERS', 'Chocolate Bar', 'Chocolate Bar', 'Шоколадный батончик', 'Shokolad batoni', '223456789013', 2.99, 1.50, 60, 10, 'Snacks', 'Snickers', 'Milk chocolate with peanuts', 'Milk chocolate with peanuts', 'Молочный шоколад с арахисом', 'Sut shokoladi yong''oqli', 'bar', 0.1200, 'https://example.com/snickers.jpg', true),
    ('OREO-PACK', 'Cookies Pack', 'Cookies Pack', 'Упаковка печенья', 'Pechene paketi', '223456789014', 4.50, 2.25, 40, 8, 'Snacks', 'Oreo', 'Chocolate sandwich cookies', 'Chocolate sandwich cookies', 'Шоколадное сэндвич-печенье', 'Shokoladli sendvich pechene', 'pack', 0.1200, 'https://example.com/oreo.jpg', true),
    ('PEANUTS', 'Peanuts Roasted', 'Peanuts Roasted', 'Жареный арахис', 'Qovurilgan yong''oq', '223456789015', 2.25, 1.10, 35, 5, 'Snacks', 'Planters', 'Salted roasted peanuts', 'Salted roasted peanuts', 'Соленый жареный арахис', 'Tuzli qovurilgan yong''oq', 'bag', 0.1200, 'https://example.com/peanuts.jpg', true),
    ('POPCORN', 'Popcorn', 'Popcorn', 'Попкорн', 'Popkorn', '223456789016', 1.99, 0.90, 25, 5, 'Snacks', 'Pop Secret', 'Microwave popcorn butter flavor', 'Microwave popcorn butter flavor', 'Попкорн в микроволновке со вкусом масла', 'Mikrotolqinli popkorn sariyog'' ta''mi', 'box', 0.1200, 'https://example.com/popcorn.jpg', true),
    ('GUMMY-BEARS', 'Gummy Bears', 'Gummy Bears', 'Мишки Гамми', 'Rezina ayiqchalar', '223456789017', 3.25, 1.60, 30, 6, 'Snacks', 'Haribo', 'Fruit gummy bears candy', 'Fruit gummy bears candy', 'Фруктовые мишки Гамми', 'Mevali rezina ayiqchalar', 'bag', 0.1200, 'https://example.com/gummy-bears.jpg', true),
    
    -- Dairy Category
    ('MILK-1L', 'Milk 1L', 'Milk 1L', 'Молоко 1Л', 'Sut 1L', '323456789012', 3.25, 2.00, 75, 12, 'Dairy', 'Farm Fresh', 'Whole milk 1 liter', 'Whole milk 1 liter', 'Цельное молоко 1 литр', 'To''liq sut 1 litr', 'carton', 0.0000, 'https://example.com/milk.jpg', true),
    ('YOGURT-PLAIN', 'Yogurt Vanilla', 'Yogurt Vanilla', 'Ванильный йогурт', 'Vanil yogurt', '323456789013', 1.99, 0.95, 45, 8, 'Dairy', 'Danone', 'Vanilla flavored yogurt', 'Vanilla flavored yogurt', 'Ванильный йогурт', 'Vanil ta''midagi yogurt', 'cup', 0.1200, 'https://example.com/yogurt.jpg', true),
    ('CHEESE-SLICE', 'Cheese Slices', 'Cheese Slices', 'Сырные ломтики', 'Pishloq bo''laklari', '323456789014', 4.99, 2.50, 30, 5, 'Dairy', 'Kraft', 'American cheese slices', 'American cheese slices', 'Американские сырные ломтики', 'Amerika pishloq bo''laklari', 'pack', 0.1200, 'https://example.com/cheese.jpg', true),
    ('BUTTER-500G', 'Butter 500g', 'Butter 500g', 'Масло 500г', 'Sariyog'' 500g', '323456789015', 5.50, 3.20, 25, 3, 'Dairy', 'Land O Lakes', 'Salted butter 500 grams', 'Salted butter 500 grams', 'Соленое масло 500 грамм', 'Tuzli sariyog'' 500 gramm', 'pack', 0.1200, 'https://example.com/butter.jpg', true),
    ('YOGURT-GREEK', 'Greek Yogurt', 'Greek Yogurt', 'Греческий йогурт', 'Grek yogurti', '323456789016', 2.49, 1.25, 35, 6, 'Dairy', 'Chobani', 'Plain Greek yogurt', 'Plain Greek yogurt', 'Простой греческий йогурт', 'Oddiy grek yogurti', 'cup', 0.1200, 'https://example.com/greek-yogurt.jpg', true),
    ('CREAM-CHEESE', 'Cream Cheese', 'Cream Cheese', 'Сливочный сыр', 'Qaymoqli pishloq', '323456789017', 3.99, 2.10, 20, 4, 'Dairy', 'Philadelphia', 'Original cream cheese', 'Original cream cheese', 'Оригинальный сливочный сыр', 'Original qaymoqli pishloq', 'pack', 0.1200, 'https://example.com/cream-cheese.jpg', true),
    
    -- Bakery Category
    ('BREAD-WHITE', 'White Bread', 'White Bread', 'Белый хлеб', 'Oq non', '423456789012', 2.75, 1.30, 40, 8, 'Bakery', 'Wonder', 'Sliced white bread loaf', 'Sliced white bread loaf', 'Нарезанная буханка белого хлеба', 'To''g''ralgan oq non boshli', 'loaf', 0.0000, 'https://example.com/white-bread.jpg', true),
    ('BREAD-WHEAT', 'Whole Wheat Bread', 'Whole Wheat Bread', 'Цельнозерновой хлеб', 'To''liq bug''doy noni', '423456789013', 3.25, 1.60, 35, 6, 'Bakery', 'Pepperidge Farm', 'Whole wheat bread loaf', 'Whole wheat bread loaf', 'Буханка цельнозернового хлеба', 'To''liq bug''doy noni boshli', 'loaf', 0.0000, 'https://example.com/wheat-bread.jpg', true),
    ('CROISSANT', 'Croissant', 'Croissant', 'Круассан', 'Kruassan', '423456789014', 1.50, 0.75, 20, 4, 'Bakery', 'Fresh Baked', 'Buttery croissant pastry', 'Buttery croissant pastry', 'Масляное тесто круассан', 'Sariyog''li kruassan xamiri', 'piece', 0.1200, 'https://example.com/croissant.jpg', true),
    ('BAGELS-6', 'Bagels 6-pack', 'Bagels 6-pack', 'Бейглы 6 штук', 'Begellar 6 ta', '423456789015', 4.99, 2.40, 15, 3, 'Bakery', 'Thomas', 'Everything bagels 6 pack', 'Everything bagels 6 pack', 'Бейглы со всем 6 штук', 'Hamma narsali begellar 6 ta', 'pack', 0.1200, 'https://example.com/bagels.jpg', true),
    ('DONUTS-12', 'Donuts 12-pack', 'Donuts 12-pack', 'Пончики 12 штук', 'Donutlar 12 ta', '423456789016', 6.99, 3.50, 10, 2, 'Bakery', 'Krispy Kreme', 'Glazed donuts 12 pack', 'Glazed donuts 12 pack', 'Глазированные пончики 12 штук', 'Sirlangan donutlar 12 ta', 'pack', 0.1200, 'https://example.com/donuts.jpg', true),
    ('MUFFINS-4', 'Muffins 4-pack', 'Muffins 4-pack', 'Кексы 4 штуки', 'Kekslar 4 ta', '423456789017', 3.99, 2.00, 18, 3, 'Bakery', 'Fresh Baked', 'Blueberry muffins 4 pack', 'Blueberry muffins 4 pack', 'Черничные кексы 4 штуки', 'Ko''k rezavorang kekslar 4 ta', 'pack', 0.1200, 'https://example.com/muffins.jpg', true),
    
    -- Personal Care Category
    ('TOOTHPASTE-COL', 'Toothpaste', 'Toothpaste', 'Зубная паста', 'Tish pastasi', '523456789012', 3.99, 2.10, 50, 8, 'Personal Care', 'Colgate', 'Whitening toothpaste', 'Whitening toothpaste', 'Отбеливающая зубная паста', 'Oqartiruvchi tish pastasi', 'tube', 0.1200, 'https://example.com/toothpaste.jpg', true),
    ('SHAMPOO-400ML', 'Shampoo 400ml', 'Shampoo 400ml', 'Шампунь 400мл', 'Shampun 400ml', '523456789013', 6.99, 3.50, 30, 5, 'Personal Care', 'Head & Shoulders', 'Dandruff shampoo 400ml', 'Dandruff shampoo 400ml', 'Шампунь от перхоти 400мл', 'Kepak qarshi shampun 400ml', 'bottle', 0.1200, 'https://example.com/shampoo.jpg', true),
    ('SOAP-BAR', 'Soap Bar', 'Soap Bar', 'Мыло', 'Sovun', '523456789014', 1.99, 0.80, 60, 10, 'Personal Care', 'Dove', 'Moisturizing soap bar', 'Moisturizing soap bar', 'Увлажняющее мыло', 'Namlovchi sovun', 'bar', 0.1200, 'https://example.com/soap.jpg', true),
    ('DEODORANT-AXE', 'Deodorant', 'Deodorant', 'Дезодорант', 'Dezodorant', '523456789015', 4.50, 2.25, 25, 5, 'Personal Care', 'Axe', 'Body spray deodorant', 'Body spray deodorant', 'Спрей-дезодорант для тела', 'Tana uchun sprey dezodorant', 'bottle', 0.1200, 'https://example.com/deodorant.jpg', true),
    ('RAZORS-3', 'Razors 3-pack', 'Razors 3-pack', 'Бритвы 3 штуки', 'Usturalar 3 ta', '523456789016', 7.99, 4.00, 20, 4, 'Personal Care', 'Gillette', 'Disposable razors 3 pack', 'Disposable razors 3 pack', 'Одноразовые бритвы 3 штуки', 'Bir martalik usturalar 3 ta', 'pack', 0.1200, 'https://example.com/razors.jpg', true),
    ('SANITIZER-8OZ', 'Hand Sanitizer', 'Hand Sanitizer', 'Дезинфектор для рук', 'Qo''l dezinfektori', '523456789017', 2.99, 1.50, 40, 8, 'Personal Care', 'Purell', 'Hand sanitizer gel 8oz', 'Hand sanitizer gel 8oz', 'Гель дезинфектор для рук 8 унций', 'Qo''l dezinfektor geli 8 untsiya', 'bottle', 0.1200, 'https://example.com/sanitizer.jpg', true),
    
    -- Household Category
    ('PAPER-TOWELS', 'Paper Towels', 'Paper Towels', 'Бумажные полотенца', 'Qog''oz sochiqlar', '623456789012', 5.99, 3.00, 40, 6, 'Household', 'Bounty', 'Absorbent paper towels', 'Absorbent paper towels', 'Впитывающие бумажные полотенца', 'Shimuvchi qog''oz sochiqlar', 'roll', 0.1200, 'https://example.com/paper-towels.jpg', true),
    ('TOILET-PAPER', 'Toilet Paper 12-pack', 'Toilet Paper 12-pack', 'Туалетная бумага 12 рулонов', 'Hojatxona qog''ozi 12 ta', '623456789013', 12.99, 6.50, 20, 3, 'Household', 'Charmin', 'Ultra soft toilet paper', 'Ultra soft toilet paper', 'Ультра мягкая туалетная бумага', 'Ultra yumshoq hojatxona qog''ozi', 'pack', 0.1200, 'https://example.com/toilet-paper.jpg', true),
    ('DISH-SOAP', 'Dish Soap', 'Dish Soap', 'Средство для мытья посуды', 'Idish yuvish vositasi', '623456789014', 2.99, 1.40, 35, 6, 'Household', 'Dawn', 'Grease-fighting dish soap', 'Grease-fighting dish soap', 'Средство против жира для посуды', 'Yog''ga qarshi idish sovuni', 'bottle', 0.1200, 'https://example.com/dish-soap.jpg', true),
    ('DETERGENT-TIDE', 'Laundry Detergent', 'Laundry Detergent', 'Стиральный порошок', 'Kir yuvish kukuni', '623456789015', 8.99, 4.50, 18, 3, 'Household', 'Tide', 'High efficiency detergent', 'High efficiency detergent', 'Высокоэффективный стиральный порошок', 'Yuqori samarali kir yuvish kukuni', 'box', 0.1200, 'https://example.com/detergent.jpg', true),
    ('TRASH-BAGS', 'Trash Bags 30-pack', 'Trash Bags 30-pack', 'Мусорные мешки 30 штук', 'Axlat xaltalari 30 ta', '623456789016', 4.99, 2.50, 25, 5, 'Household', 'Glad', 'Kitchen trash bags 30 pack', 'Kitchen trash bags 30 pack', 'Кухонные мусорные мешки 30 штук', 'Oshxona axlat xaltalari 30 ta', 'pack', 0.1200, 'https://example.com/trash-bags.jpg', true),
    ('CLEANER-SPRAY', 'All-Purpose Cleaner', 'All-Purpose Cleaner', 'Универсальное чистящее средство', 'Universal tozalovchi vosita', '623456789017', 3.49, 1.75, 30, 5, 'Household', 'Mr. Clean', 'Multi-surface cleaner spray', 'Multi-surface cleaner spray', 'Спрей для многих поверхностей', 'Ko''p sirtlar uchun spreyi', 'bottle', 0.1200, 'https://example.com/cleaner.jpg', true),
    
    -- Electronics Category
    ('CHARGER-USB', 'Phone Charger Cable', 'Phone Charger Cable', 'Зарядный кабель телефона', 'Telefon zaryadlash kabeli', '723456789012', 9.99, 4.00, 25, 5, 'Electronics', 'Generic', 'USB charging cable', 'USB charging cable', 'USB зарядный кабель', 'USB zaryadlash kabeli', 'piece', 0.1200, 'https://example.com/charger.jpg', true),
    ('BATTERIES-AA', 'Batteries AA 4-pack', 'Batteries AA 4-pack', 'Батарейки AA 4 штуки', 'Batareyalar AA 4 ta', '723456789013', 4.99, 2.20, 30, 5, 'Electronics', 'Duracell', 'Alkaline AA batteries', 'Alkaline AA batteries', 'Щелочные батарейки AA', 'Alkalin AA batareyalar', 'pack', 0.1200, 'https://example.com/batteries.jpg', true),
    ('PHONE-CASE', 'Phone Case', 'Phone Case', 'Чехол для телефона', 'Telefon g''ilofi', '723456789014', 14.99, 7.50, 15, 3, 'Electronics', 'OtterBox', 'Protective phone case', 'Protective phone case', 'Защитный чехол для телефона', 'Himoyalovchi telefon g''ilofi', 'piece', 0.1200, 'https://example.com/phone-case.jpg', true),
    ('EARBUDS-WIRED', 'Earbuds', 'Earbuds', 'Наушники', 'Quloqchinlar', '723456789015', 19.99, 10.00, 12, 2, 'Electronics', 'Apple', 'Wired earbuds with mic', 'Wired earbuds with mic', 'Проводные наушники с микрофоном', 'Simli quloqchinlar mikrofon bilan', 'piece', 0.1200, 'https://example.com/earbuds.jpg', true),
    ('POWERBANK-10K', 'Power Bank', 'Power Bank', 'Внешний аккумулятор', 'Tashqi akkumulyator', '723456789016', 24.99, 12.50, 8, 2, 'Electronics', 'Anker', 'Portable power bank 10000mAh', 'Portable power bank 10000mAh', 'Портативный внешний аккумулятор 10000мАч', 'Ko''chma tashqi akkumulyator 10000mAh', 'piece', 0.1200, 'https://example.com/power-bank.jpg', true),
    ('USB-DRIVE-32GB', 'USB Flash Drive', 'USB Flash Drive', 'USB флешка', 'USB flesh disk', '723456789017', 12.99, 6.50, 20, 4, 'Electronics', 'SanDisk', '32GB USB flash drive', '32GB USB flash drive', '32ГБ USB флешка', '32GB USB flesh disk', 'piece', 0.1200, 'https://example.com/usb-drive.jpg', true);

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
