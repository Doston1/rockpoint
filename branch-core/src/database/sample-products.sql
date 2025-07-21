-- Insert sample products into the products table
INSERT INTO products (name, barcode, price, cost, quantity_in_stock, low_stock_threshold, category, brand, description, image_url, is_active) 
VALUES 
    -- Beverages
    ('Coca Cola 500ml', '123456789012', 2.50, 1.20, 150, 20, 'Beverages', 'Coca Cola', 'Classic Coca Cola 500ml bottle', 'https://example.com/coca-cola.jpg', true),
    ('Pepsi 500ml', '123456789013', 2.45, 1.18, 120, 20, 'Beverages', 'Pepsi', 'Pepsi Cola 500ml bottle', 'https://example.com/pepsi.jpg', true),
    ('Water 1L', '123456789014', 1.00, 0.40, 200, 30, 'Beverages', 'Pure Life', 'Pure drinking water 1 liter', 'https://example.com/water.jpg', true),
    ('Orange Juice 1L', '123456789015', 3.99, 2.10, 50, 10, 'Beverages', 'Tropicana', 'Fresh orange juice 1 liter', 'https://example.com/orange-juice.jpg', true),
    
    -- Snacks
    ('Chips Original', '223456789012', 3.50, 1.75, 80, 15, 'Snacks', 'Lays', 'Original flavor potato chips', 'https://example.com/chips.jpg', true),
    ('Chocolate Bar', '223456789013', 2.99, 1.50, 60, 10, 'Snacks', 'Snickers', 'Milk chocolate with peanuts', 'https://example.com/snickers.jpg', true),
    ('Cookies Pack', '223456789014', 4.50, 2.25, 40, 8, 'Snacks', 'Oreo', 'Chocolate sandwich cookies', 'https://example.com/oreo.jpg', true),
    ('Peanuts Roasted', '223456789015', 2.25, 1.10, 35, 5, 'Snacks', 'Planters', 'Salted roasted peanuts', 'https://example.com/peanuts.jpg', true),
    
    -- Dairy
    ('Milk 1L', '323456789012', 3.25, 2.00, 75, 12, 'Dairy', 'Farm Fresh', 'Whole milk 1 liter', 'https://example.com/milk.jpg', true),
    ('Yogurt Vanilla', '323456789013', 1.99, 0.95, 45, 8, 'Dairy', 'Danone', 'Vanilla flavored yogurt', 'https://example.com/yogurt.jpg', true),
    ('Cheese Slices', '323456789014', 4.99, 2.50, 30, 5, 'Dairy', 'Kraft', 'American cheese slices', 'https://example.com/cheese.jpg', true),
    ('Butter 500g', '323456789015', 5.50, 3.20, 25, 3, 'Dairy', 'Land O Lakes', 'Salted butter 500 grams', 'https://example.com/butter.jpg', true),
    
    -- Bakery
    ('White Bread', '423456789012', 2.75, 1.30, 40, 8, 'Bakery', 'Wonder', 'Sliced white bread loaf', 'https://example.com/white-bread.jpg', true),
    ('Whole Wheat Bread', '423456789013', 3.25, 1.60, 35, 6, 'Bakery', 'Pepperidge Farm', 'Whole wheat bread loaf', 'https://example.com/wheat-bread.jpg', true),
    ('Croissant', '423456789014', 1.50, 0.75, 20, 4, 'Bakery', 'Fresh Baked', 'Buttery croissant pastry', 'https://example.com/croissant.jpg', true),
    ('Bagels 6-pack', '423456789015', 4.99, 2.40, 15, 3, 'Bakery', 'Thomas', 'Everything bagels 6 pack', 'https://example.com/bagels.jpg', true),
    
    -- Personal Care
    ('Toothpaste', '523456789012', 3.99, 2.10, 50, 8, 'Personal Care', 'Colgate', 'Whitening toothpaste', 'https://example.com/toothpaste.jpg', true),
    ('Shampoo 400ml', '523456789013', 6.99, 3.50, 30, 5, 'Personal Care', 'Head & Shoulders', 'Dandruff shampoo 400ml', 'https://example.com/shampoo.jpg', true),
    ('Soap Bar', '523456789014', 1.99, 0.80, 60, 10, 'Personal Care', 'Dove', 'Moisturizing soap bar', 'https://example.com/soap.jpg', true),
    ('Deodorant', '523456789015', 4.50, 2.25, 25, 5, 'Personal Care', 'Axe', 'Body spray deodorant', 'https://example.com/deodorant.jpg', true),
    
    -- Household
    ('Paper Towels', '623456789012', 5.99, 3.00, 40, 6, 'Household', 'Bounty', 'Absorbent paper towels', 'https://example.com/paper-towels.jpg', true),
    ('Toilet Paper 12-pack', '623456789013', 12.99, 6.50, 20, 3, 'Household', 'Charmin', 'Ultra soft toilet paper', 'https://example.com/toilet-paper.jpg', true),
    ('Dish Soap', '623456789014', 2.99, 1.40, 35, 6, 'Household', 'Dawn', 'Grease-fighting dish soap', 'https://example.com/dish-soap.jpg', true),
    ('Laundry Detergent', '623456789015', 8.99, 4.50, 18, 3, 'Household', 'Tide', 'High efficiency detergent', 'https://example.com/detergent.jpg', true),
    
    -- Electronics
    ('Phone Charger Cable', '723456789012', 9.99, 4.00, 25, 5, 'Electronics', 'Generic', 'USB charging cable', 'https://example.com/charger.jpg', true),
    ('Batteries AA 4-pack', '723456789013', 4.99, 2.20, 30, 5, 'Electronics', 'Duracell', 'Alkaline AA batteries', 'https://example.com/batteries.jpg', true)
ON CONFLICT (barcode) DO NOTHING;

-- Verify the insert
SELECT COUNT(*) as total_products FROM products;

-- Show products by category
SELECT category, COUNT(*) as product_count 
FROM products 
WHERE is_active = true
GROUP BY category 
ORDER BY category;
