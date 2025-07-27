-- Categories table with translations
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL, -- The category key used in products table
    name_en VARCHAR(255) NOT NULL,    -- English name (required)
    name_ru VARCHAR(255),             -- Russian translation (optional)
    name_uz VARCHAR(255),             -- Uzbek translation (optional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_categories_key ON categories(key);

-- Insert existing categories from products table with initial translations
INSERT INTO categories (key, name_en, name_ru, name_uz) 
SELECT DISTINCT 
    category as key,
    category as name_en,
    CASE 
        WHEN category = 'Beverages' THEN 'Напитки'
        WHEN category = 'Snacks' THEN 'Закуски'
        WHEN category = 'Dairy' THEN 'Молочные продукты'
        WHEN category = 'Meat' THEN 'Мясо и птица'
        WHEN category = 'Bakery' THEN 'Хлебобулочные изделия'
        WHEN category = 'Frozen' THEN 'Замороженные продукты'
        WHEN category = 'Personal Care' THEN 'Личная гигиена'
        WHEN category = 'Household' THEN 'Бытовая химия'
        WHEN category = 'Electronics' THEN 'Электроника'
        WHEN category = 'Clothing' THEN 'Одежда'
        ELSE NULL
    END as name_ru,
    CASE 
        WHEN category = 'Beverages' THEN 'Ichimliklar'
        WHEN category = 'Snacks' THEN 'Gazaklar'
        WHEN category = 'Dairy' THEN 'Sut mahsulotlari'
        WHEN category = 'Meat' THEN 'Go''sht va parrandachilik'
        WHEN category = 'Bakery' THEN 'Non mahsulotlari'
        WHEN category = 'Frozen' THEN 'Muzlatilgan mahsulotlar'
        WHEN category = 'Personal Care' THEN 'Shaxsiy gigiyena'
        WHEN category = 'Household' THEN 'Maishiy kimyoviy moddalar'
        WHEN category = 'Electronics' THEN 'Elektronika'
        WHEN category = 'Clothing' THEN 'Kiyim-kechak'
        ELSE NULL
    END as name_uz
FROM products 
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (key) DO NOTHING;

-- Function to automatically create category entries when new ones are used
CREATE OR REPLACE FUNCTION ensure_category_exists()
RETURNS TRIGGER AS $$
BEGIN
    -- If category is provided and doesn't exist in categories table, create it
    IF NEW.category IS NOT NULL AND NEW.category != '' THEN
        INSERT INTO categories (key, name_en)
        VALUES (NEW.category, NEW.category)
        ON CONFLICT (key) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create categories
DROP TRIGGER IF EXISTS ensure_category_trigger ON products;
CREATE TRIGGER ensure_category_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION ensure_category_exists();
