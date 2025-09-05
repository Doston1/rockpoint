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
('beverages', 'Beverages', 'Напитки', 'Ichimliklar'),
('snacks', 'Snacks', 'Закуски', 'Gazaklar'),
('dairy', 'Dairy', 'Молочные продукты', 'Sut mahsulotlari'),
('meat', 'Meat', 'Мясо и птица', 'Go''sht va parrandachilik'),
('bakery', 'Bakery', 'Хлебобулочные изделия', 'Non mahsulotlari'),
('frozen', 'Frozen', 'Замороженные продукты', 'Muzlatilgan mahsulotlar'),
('personal_care', 'Personal Care', 'Личная гигиена', 'Shaxsiy gigiyena'),
('household', 'Household', 'Бытовая химия', 'Maishiy kimyoviy moddalar'),
('electronics', 'Electronics', 'Электроника', 'Elektronika'),
('clothing', 'Clothing', 'Одежда', 'Kiyim-kechak')
ON CONFLICT (key) DO NOTHING;

-- =================================================================
-- SAMPLE PRODUCTS DATA
-- =================================================================

-- Clear existing products first
DELETE FROM products;

-- Insert comprehensive sample products
INSERT INTO products (sku, name, name_en, name_ru, name_uz, barcode, price, cost, quantity_in_stock, low_stock_threshold, category_id, brand, description, description_en, description_ru, description_uz, unit_of_measure, tax_rate, image_url, is_active) 
VALUES 
    -- Beverages Category
    ('COCA-500ML', 'Coca Cola 500ml', 'Coca Cola 500ml', 'Кока-Кола 500мл', 'Koka-Kola 500ml', '123456789012', 2.50, 1.20, 150, 20, (SELECT id FROM categories WHERE key = 'beverages'), 'Coca Cola', 'Classic Coca Cola 500ml bottle', 'Classic Coca Cola 500ml bottle', 'Классическая Кока-Кола бутылка 500мл', 'Klassik Koka-Kola shisha 500ml', 'bottle', 0.1200, 'https://example.com/coca-cola.jpg', true),
    ('PEPSI-500ML', 'Pepsi 500ml', 'Pepsi 500ml', 'Пепси 500мл', 'Pepsi 500ml', '123456789013', 2.45, 1.18, 120, 20, (SELECT id FROM categories WHERE key = 'beverages'), 'Pepsi', 'Pepsi Cola 500ml bottle', 'Pepsi Cola 500ml bottle', 'Пепси Кола бутылка 500мл', 'Pepsi Kola shisha 500ml', 'bottle', 0.1200, 'https://example.com/pepsi.jpg', true),
    ('WATER-1L', 'Water 1L', 'Water 1L', 'Вода 1Л', 'Suv 1L', '123456789014', 1.00, 0.40, 200, 30, (SELECT id FROM categories WHERE key = 'beverages'), 'Pure Life', 'Pure drinking water 1 liter', 'Pure drinking water 1 liter', 'Чистая питьевая вода 1 литр', 'Toza ichimlik suvi 1 litr', 'bottle', 0.0000, 'https://example.com/water.jpg', true),
    ('OJ-1L', 'Orange Juice 1L', 'Orange Juice 1L', 'Апельсиновый сок 1Л', 'Apelsin sharbati 1L', '123456789015', 3.99, 2.10, 50, 10, (SELECT id FROM categories WHERE key = 'beverages'), 'Tropicana', 'Fresh orange juice 1 liter', 'Fresh orange juice 1 liter', 'Свежий апельсиновый сок 1 литр', 'Yangi apelsin sharbati 1 litr', 'carton', 0.1200, 'https://example.com/orange-juice.jpg', true),
    ('AJ-1L', 'Apple Juice 1L', 'Apple Juice 1L', 'Яблочный сок 1Л', 'Olma sharbati 1L', '123456789016', 3.75, 2.00, 45, 10, (SELECT id FROM categories WHERE key = 'beverages'), 'Minute Maid', 'Fresh apple juice 1 liter', 'Fresh apple juice 1 liter', 'Свежий яблочный сок 1 литр', 'Yangi olma sharbati 1 litr', 'carton', 0.1200, 'https://example.com/apple-juice.jpg', true),
    ('ENERGY-250ML', 'Energy Drink 250ml', 'Energy Drink 250ml', 'Энергетик 250мл', 'Energetik ichimlik 250ml', '123456789017', 2.99, 1.50, 80, 15, (SELECT id FROM categories WHERE key = 'beverages'), 'Red Bull', 'Energy drink 250ml can', 'Energy drink 250ml can', 'Энергетический напиток банка 250мл', 'Energetik ichimlik banka 250ml', 'can', 0.1200, 'https://example.com/redbull.jpg', true),
    
    -- Snacks Category
    ('CHIPS-ORG', 'Chips Original', 'Chips Original', 'Чипсы оригинальные', 'Chiplar original', '223456789012', 3.50, 1.75, 80, 15, (SELECT id FROM categories WHERE key = 'snacks'), 'Lays', 'Original flavor potato chips', 'Original flavor potato chips', 'Картофельные чипсы оригинальный вкус', 'Kartoshka chipslari original ta''mi', 'bag', 0.1200, 'https://example.com/chips.jpg', true),
    ('SNICKERS', 'Chocolate Bar', 'Chocolate Bar', 'Шоколадный батончик', 'Shokolad batoni', '223456789013', 2.99, 1.50, 60, 10, (SELECT id FROM categories WHERE key = 'snacks'), 'Snickers', 'Milk chocolate with peanuts', 'Milk chocolate with peanuts', 'Молочный шоколад с арахисом', 'Sut shokoladi yong''oqli', 'bar', 0.1200, 'https://example.com/snickers.jpg', true),
    ('OREO-PACK', 'Cookies Pack', 'Cookies Pack', 'Упаковка печенья', 'Pechene paketi', '223456789014', 4.50, 2.25, 40, 8, (SELECT id FROM categories WHERE key = 'snacks'), 'Oreo', 'Chocolate sandwich cookies', 'Chocolate sandwich cookies', 'Шоколадное сэндвич-печенье', 'Shokoladli sendvich pechene', 'pack', 0.1200, 'https://example.com/oreo.jpg', true),
    ('PEANUTS', 'Peanuts Roasted', 'Peanuts Roasted', 'Жареный арахис', 'Qovurilgan yong''oq', '223456789015', 2.25, 1.10, 35, 5, (SELECT id FROM categories WHERE key = 'snacks'), 'Planters', 'Salted roasted peanuts', 'Salted roasted peanuts', 'Соленый жареный арахис', 'Tuzli qovurilgan yong''oq', 'bag', 0.1200, 'https://example.com/peanuts.jpg', true),
    ('POPCORN', 'Popcorn', 'Popcorn', 'Попкорн', 'Popkorn', '223456789016', 1.99, 0.90, 25, 5, (SELECT id FROM categories WHERE key = 'snacks'), 'Pop Secret', 'Microwave popcorn butter flavor', 'Microwave popcorn butter flavor', 'Попкорн в микроволновке со вкусом масла', 'Mikrotolqinli popkorn sariyog'' ta''mi', 'box', 0.1200, 'https://example.com/popcorn.jpg', true),
    ('GUMMY-BEARS', 'Gummy Bears', 'Gummy Bears', 'Мишки Гамми', 'Rezina ayiqchalar', '223456789017', 3.25, 1.60, 30, 6, (SELECT id FROM categories WHERE key = 'snacks'), 'Haribo', 'Fruit gummy bears candy', 'Fruit gummy bears candy', 'Фруктовые мишки Гамми', 'Mevali rezina ayiqchalar', 'bag', 0.1200, 'https://example.com/gummy-bears.jpg', true),
    
    -- Dairy Category
    ('MILK-1L', 'Milk 1L', 'Milk 1L', 'Молоко 1Л', 'Sut 1L', '323456789012', 3.25, 2.00, 75, 12, (SELECT id FROM categories WHERE key = 'dairy'), 'Farm Fresh', 'Whole milk 1 liter', 'Whole milk 1 liter', 'Цельное молоко 1 литр', 'To''liq sut 1 litr', 'carton', 0.0000, 'https://example.com/milk.jpg', true),
    ('YOGURT-PLAIN', 'Yogurt Vanilla', 'Yogurt Vanilla', 'Ванильный йогурт', 'Vanil yogurt', '323456789013', 1.99, 0.95, 45, 8, (SELECT id FROM categories WHERE key = 'dairy'), 'Danone', 'Vanilla flavored yogurt', 'Vanilla flavored yogurt', 'Ванильный йогурт', 'Vanil ta''midagi yogurt', 'cup', 0.1200, 'https://example.com/yogurt.jpg', true),
    ('CHEESE-SLICE', 'Cheese Slices', 'Cheese Slices', 'Сырные ломтики', 'Pishloq bo''laklari', '323456789014', 4.99, 2.50, 30, 5, (SELECT id FROM categories WHERE key = 'dairy'), 'Kraft', 'American cheese slices', 'American cheese slices', 'Американские сырные ломтики', 'Amerika pishloq bo''laklari', 'pack', 0.1200, 'https://example.com/cheese.jpg', true),
    ('BUTTER-500G', 'Butter 500g', 'Butter 500g', 'Масло 500г', 'Sariyog'' 500g', '323456789015', 5.50, 3.20, 25, 3, (SELECT id FROM categories WHERE key = 'dairy'), 'Land O Lakes', 'Salted butter 500 grams', 'Salted butter 500 grams', 'Соленое масло 500 грамм', 'Tuzli sariyog'' 500 gramm', 'pack', 0.1200, 'https://example.com/butter.jpg', true),
    ('YOGURT-GREEK', 'Greek Yogurt', 'Greek Yogurt', 'Греческий йогурт', 'Grek yogurti', '323456789016', 2.49, 1.25, 35, 6, (SELECT id FROM categories WHERE key = 'dairy'), 'Chobani', 'Plain Greek yogurt', 'Plain Greek yogurt', 'Простой греческий йогурт', 'Oddiy grek yogurti', 'cup', 0.1200, 'https://example.com/greek-yogurt.jpg', true),
    ('CREAM-CHEESE', 'Cream Cheese', 'Cream Cheese', 'Сливочный сыр', 'Qaymoqli pishloq', '323456789017', 3.99, 2.10, 20, 4, (SELECT id FROM categories WHERE key = 'dairy'), 'Philadelphia', 'Original cream cheese', 'Original cream cheese', 'Оригинальный сливочный сыр', 'Original qaymoqli pishloq', 'pack', 0.1200, 'https://example.com/cream-cheese.jpg', true),
    
    -- Bakery Category
    ('BREAD-WHITE', 'White Bread', 'White Bread', 'Белый хлеб', 'Oq non', '423456789012', 2.75, 1.30, 40, 8, (SELECT id FROM categories WHERE key = 'bakery'), 'Wonder', 'Sliced white bread loaf', 'Sliced white bread loaf', 'Нарезанная буханка белого хлеба', 'To''g''ralgan oq non boshli', 'loaf', 0.0000, 'https://example.com/white-bread.jpg', true),
    ('BREAD-WHEAT', 'Whole Wheat Bread', 'Whole Wheat Bread', 'Цельнозерновой хлеб', 'To''liq bug''doy noni', '423456789013', 3.25, 1.60, 35, 6, (SELECT id FROM categories WHERE key = 'bakery'), 'Pepperidge Farm', 'Whole wheat bread loaf', 'Whole wheat bread loaf', 'Буханка цельнозернового хлеба', 'To''liq bug''doy noni boshli', 'loaf', 0.0000, 'https://example.com/wheat-bread.jpg', true),
    ('CROISSANT', 'Croissant', 'Croissant', 'Круассан', 'Kruassan', '423456789014', 1.50, 0.75, 20, 4, (SELECT id FROM categories WHERE key = 'bakery'), 'Fresh Baked', 'Buttery croissant pastry', 'Buttery croissant pastry', 'Масляное тесто круассан', 'Sariyog''li kruassan xamiri', 'piece', 0.1200, 'https://example.com/croissant.jpg', true),
    ('BAGELS-6', 'Bagels 6-pack', 'Bagels 6-pack', 'Бейглы 6 штук', 'Begellar 6 ta', '423456789015', 4.99, 2.40, 15, 3, (SELECT id FROM categories WHERE key = 'bakery'), 'Thomas', 'Everything bagels 6 pack', 'Everything bagels 6 pack', 'Бейглы со всем 6 штук', 'Hamma narsali begellar 6 ta', 'pack', 0.1200, 'https://example.com/bagels.jpg', true),
    ('DONUTS-12', 'Donuts 12-pack', 'Donuts 12-pack', 'Пончики 12 штук', 'Donutlar 12 ta', '423456789016', 6.99, 3.50, 10, 2, (SELECT id FROM categories WHERE key = 'bakery'), 'Krispy Kreme', 'Glazed donuts 12 pack', 'Glazed donuts 12 pack', 'Глазированные пончики 12 штук', 'Sirlangan donutlar 12 ta', 'pack', 0.1200, 'https://example.com/donuts.jpg', true),
    ('MUFFINS-4', 'Muffins 4-pack', 'Muffins 4-pack', 'Кексы 4 штуки', 'Kekslar 4 ta', '423456789017', 3.99, 2.00, 18, 3, (SELECT id FROM categories WHERE key = 'bakery'), 'Fresh Baked', 'Blueberry muffins 4 pack', 'Blueberry muffins 4 pack', 'Черничные кексы 4 штуки', 'Ko''k rezavorang kekslar 4 ta', 'pack', 0.1200, 'https://example.com/muffins.jpg', true),
    
    -- Personal Care Category
    ('TOOTHPASTE-COL', 'Toothpaste', 'Toothpaste', 'Зубная паста', 'Tish pastasi', '523456789012', 3.99, 2.10, 50, 8, (SELECT id FROM categories WHERE key = 'personal_care'), 'Colgate', 'Whitening toothpaste', 'Whitening toothpaste', 'Отбеливающая зубная паста', 'Oqartiruvchi tish pastasi', 'tube', 0.1200, 'https://example.com/toothpaste.jpg', true),
    ('SHAMPOO-400ML', 'Shampoo 400ml', 'Shampoo 400ml', 'Шампунь 400мл', 'Shampun 400ml', '523456789013', 6.99, 3.50, 30, 5, (SELECT id FROM categories WHERE key = 'personal_care'), 'Head & Shoulders', 'Dandruff shampoo 400ml', 'Dandruff shampoo 400ml', 'Шампунь от перхоти 400мл', 'Kepak qarshi shampun 400ml', 'bottle', 0.1200, 'https://example.com/shampoo.jpg', true),
    ('SOAP-BAR', 'Soap Bar', 'Soap Bar', 'Мыло', 'Sovun', '523456789014', 1.99, 0.80, 60, 10, (SELECT id FROM categories WHERE key = 'personal_care'), 'Dove', 'Moisturizing soap bar', 'Moisturizing soap bar', 'Увлажняющее мыло', 'Namlovchi sovun', 'bar', 0.1200, 'https://example.com/soap.jpg', true),
    ('DEODORANT-AXE', 'Deodorant', 'Deodorant', 'Дезодорант', 'Dezodorant', '523456789015', 4.50, 2.25, 25, 5, (SELECT id FROM categories WHERE key = 'personal_care'), 'Axe', 'Body spray deodorant', 'Body spray deodorant', 'Спрей-дезодорант для тела', 'Tana uchun sprey dezodorant', 'bottle', 0.1200, 'https://example.com/deodorant.jpg', true),
    ('RAZORS-3', 'Razors 3-pack', 'Razors 3-pack', 'Бритвы 3 штуки', 'Usturalar 3 ta', '523456789016', 7.99, 4.00, 20, 4, (SELECT id FROM categories WHERE key = 'personal_care'), 'Gillette', 'Disposable razors 3 pack', 'Disposable razors 3 pack', 'Одноразовые бритвы 3 штуки', 'Bir martalik usturalar 3 ta', 'pack', 0.1200, 'https://example.com/razors.jpg', true),
    ('SANITIZER-8OZ', 'Hand Sanitizer', 'Hand Sanitizer', 'Дезинфектор для рук', 'Qo''l dezinfektori', '523456789017', 2.99, 1.50, 40, 8, (SELECT id FROM categories WHERE key = 'personal_care'), 'Purell', 'Hand sanitizer gel 8oz', 'Hand sanitizer gel 8oz', 'Гель дезинфектор для рук 8 унций', 'Qo''l dezinfektor geli 8 untsiya', 'bottle', 0.1200, 'https://example.com/sanitizer.jpg', true),
    
    -- Household Category
    ('PAPER-TOWELS', 'Paper Towels', 'Paper Towels', 'Бумажные полотенца', 'Qog''oz sochiqlar', '623456789012', 5.99, 3.00, 40, 6, (SELECT id FROM categories WHERE key = 'household'), 'Bounty', 'Absorbent paper towels', 'Absorbent paper towels', 'Впитывающие бумажные полотенца', 'Shimuvchi qog''oz sochiqlar', 'roll', 0.1200, 'https://example.com/paper-towels.jpg', true),
    ('TOILET-PAPER', 'Toilet Paper 12-pack', 'Toilet Paper 12-pack', 'Туалетная бумага 12 рулонов', 'Hojatxona qog''ozi 12 ta', '623456789013', 12.99, 6.50, 20, 3, (SELECT id FROM categories WHERE key = 'household'), 'Charmin', 'Ultra soft toilet paper', 'Ultra soft toilet paper', 'Ультра мягкая туалетная бумага', 'Ultra yumshoq hojatxona qog''ozi', 'pack', 0.1200, 'https://example.com/toilet-paper.jpg', true),
    ('DISH-SOAP', 'Dish Soap', 'Dish Soap', 'Средство для мытья посуды', 'Idish yuvish vositasi', '623456789014', 2.99, 1.40, 35, 6, (SELECT id FROM categories WHERE key = 'household'), 'Dawn', 'Grease-fighting dish soap', 'Grease-fighting dish soap', 'Средство против жира для посуды', 'Yog''ga qarshi idish sovuni', 'bottle', 0.1200, 'https://example.com/dish-soap.jpg', true),
    ('DETERGENT-TIDE', 'Laundry Detergent', 'Laundry Detergent', 'Стиральный порошок', 'Kir yuvish kukuni', '623456789015', 8.99, 4.50, 18, 3, (SELECT id FROM categories WHERE key = 'household'), 'Tide', 'High efficiency detergent', 'High efficiency detergent', 'Высокоэффективный стиральный порошок', 'Yuqori samarali kir yuvish kukuni', 'box', 0.1200, 'https://example.com/detergent.jpg', true),
    ('TRASH-BAGS', 'Trash Bags 30-pack', 'Trash Bags 30-pack', 'Мусорные мешки 30 штук', 'Axlat xaltalari 30 ta', '623456789016', 4.99, 2.50, 25, 5, (SELECT id FROM categories WHERE key = 'household'), 'Glad', 'Kitchen trash bags 30 pack', 'Kitchen trash bags 30 pack', 'Кухонные мусорные мешки 30 штук', 'Oshxona axlat xaltalari 30 ta', 'pack', 0.1200, 'https://example.com/trash-bags.jpg', true),
    ('CLEANER-SPRAY', 'All-Purpose Cleaner', 'All-Purpose Cleaner', 'Универсальное чистящее средство', 'Universal tozalovchi vosita', '623456789017', 3.49, 1.75, 30, 5, (SELECT id FROM categories WHERE key = 'household'), 'Mr. Clean', 'Multi-surface cleaner spray', 'Multi-surface cleaner spray', 'Спрей для многих поверхностей', 'Ko''p sirtlar uchun spreyi', 'bottle', 0.1200, 'https://example.com/cleaner.jpg', true),
    
    -- Electronics Category
    ('CHARGER-USB', 'Phone Charger Cable', 'Phone Charger Cable', 'Зарядный кабель телефона', 'Telefon zaryadlash kabeli', '723456789012', 9.99, 4.00, 25, 5, (SELECT id FROM categories WHERE key = 'electronics'), 'Generic', 'USB charging cable', 'USB charging cable', 'USB зарядный кабель', 'USB zaryadlash kabeli', 'piece', 0.1200, 'https://example.com/charger.jpg', true),
    ('BATTERIES-AA', 'Batteries AA 4-pack', 'Batteries AA 4-pack', 'Батарейки AA 4 штуки', 'Batareyalar AA 4 ta', '723456789013', 4.99, 2.20, 30, 5, (SELECT id FROM categories WHERE key = 'electronics'), 'Duracell', 'Alkaline AA batteries', 'Alkaline AA batteries', 'Щелочные батарейки AA', 'Alkalin AA batareyalar', 'pack', 0.1200, 'https://example.com/batteries.jpg', true),
    ('PHONE-CASE', 'Phone Case', 'Phone Case', 'Чехол для телефона', 'Telefon g''ilofi', '723456789014', 14.99, 7.50, 15, 3, (SELECT id FROM categories WHERE key = 'electronics'), 'OtterBox', 'Protective phone case', 'Protective phone case', 'Защитный чехол для телефона', 'Himoyalovchi telefon g''ilofi', 'piece', 0.1200, 'https://example.com/phone-case.jpg', true),
    ('EARBUDS-WIRED', 'Earbuds', 'Earbuds', 'Наушники', 'Quloqchinlar', '723456789015', 19.99, 10.00, 12, 2, (SELECT id FROM categories WHERE key = 'electronics'), 'Apple', 'Wired earbuds with mic', 'Wired earbuds with mic', 'Проводные наушники с микрофоном', 'Simli quloqchinlar mikrofon bilan', 'piece', 0.1200, 'https://example.com/earbuds.jpg', true),
    ('POWERBANK-10K', 'Power Bank', 'Power Bank', 'Внешний аккумулятор', 'Tashqi akkumulyator', '723456789016', 24.99, 12.50, 8, 2, (SELECT id FROM categories WHERE key = 'electronics'), 'Anker', 'Portable power bank 10000mAh', 'Portable power bank 10000mAh', 'Портативный внешний аккумулятор 10000мАч', 'Ko''chma tashqi akkumulyator 10000mAh', 'piece', 0.1200, 'https://example.com/power-bank.jpg', true),
    ('USB-DRIVE-32GB', 'USB Flash Drive', 'USB Flash Drive', 'USB флешка', 'USB flesh disk', '723456789017', 12.99, 6.50, 20, 4, (SELECT id FROM categories WHERE key = 'electronics'), 'SanDisk', '32GB USB flash drive', '32GB USB flash drive', '32ГБ USB флешка', '32GB USB flesh disk', 'piece', 0.1200, 'https://example.com/usb-drive.jpg', true);

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
    c.key as category_key, 
    c.name_en as category_name,
    COUNT(*) as product_count,
    ROUND(AVG(p.price), 2) as avg_price,
    SUM(p.quantity_in_stock) as total_stock
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.is_active = true
GROUP BY c.key, c.name_en 
ORDER BY c.key;

-- Show low stock products (if any)
SELECT 
    p.name,
    c.name_en as category_name,
    p.quantity_in_stock,
    p.low_stock_threshold,
    p.price
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.quantity_in_stock <= p.low_stock_threshold
ORDER BY p.quantity_in_stock ASC;

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

-- =================================================================
-- PAYMENT METHODS SAMPLE DATA
-- =================================================================

-- Insert branch payment methods status (simulating sync from chain-core)
-- This shows which payment methods are currently active for this branch
INSERT INTO branch_payment_methods_status (payment_method_code, payment_method_name, is_enabled, priority, daily_limit, transaction_limit, credentials_configured, last_sync_at, sync_status) VALUES
('uzum_fastpay', 'Uzum Bank FastPay', true, 1, 5000000.00, 100000.00, true, NOW(), 'synced'),
('click', 'Click Pass', true, 2, 3000000.00, 75000.00, true, NOW(), 'synced'),
('payme', 'Payme QR', false, 3, 4000000.00, 80000.00, false, NOW(), 'synced');

-- Insert sample payment method credentials (simulating sync from chain-core)
-- These would be encrypted in production
INSERT INTO payment_method_credentials (payment_method_code, credential_key, credential_value, is_encrypted, is_test_environment, last_sync_at) VALUES
-- Uzum Bank credentials
('uzum_fastpay', 'merchant_service_user_id', 'DEMO_UZUM_MERCHANT_123', false, true, NOW()),
('uzum_fastpay', 'secret_key', 'DEMO_UZUM_SECRET_456', true, true, NOW()),
('uzum_fastpay', 'service_id', 'DEMO_UZUM_SERVICE_789', false, true, NOW()),
('uzum_fastpay', 'cashbox_code_prefix', 'RockPoint_DEMO', false, true, NOW()),

-- Click credentials
('click', 'merchant_id', 'DEMO_CLICK_MERCHANT_123', false, true, NOW()),
('click', 'service_id', 'DEMO_CLICK_SERVICE_456', false, true, NOW()),
('click', 'merchant_user_id', 'DEMO_CLICK_USER_789', false, true, NOW()),
('click', 'secret_key', 'DEMO_CLICK_SECRET_ABC123', true, true, NOW()),
('click', 'cashbox_code', 'DEMO_CASHBOX_001', false, true, NOW()),

-- Payme credentials (disabled method, but credentials are synced)
('payme', 'cashbox_id', 'DEMO_PAYME_CASHBOX_123', false, true, NOW()),
('payme', 'key_password', 'DEMO_PAYME_PASSWORD_456', true, true, NOW());

-- =================================================================
-- PAYMENT METHOD CONFIGURATIONS
-- =================================================================

-- Configure Uzum Bank (if enabled)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM branch_payment_methods_status WHERE payment_method_code = 'uzum_fastpay' AND is_enabled = true) THEN
        -- Insert Uzum Bank specific configuration credentials
        INSERT INTO payment_method_credentials (payment_method_code, credential_key, credential_value, is_encrypted) VALUES
        ('uzum_fastpay', 'api_base_url', 'https://mobile.apelsin.uz', false),
        ('uzum_fastpay', 'request_timeout_ms', '15000', false),
        ('uzum_fastpay', 'max_retry_attempts', '3', false),
        ('uzum_fastpay', 'enable_logging', 'true', false)
        ON CONFLICT (payment_method_code, credential_key) DO UPDATE SET
            credential_value = EXCLUDED.credential_value;
        
        RAISE NOTICE 'Uzum Bank FastPay configuration added (method is enabled)';
    ELSE
        RAISE NOTICE 'Uzum Bank FastPay configuration skipped (method is disabled)';
    END IF;
END $$;

-- Configure Click Pass (if enabled)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM branch_payment_methods_status WHERE payment_method_code = 'click' AND is_enabled = true) THEN
        -- Insert Click specific configuration credentials
        INSERT INTO payment_method_credentials (payment_method_code, credential_key, credential_value, is_encrypted) VALUES
        ('click', 'api_base_url', 'https://api.click.uz/v2/merchant', false),
        ('click', 'request_timeout_ms', '15000', false),
        ('click', 'max_retry_attempts', '3', false),
        ('click', 'confirmation_mode', 'false', false),
        ('click', 'enable_logging', 'true', false)
        ON CONFLICT (payment_method_code, credential_key) DO UPDATE SET
            credential_value = EXCLUDED.credential_value;
        
        RAISE NOTICE 'Click Pass configuration added (method is enabled)';
    ELSE
        RAISE NOTICE 'Click Pass configuration skipped (method is disabled)';
    END IF;
END $$;

-- Configure Payme QR (if enabled)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM branch_payment_methods_status WHERE payment_method_code = 'payme' AND is_enabled = true) THEN
        -- Insert Payme specific configuration credentials
        INSERT INTO payment_method_credentials (payment_method_code, credential_key, credential_value, is_encrypted) VALUES
        ('payme', 'api_base_url', 'https://checkout.paycom.uz/api', false),
        ('payme', 'request_timeout_ms', '15000', false),
        ('payme', 'receipt_lifetime_ms', '900000', false),
        ('payme', 'status_check_interval_ms', '10000', false),
        ('payme', 'max_status_checks', '90', false),
        ('payme', 'max_retry_attempts', '3', false),
        ('payme', 'enable_fiscal_receipts', 'true', false),
        ('payme', 'enable_logging', 'true', false)
        ON CONFLICT (payment_method_code, credential_key) DO UPDATE SET
            credential_value = EXCLUDED.credential_value;
        
        RAISE NOTICE 'Payme QR configuration added (method is enabled)';
    ELSE
        RAISE NOTICE 'Payme QR configuration skipped (method is disabled)';
    END IF;
END $$;

-- =================================================================
-- SAMPLE PAYMENT TRANSACTIONS
-- =================================================================

-- Insert sample payment transactions (only for enabled methods)
DO $$
DECLARE
    cashier_employee_id VARCHAR(50);
    sample_transaction_id UUID;
BEGIN
    -- Get cashier employee ID
    SELECT employee_id INTO cashier_employee_id FROM employees WHERE role = 'cashier' LIMIT 1;
    
    IF cashier_employee_id IS NULL THEN
        RAISE NOTICE 'No cashier found, skipping sample payment transactions';
        RETURN;
    END IF;

    -- Create a sample transaction for payment testing
    INSERT INTO transactions (terminal_id, employee_id, subtotal, tax_amount, total_amount, status, completed_at)
    VALUES ('POS-001', cashier_employee_id, 25000.00, 2187.50, 27187.50, 'completed', NOW() - INTERVAL '1 hour')
    RETURNING id INTO sample_transaction_id;

    -- Add Uzum Bank FastPay sample transaction (if enabled)
    IF EXISTS (SELECT 1 FROM branch_payment_methods_status WHERE payment_method_code = 'uzum_fastpay' AND is_enabled = true) THEN
        INSERT INTO uzum_fastpay_transactions (
            transaction_id, order_id, pos_transaction_id, amount, amount_uzs, cashbox_code, otp_data,
            service_id, payment_id, request_payload, response_payload, authorization_header,
            status, error_code, initiated_at, completed_at, employee_id, terminal_id,
            client_phone_number, operation_time
        ) VALUES (
            uuid_generate_v4(), 'DEMO_UZUM_001', sample_transaction_id, 2718750, 27187.50, 'RockPoint_DEMO_001', 'DEMO_QR_DATA_UZUM',
            123456789, 'UZUM_PAY_ID_001', '{"demo": "request"}', '{"demo": "response"}', 'Demo Auth Header',
            'success', 0, NOW() - INTERVAL '1 hour 5 minutes', NOW() - INTERVAL '1 hour', cashier_employee_id, 'POS-001',
            '+998901234567', TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        );
        
        RAISE NOTICE 'Sample Uzum Bank FastPay transaction added';
    END IF;

    -- Add Click Pass sample transaction (if enabled)
    IF EXISTS (SELECT 1 FROM branch_payment_methods_status WHERE payment_method_code = 'click' AND is_enabled = true) THEN
        INSERT INTO click_pass_transactions (
            transaction_id, order_id, pos_transaction_id, service_id, merchant_id, merchant_user_id,
            amount, amount_tiyin, otp_data, cashbox_code, request_payload, response_payload,
            auth_header, request_timestamp, digest_hash, payment_status, status, click_trans_id,
            card_type, masked_card_number, error_code, initiated_at, completed_at, employee_id, terminal_id
        ) VALUES (
            uuid_generate_v4(), 'DEMO_CLICK_001', sample_transaction_id, 123456, 789012, 345678,
            27187.50, 2718750, 'DEMO_QR_DATA_CLICK', 'DEMO_CASHBOX_001', '{"demo": "request"}', '{"demo": "response"}',
            'demo_user:demo_digest:1234567890', 1234567890, 'demo_sha1_hash', 1, 'success', 987654321,
            'UZCARD', '8600****1234', 0, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '40 minutes', cashier_employee_id, 'POS-001'
        );
        
        RAISE NOTICE 'Sample Click Pass transaction added';
    END IF;

    -- Add Payme sample receipt (if enabled - but it's disabled in our demo)
    IF EXISTS (SELECT 1 FROM branch_payment_methods_status WHERE payment_method_code = 'payme' AND is_enabled = true) THEN
        INSERT INTO payme_qr_receipts (
            transaction_id, order_id, pos_transaction_id, cashbox_id, receipt_id,
            amount, amount_uzs, account_data, description, qr_code_data, payment_url,
            request_payload, response_payload, x_auth_header, payme_state, status,
            payment_id, card_type, card_number, initiated_at, paid_at, employee_id, terminal_id
        ) VALUES (
            uuid_generate_v4(), 'DEMO_PAYME_001', sample_transaction_id, 'DEMO_PAYME_CASHBOX_123', 'PAYME_RECEIPT_001',
            2718750, 27187.50, '{"order_id": "DEMO_PAYME_001", "branch_id": "demo_branch"}', 'Demo payment', 
            'DEMO_QR_CODE_BASE64', 'https://checkout.paycom.uz/demo', '{"demo": "request"}', '{"demo": "response"}',
            'DEMO_PAYME_CASHBOX_123:DEMO_PASSWORD', 4, 'paid', 'PAYME_PAY_ID_001', 'UZCARD', '8600****5678',
            NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '25 minutes', cashier_employee_id, 'POS-001'
        );
        
        RAISE NOTICE 'Sample Payme QR receipt added';
    ELSE
        RAISE NOTICE 'Payme QR is disabled for this branch';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error creating sample payment transactions: %', SQLERRM;
END $$;
