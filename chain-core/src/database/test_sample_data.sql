-- Test version of sample data for RockPoint Chain Core
-- Run this file after schema.sql to test for issues
-- PostgreSQL 14+

BEGIN;

-- Clear all existing data (in reverse dependency order)
DELETE FROM onec_sync_logs;
DELETE FROM branch_sync_logs;
DELETE FROM system_settings;
DELETE FROM promotions;
DELETE FROM payments;
DELETE FROM transaction_items;
DELETE FROM transactions;
DELETE FROM customers;
DELETE FROM branch_inventory;
DELETE FROM branch_product_pricing;
DELETE FROM employees;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM users;
DELETE FROM branches;

-- Insert sample branches
INSERT INTO branches (name, code, address, phone, email, manager_name, timezone, currency, tax_rate, api_endpoint, api_key) VALUES
('Downtown Store', 'DT001', '123 Main Street, Downtown', '+1-555-0101', 'downtown@rockpoint.com', 'John Smith', 'America/New_York', 'USD', 0.0875, 'http://localhost:3000/api', 'dt001_api_key_123');

-- Insert default admin user (password: admin123!)
INSERT INTO users (username, email, password_hash, name, role, permissions) 
VALUES (
    'admin', 
    'admin@rockpoint.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfVKHoLGpR8s8Hm', -- bcrypt hash of 'admin123!'
    'System Administrator',
    'super_admin',
    ARRAY['*'] -- All permissions
);

-- Insert sample categories
INSERT INTO categories (key, name, name_ru, name_uz, description, sort_order) VALUES
('beverages', 'Beverages', 'Напитки', 'Ichimliklar', 'Soft drinks, juices, water', 1);

-- Test simple product insert first
INSERT INTO products (sku, barcode, name, name_ru, name_uz, description, description_ru, description_uz, category_id, brand, base_price, cost, image_url) 
SELECT 
    'COCA-500ML', '123456789012', 'Coca Cola 500ml', 'Кока-Кола 500мл', 'Koka-Kola 500ml', 
    'Classic Coca Cola 500ml bottle', 'Классическая Кока-Кола 500мл бутылка', 'Klassik Koka-Kola 500ml shisha',
    c.id, 'Coca Cola', 2.50, 1.20, 'https://example.com/coca-cola.jpg'
FROM categories c WHERE c.key = 'beverages';

-- Verification
SELECT 'Test completed successfully' AS status;

COMMIT;
