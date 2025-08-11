-- Sample transaction data for RockPoint Chain Core Reports
-- Run this after the main sample_data.sql to populate with transaction data
-- PostgreSQL 14+

BEGIN;

-- Get branch IDs and product IDs from existing sample data
DO $$
DECLARE
    branch1_id UUID;
    branch2_id UUID;
    branch3_id UUID;
    emp1_id UUID;
    emp2_id UUID;
    emp3_id UUID;
    emp4_id UUID;
    emp5_id UUID;
    emp6_id UUID;
    prod1_id UUID;
    prod2_id UUID;
    prod3_id UUID;
    prod4_id UUID;
    prod5_id UUID;
    prod6_id UUID;
    cust1_id UUID;
    cust2_id UUID;
    cust3_id UUID;
    txn_id UUID;
    i INTEGER;
    j INTEGER;
    random_date TIMESTAMP;
    random_hour INTEGER;
    random_amount DECIMAL;
    random_quantity INTEGER;
    payment_methods TEXT[] := ARRAY['cash', 'card', 'digital_wallet'];
    random_payment TEXT;
BEGIN
    -- Get existing IDs
    SELECT id INTO branch1_id FROM branches WHERE code = 'DT001' LIMIT 1;
    SELECT id INTO branch2_id FROM branches WHERE code = 'ML002' LIMIT 1;
    SELECT id INTO branch3_id FROM branches WHERE code = 'AP003' LIMIT 1;
    
    -- Get employee IDs (assuming they exist from sample data)
    SELECT id INTO emp1_id FROM employees WHERE branch_id = branch1_id LIMIT 1;
    SELECT id INTO emp2_id FROM employees WHERE branch_id = branch1_id OFFSET 1 LIMIT 1;
    SELECT id INTO emp3_id FROM employees WHERE branch_id = branch2_id LIMIT 1;
    SELECT id INTO emp4_id FROM employees WHERE branch_id = branch2_id OFFSET 1 LIMIT 1;
    SELECT id INTO emp5_id FROM employees WHERE branch_id = branch3_id LIMIT 1;
    SELECT id INTO emp6_id FROM employees WHERE branch_id = branch3_id OFFSET 1 LIMIT 1;
    
    -- Get product IDs
    SELECT id INTO prod1_id FROM products WHERE sku = 'COCA-500ML' LIMIT 1;
    SELECT id INTO prod2_id FROM products WHERE sku = 'PEPSI-500ML' LIMIT 1;
    SELECT id INTO prod3_id FROM products WHERE sku = 'WATER-1L' LIMIT 1;
    SELECT id INTO prod4_id FROM products WHERE sku = 'OJ-1L' LIMIT 1;
    SELECT id INTO prod5_id FROM products WHERE sku = 'CHIPS-ORG' LIMIT 1;
    SELECT id INTO prod6_id FROM products WHERE sku = 'SNICKERS' LIMIT 1;
    
    -- Get customer IDs (assuming they exist from sample data)
    SELECT id INTO cust1_id FROM customers LIMIT 1;
    SELECT id INTO cust2_id FROM customers OFFSET 1 LIMIT 1;
    SELECT id INTO cust3_id FROM customers OFFSET 2 LIMIT 1;
    
    -- Generate transactions for the last 90 days
    FOR i IN 1..450 LOOP
        -- Random date in the last 90 days
        random_date := NOW() - (RANDOM() * INTERVAL '90 days');
        random_hour := (EXTRACT(HOUR FROM random_date))::INTEGER;
        
        -- Adjust hour to business hours (7 AM to 10 PM with peak times)
        IF random_hour < 7 OR random_hour > 22 THEN
            random_date := DATE_TRUNC('day', random_date) + INTERVAL '12 hours';
        END IF;
        
        -- Higher chance of transactions during peak hours (12-2 PM, 6-8 PM)
        IF RANDOM() < 0.3 THEN
            IF RANDOM() < 0.5 THEN
                random_date := DATE_TRUNC('day', random_date) + INTERVAL '13 hours' + (RANDOM() * INTERVAL '2 hours');
            ELSE
                random_date := DATE_TRUNC('day', random_date) + INTERVAL '18 hours' + (RANDOM() * INTERVAL '2 hours');
            END IF;
        END IF;
        
        -- Generate transaction ID
        txn_id := uuid_generate_v4();
        
        -- Random payment method
        random_payment := payment_methods[(RANDOM() * 2 + 1)::INTEGER];
        
        -- Insert transaction
        INSERT INTO transactions (
            id, branch_id, transaction_number, employee_id, customer_id,
            subtotal, tax_amount, total_amount, payment_method, status,
            completed_at, created_at, updated_at
        ) VALUES (
            txn_id,
            CASE 
                WHEN RANDOM() < 0.4 THEN branch1_id
                WHEN RANDOM() < 0.7 THEN branch2_id
                ELSE branch3_id
            END,
            'TXN-' || LPAD(i::TEXT, 6, '0'),
            CASE 
                WHEN RANDOM() < 0.16 THEN emp1_id
                WHEN RANDOM() < 0.32 THEN emp2_id
                WHEN RANDOM() < 0.48 THEN emp3_id
                WHEN RANDOM() < 0.64 THEN emp4_id
                WHEN RANDOM() < 0.80 THEN emp5_id
                ELSE emp6_id
            END,
            CASE 
                WHEN RANDOM() < 0.7 THEN NULL -- Most transactions without customer
                WHEN RANDOM() < 0.85 THEN cust1_id
                WHEN RANDOM() < 0.95 THEN cust2_id
                ELSE cust3_id
            END,
            0, 0, 0, -- Will be calculated after items
            random_payment,
            'completed',
            random_date,
            random_date,
            random_date
        );
        
        -- Add 1-5 items to each transaction
        FOR j IN 1..(RANDOM() * 4 + 1)::INTEGER LOOP
            random_quantity := (RANDOM() * 3 + 1)::INTEGER;
            
            -- Select random product
            DECLARE
                selected_product_id UUID;
                product_price DECIMAL;
                product_cost DECIMAL;
            BEGIN
                CASE (RANDOM() * 5 + 1)::INTEGER
                    WHEN 1 THEN 
                        selected_product_id := prod1_id;
                        SELECT base_price, cost INTO product_price, product_cost FROM products WHERE id = prod1_id;
                    WHEN 2 THEN 
                        selected_product_id := prod2_id;
                        SELECT base_price, cost INTO product_price, product_cost FROM products WHERE id = prod2_id;
                    WHEN 3 THEN 
                        selected_product_id := prod3_id;
                        SELECT base_price, cost INTO product_price, product_cost FROM products WHERE id = prod3_id;
                    WHEN 4 THEN 
                        selected_product_id := prod4_id;
                        SELECT base_price, cost INTO product_price, product_cost FROM products WHERE id = prod4_id;
                    WHEN 5 THEN 
                        selected_product_id := prod5_id;
                        SELECT base_price, cost INTO product_price, product_cost FROM products WHERE id = prod5_id;
                    ELSE 
                        selected_product_id := prod6_id;
                        SELECT base_price, cost INTO product_price, product_cost FROM products WHERE id = prod6_id;
                END CASE;
                
                -- Small random discount (0-10%)
                random_amount := product_price * (1 - RANDOM() * 0.1);
                
                INSERT INTO transaction_items (
                    transaction_id, product_id, quantity, unit_price, original_price,
                    unit_cost, discount_amount, tax_amount, total_amount
                ) VALUES (
                    txn_id,
                    selected_product_id,
                    random_quantity,
                    random_amount,
                    product_price,
                    product_cost,
                    (product_price - random_amount) * random_quantity,
                    random_amount * random_quantity * 0.0875, -- 8.75% tax
                    random_amount * random_quantity * 1.0875
                );
            END;
        END LOOP;
        
        -- Update transaction totals
        UPDATE transactions SET
            subtotal = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM transaction_items WHERE transaction_id = txn_id),
            tax_amount = (SELECT COALESCE(SUM(tax_amount), 0) FROM transaction_items WHERE transaction_id = txn_id),
            total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM transaction_items WHERE transaction_id = txn_id)
        WHERE id = txn_id;
        
        -- Insert payment record
        INSERT INTO payments (
            transaction_id, method, amount, status, processed_at
        ) VALUES (
            txn_id,
            random_payment,
            (SELECT total_amount FROM transactions WHERE id = txn_id),
            'completed',
            random_date
        );
        
        -- Commit every 50 transactions to avoid long-running transaction
        IF i % 50 = 0 THEN
            RAISE NOTICE 'Generated % transactions...', i;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Sample transaction data generation completed!';
END;
$$;

-- Update inventory quantities based on sales
DO $$
DECLARE
    product_record RECORD;
    total_sold INTEGER;
BEGIN
    FOR product_record IN SELECT id FROM products LOOP
        -- Calculate total sold for this product
        SELECT COALESCE(SUM(quantity)::INTEGER, 0) INTO total_sold
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        WHERE ti.product_id = product_record.id
        AND t.status = 'completed';
        
        -- Update inventory for all branches
        UPDATE branch_inventory 
        SET quantity_in_stock = GREATEST(0, quantity_in_stock - (total_sold / 3))
        WHERE product_id = product_record.id;
    END LOOP;
    
    RAISE NOTICE 'Inventory quantities updated based on sales!';
END;
$$;

COMMIT;

-- Display summary statistics
SELECT 
    'Transaction Summary' as report_type,
    COUNT(*) as total_transactions,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as average_transaction
FROM transactions 
WHERE status = 'completed';

SELECT 
    'Branch Performance' as report_type,
    b.name as branch_name,
    COUNT(t.id) as transaction_count,
    SUM(t.total_amount) as total_sales
FROM branches b
LEFT JOIN transactions t ON b.id = t.branch_id AND t.status = 'completed'
GROUP BY b.id, b.name
ORDER BY total_sales DESC;

SELECT 
    'Product Performance' as report_type,
    p.name as product_name,
    SUM(ti.quantity) as total_quantity_sold,
    SUM(ti.total_amount) as total_revenue
FROM products p
LEFT JOIN transaction_items ti ON p.id = ti.product_id
LEFT JOIN transactions t ON ti.transaction_id = t.id AND t.status = 'completed'
GROUP BY p.id, p.name
ORDER BY total_revenue DESC;
