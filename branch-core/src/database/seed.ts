import bcrypt from 'bcryptjs';
import { DatabaseManager } from './manager';

async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Initialize database connection
    await DatabaseManager.initialize();
    
    // Clear existing data (be careful in production!) 
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Clearing existing test data...');
      await DatabaseManager.query('TRUNCATE employees, products, transactions, transaction_items, payments, customers, stock_movements, employee_time_logs, sync_logs CASCADE');
    }
    
    // Seed employees
    console.log('👥 Seeding employees...');
    const adminPinHash = await bcrypt.hash('1234', 12);
    const managerPinHash = await bcrypt.hash('5678', 12);
    const cashierPinHash = await bcrypt.hash('9999', 12);
    
    await DatabaseManager.query(`
      INSERT INTO employees (employee_id, name, role, pin_hash, status, hire_date) VALUES
      ('EMP001', 'John Admin', 'admin', $1, 'active', CURRENT_DATE - INTERVAL '2 years'),
      ('EMP002', 'Sarah Manager', 'manager', $2, 'active', CURRENT_DATE - INTERVAL '1 year'),
      ('EMP003', 'Mike Cashier', 'cashier', $3, 'active', CURRENT_DATE - INTERVAL '6 months'),
      ('EMP004', 'Lisa Cashier', 'cashier', $3, 'active', CURRENT_DATE - INTERVAL '3 months')
    `, [adminPinHash, managerPinHash, cashierPinHash]);
    
    // Seed product categories and products
    console.log('📦 Seeding products...');
    await DatabaseManager.query(`
      INSERT INTO products (name, barcode, price, cost, quantity_in_stock, category, brand, description, is_active) VALUES
      -- Beverages
      ('Coca Cola 500ml', '1234567890123', 2.50, 1.50, 100, 'Beverages', 'Coca Cola', 'Refreshing cola drink 500ml bottle', true),
      ('Pepsi 500ml', '1234567890124', 2.50, 1.50, 80, 'Beverages', 'Pepsi', 'Pepsi cola 500ml bottle', true),
      ('Water 1L', '1234567890125', 1.00, 0.60, 200, 'Beverages', 'AquaPure', 'Pure drinking water 1 liter', true),
      ('Orange Juice 1L', '1234567890126', 4.99, 3.00, 50, 'Beverages', 'Tropicana', 'Fresh orange juice 1 liter', true),
      
      -- Snacks
      ('Lays Chips Classic', '2234567890123', 3.99, 2.50, 75, 'Snacks', 'Lays', 'Classic potato chips 150g', true),
      ('Oreo Cookies', '2234567890124', 2.99, 1.80, 60, 'Snacks', 'Oreo', 'Chocolate sandwich cookies', true),
      ('Pringles Original', '2234567890125', 4.50, 2.80, 40, 'Snacks', 'Pringles', 'Original flavored chips', true),
      
      -- Dairy
      ('Milk 1L', '3234567890123', 3.50, 2.20, 30, 'Dairy', 'Fresh Farm', 'Fresh whole milk 1 liter', true),
      ('Cheese Slices', '3234567890124', 5.99, 3.50, 25, 'Dairy', 'Kraft', 'Processed cheese slices 200g', true),
      ('Yogurt Strawberry', '3234567890125', 1.99, 1.20, 45, 'Dairy', 'Danone', 'Strawberry flavored yogurt 150g', true),
      
      -- Bakery
      ('White Bread', '4234567890123', 2.50, 1.50, 20, 'Bakery', 'Wonder', 'Sliced white bread loaf', true),
      ('Croissant', '4234567890124', 1.50, 0.80, 15, 'Bakery', 'Fresh Bake', 'Butter croissant', true),
      
      -- Cleaning
      ('Dish Soap', '5234567890123', 3.99, 2.40, 35, 'Cleaning', 'Dawn', 'Liquid dish soap 500ml', true),
      ('Paper Towels', '5234567890124', 6.99, 4.20, 28, 'Cleaning', 'Bounty', 'Paper towel rolls pack of 4', true),
      
      -- Electronics
      ('Phone Charger USB-C', '6234567890123', 19.99, 12.00, 12, 'Electronics', 'Anker', 'Fast charging USB-C cable', true),
      ('Bluetooth Earbuds', '6234567890124', 59.99, 35.00, 8, 'Electronics', 'JBL', 'Wireless bluetooth earbuds', true)
    `);
    
    // Seed some sample customers
    console.log('👤 Seeding customers...');
    await DatabaseManager.query(`
      INSERT INTO customers (customer_id, name, email, phone, membership_level) VALUES
      ('CUST001', 'Alice Johnson', 'alice@email.com', '+1234567890', 'Gold'),
      ('CUST002', 'Bob Smith', 'bob@email.com', '+1234567891', 'Silver'),
      ('CUST003', 'Carol Williams', 'carol@email.com', '+1234567892', 'Bronze'),
      ('CUST004', 'David Brown', 'david@email.com', '+1234567893', 'Regular')
    `);
    
    // Create a sample completed transaction
    console.log('🛒 Seeding sample transactions...');
    const transactionId = 'TXN-' + Date.now();
    
    // Insert transaction
    await DatabaseManager.query(`
      INSERT INTO transactions (transaction_id, terminal_id, employee_id, customer_id, subtotal, tax_amount, total_amount, status)
      VALUES ($1, 'TERMINAL-001', 'EMP003', 'CUST001', 12.48, 1.52, 14.00, 'completed')
    `, [transactionId]);
    
    // Get the transaction UUID
    const txResult = await DatabaseManager.query('SELECT id FROM transactions WHERE transaction_id = $1', [transactionId]);
    const txId = txResult.rows[0].id;
    
    // Get some product IDs
    const productResult = await DatabaseManager.query('SELECT id, price FROM products LIMIT 3');
    const products = productResult.rows;
    
    // Insert transaction items
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = i + 1;
      const totalPrice = product.price * quantity;
      
      await DatabaseManager.query(`
        INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5)
      `, [txId, product.id, quantity, product.price, totalPrice]);
    }
    
    // Insert payment
    await DatabaseManager.query(`
      INSERT INTO payments (transaction_id, method, amount, processed_at)
      VALUES ($1, 'cash', 14.00, NOW())
    `, [txId]);
    
    // Add some stock movements
    console.log('📊 Seeding stock movements...');
    for (const product of products) {
      await DatabaseManager.query(`
        INSERT INTO stock_movements (product_id, old_quantity, new_quantity, change_quantity, operation, reason, employee_id)
        SELECT $1, quantity_in_stock + 10, quantity_in_stock, -10, 'sale', 'Sample transaction', 
               (SELECT id FROM employees WHERE employee_id = 'EMP003')
        FROM products WHERE id = $1
      `, [product.id]);
    }
    
    // Add employee time logs
    console.log('⏰ Seeding employee time logs...');
    await DatabaseManager.query(`
      INSERT INTO employee_time_logs (employee_id, clock_in, clock_out, total_hours)
      SELECT id, CURRENT_DATE + TIME '09:00:00', CURRENT_DATE + TIME '17:00:00', 8
      FROM employees WHERE role IN ('cashier', 'manager')
    `);
    
    // Add sync log
    console.log('🔄 Seeding sync logs...');
    await DatabaseManager.query(`
      INSERT INTO sync_logs (sync_type, status, started_at, completed_at, records_synced)
      VALUES 
      ('full', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', 150),
      ('incremental', 'completed', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11.5 hours', 25)
    `);
    
    console.log('✅ Database seeding completed successfully');
    console.log('');
    console.log('🔑 Test Login Credentials:');
    console.log('  Admin: EMP001 / PIN: 1234');
    console.log('  Manager: EMP002 / PIN: 5678');
    console.log('  Cashier: EMP003 / PIN: 9999');
    console.log('  Cashier: EMP004 / PIN: 9999');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await DatabaseManager.close();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };

