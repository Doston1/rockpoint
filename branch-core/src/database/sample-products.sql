-- Delete all existing products
DELETE FROM products;

-- Reset the auto-increment sequence (if using PostgreSQL)
ALTER SEQUENCE products_id_seq RESTART WITH 1;

-- Insert sample products with translations
INSERT INTO products (name, barcode, price, cost, quantity_in_stock, low_stock_threshold, category, brand, description, image_url, is_active, name_ru, name_uz, description_ru, description_uz) 
VALUES 
    -- Beverages
    ('Coca Cola 500ml', '123456789012', 2.50, 1.20, 150, 20, 'Beverages', 'Coca Cola', 'Classic Coca Cola 500ml bottle', 'https://example.com/coca-cola.jpg', true, 'Кока-Кола 500мл', 'Koka-Kola 500ml', 'Классическая Кока-Кола 500мл бутылка', 'Klassik Koka-Kola 500ml shisha'),
    ('Pepsi 500ml', '123456789013', 2.45, 1.18, 120, 20, 'Beverages', 'Pepsi', 'Pepsi Cola 500ml bottle', 'https://example.com/pepsi.jpg', true, 'Пепси 500мл', 'Pepsi 500ml', 'Пепси-Кола 500мл бутылка', 'Pepsi-Kola 500ml shisha'),
    ('Water 1L', '123456789014', 1.00, 0.40, 200, 30, 'Beverages', 'Pure Life', 'Pure drinking water 1 liter', 'https://example.com/water.jpg', true, 'Вода 1л', 'Suv 1l', 'Чистая питьевая вода 1 литр', 'Toza ichimlik suvi 1 litr'),
    ('Orange Juice 1L', '123456789015', 3.99, 2.10, 50, 10, 'Beverages', 'Tropicana', 'Fresh orange juice 1 liter', 'https://example.com/orange-juice.jpg', true, 'Апельсиновый сок 1л', 'Apelsin sharbati 1l', 'Свежий апельсиновый сок 1 литр', 'Yangi apelsin sharbati 1 litr'),
    
    -- Snacks
    ('Chips Original', '223456789012', 3.50, 1.75, 80, 15, 'Snacks', 'Lays', 'Original flavor potato chips', 'https://example.com/chips.jpg', true, 'Чипсы оригинальные', 'Chips original', 'Картофельные чипсы оригинальный вкус', 'Original ta''mli kartoshka chipslari'),
    ('Chocolate Bar', '223456789013', 2.99, 1.50, 60, 10, 'Snacks', 'Snickers', 'Milk chocolate with peanuts', 'https://example.com/snickers.jpg', true, 'Шоколадный батончик', 'Shokolad', 'Молочный шоколад с арахисом', 'Yeryong''oqli sut shokoladi'),
    ('Cookies Pack', '223456789014', 4.50, 2.25, 40, 8, 'Snacks', 'Oreo', 'Chocolate sandwich cookies', 'https://example.com/oreo.jpg', true, 'Печенье упаковка', 'Pechene paketi', 'Шоколадное печенье-сэндвич', 'Shokoladli sendvich pechene'),
    ('Peanuts Roasted', '223456789015', 2.25, 1.10, 35, 5, 'Snacks', 'Planters', 'Salted roasted peanuts', 'https://example.com/peanuts.jpg', true, 'Арахис жареный', 'Yeryong''oq qovurilgan', 'Соленый жареный арахис', 'Tuzlangan qovurilgan yeryong''oq'),
    
    -- Dairy
    ('Milk 1L', '323456789012', 3.25, 2.00, 75, 12, 'Dairy', 'Farm Fresh', 'Whole milk 1 liter', 'https://example.com/milk.jpg', true, 'Молоко 1л', 'Sut 1l', 'Цельное молоко 1 литр', 'To''liq sut 1 litr'),
    ('Yogurt Vanilla', '323456789013', 1.99, 0.95, 45, 8, 'Dairy', 'Danone', 'Vanilla flavored yogurt', 'https://example.com/yogurt.jpg', true, 'Йогурт ванильный', 'Yogurt vanil', 'Йогурт с ванильным вкусом', 'Vanil ta''mli yogurt'),
    ('Cheese Slices', '323456789014', 4.99, 2.50, 30, 5, 'Dairy', 'Kraft', 'American cheese slices', 'https://example.com/cheese.jpg', true, 'Сыр ломтиками', 'Pishloq bo''laklari', 'Американский сыр ломтиками', 'Amerika pishlog''i bo''laklari'),
    ('Butter 500g', '323456789015', 5.50, 3.20, 25, 3, 'Dairy', 'Land O Lakes', 'Salted butter 500 grams', 'https://example.com/butter.jpg', true, 'Масло сливочное 500г', 'Sariyog'' 500g', 'Соленое масло 500 грамм', 'Tuzlangan sariyog'' 500 gramm'),
    
    -- Bakery
    ('White Bread', '423456789012', 2.75, 1.30, 40, 8, 'Bakery', 'Wonder', 'Sliced white bread loaf', 'https://example.com/white-bread.jpg', true, 'Хлеб белый', 'Oq non', 'Нарезанный белый хлеб', 'To''g''ralgan oq non'),
    ('Whole Wheat Bread', '423456789013', 3.25, 1.60, 35, 6, 'Bakery', 'Pepperidge Farm', 'Whole wheat bread loaf', 'https://example.com/wheat-bread.jpg', true, 'Хлеб цельнозерновой', 'Bug''doy noni', 'Цельнозерновой хлеб', 'To''liq bug''doy noni'),
    ('Croissant', '423456789014', 1.50, 0.75, 20, 4, 'Bakery', 'Fresh Baked', 'Buttery croissant pastry', 'https://example.com/croissant.jpg', true, 'Круассан', 'Kruassan', 'Масляный круассан', 'Sariyog''li kruassan'),
    ('Bagels 6-pack', '423456789015', 4.99, 2.40, 15, 3, 'Bakery', 'Thomas', 'Everything bagels 6 pack', 'https://example.com/bagels.jpg', true, 'Бублики 6 шт', 'Simit 6 dona', 'Бублики с приправами 6 штук', 'Hamma narsali simitlar 6 dona'),
    
    -- Personal Care
    ('Toothpaste', '523456789012', 3.99, 2.10, 50, 8, 'Personal Care', 'Colgate', 'Whitening toothpaste', 'https://example.com/toothpaste.jpg', true, 'Зубная паста', 'Tish pastasi', 'Отбеливающая зубная паста', 'Oqartiruvchi tish pastasi'),
    ('Shampoo 400ml', '523456789013', 6.99, 3.50, 30, 5, 'Personal Care', 'Head & Shoulders', 'Dandruff shampoo 400ml', 'https://example.com/shampoo.jpg', true, 'Шампунь 400мл', 'Shampun 400ml', 'Шампунь от перхоти 400мл', 'Kepakka qarshi shampun 400ml'),
    ('Soap Bar', '523456789014', 1.99, 0.80, 60, 10, 'Personal Care', 'Dove', 'Moisturizing soap bar', 'https://example.com/soap.jpg', true, 'Мыло кусковое', 'Sovun', 'Увлажняющее кусковое мыло', 'Namlantiruvchi sovun'),
    ('Deodorant', '523456789015', 4.50, 2.25, 25, 5, 'Personal Care', 'Axe', 'Body spray deodorant', 'https://example.com/deodorant.jpg', true, 'Дезодорант', 'Dezodorant', 'Дезодорант-спрей для тела', 'Tana uchun sprey dezodorant'),
    
    -- Household
    ('Paper Towels', '623456789012', 5.99, 3.00, 40, 6, 'Household', 'Bounty', 'Absorbent paper towels', 'https://example.com/paper-towels.jpg', true, 'Бумажные полотенца', 'Qog''oz sochiq', 'Впитывающие бумажные полотенца', 'Shimuvchi qog''oz sochiqlar'),
    ('Toilet Paper 12-pack', '623456789013', 12.99, 6.50, 20, 3, 'Household', 'Charmin', 'Ultra soft toilet paper', 'https://example.com/toilet-paper.jpg', true, 'Туалетная бумага 12 рул', 'Hojatxona qog''ozi 12 dona', 'Ультрамягкая туалетная бумага', 'Ultra yumshoq hojatxona qog''ozi'),
    ('Dish Soap', '623456789014', 2.99, 1.40, 35, 6, 'Household', 'Dawn', 'Grease-fighting dish soap', 'https://example.com/dish-soap.jpg', true, 'Средство для посуды', 'Idish yuvish vositasi', 'Средство для мытья посуды против жира', 'Yog''ga qarshi idish yuvish vositasi'),
    ('Laundry Detergent', '623456789015', 8.99, 4.50, 18, 3, 'Household', 'Tide', 'High efficiency detergent', 'https://example.com/detergent.jpg', true, 'Стиральный порошок', 'Kir yuvish kukuni', 'Высокоэффективный стиральный порошок', 'Yuqori samarali kir yuvish kukuni'),
    
    -- Electronics
    ('Phone Charger Cable', '723456789012', 9.99, 4.00, 25, 5, 'Electronics', 'Generic', 'USB charging cable', 'https://example.com/charger.jpg', true, 'Кабель зарядки телефона', 'Telefon zaryadlash kabeli', 'USB кабель для зарядки', 'USB zaryadlash kabeli'),
    ('Batteries AA 4-pack', '723456789013', 4.99, 2.20, 30, 5, 'Electronics', 'Duracell', 'Alkaline AA batteries', 'https://example.com/batteries.jpg', true, 'Батарейки АА 4 шт', 'Batareyalar AA 4 dona', 'Щелочные батарейки АА', 'Gidroksidli AA batareyalar');

-- Verify the insert
SELECT COUNT(*) as total_products FROM products;

-- Show products by category with translations
SELECT 
    category, 
    COUNT(*) as product_count,
    STRING_AGG(name, ', ') as sample_products
FROM products 
WHERE is_active = true
GROUP BY category 
ORDER BY category;

-- Show first 5 products with all translations
SELECT 
    id,
    name,
    name_ru,
    name_uz,
    barcode,
    price,
    category,
    brand
FROM products 
ORDER BY id 
LIMIT 5;

-- Verify translations are properly set
SELECT 
    'Total products' as metric,
    COUNT(*) as count
FROM products
UNION ALL
SELECT 
    'Products with Russian names' as metric,
    COUNT(*) as count
FROM products 
WHERE name_ru IS NOT NULL AND name_ru != ''
UNION ALL
SELECT 
    'Products with Uzbek names' as metric,
    COUNT(*) as count
FROM products 
WHERE name_uz IS NOT NULL AND name_uz != '';
