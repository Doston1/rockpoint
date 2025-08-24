import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { DatabaseManager } from '../../src/database/manager';

// Import branch API routes
import branchesApiRouter from '../../src/api/branches-api';

export async function createBranchTestApp(): Promise<Express> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());

  // Body parsing middleware
  app.use(express.json({ 
    limit: '10mb',
    // Handle JSON parsing errors
    verify: (req: any, res: any, buf: Buffer) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        throw new SyntaxError('Invalid JSON');
      }
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize database if not already done
  try {
    await DatabaseManager.initialize();
  } catch (error) {
    // Database might already be initialized, continue
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount Branch API routes
  app.use('/api/branch-api', branchesApiRouter);

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Branch test app error:', err);
    
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_JSON',
        error: 'Invalid JSON format',
        message: err.message
      });
    }
    
    // Handle ZodError validation errors
    if (err.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        error: 'Validation failed',
        details: err.errors,
        message: err.message
      });
    }
    
    // Handle PostgreSQL duplicate key errors
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        code: 'TRANSACTION_ALREADY_EXISTS',
        error: 'Transaction already exists',
        message: err.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  });

  return app;
}

export function createMockBranchServer(overrides: any = {}) {
  return {
    branch_id: null, // Will be set when branch is created
    server_name: 'Test Branch Server',
    ip_address: '192.168.1.100',
    port: 3000,
    api_port: 3001,
    websocket_port: 3002,
    network_type: 'local',
    server_info: { os: 'Windows 10', version: '1.0.0' },
    api_key: 'test_branch_server_api_key_123',
    outbound_api_key: 'test_outbound_key_456',
    status: 'online',
    is_active: true,
    ...overrides
  };
}

export function createMockTransaction(overrides: any = {}, testData?: any) {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits for uniqueness
  const base = {
    transaction_id: overrides.transaction_id || `TXN_TEST_${timestamp}`,
    receipt_number: 'REC_001',
    employee_id: 'EMP_TEST_001',  // Required field
    transaction_date: new Date().toISOString(),  // Required field
    subtotal: 145000.00,  // Before tax and after discount
    total_amount: 150000.00,  // Required field
    tax_amount: 18000.00,
    discount_amount: 5000.00,
    payment_method: 'cash',
    status: 'completed',
    customer_info: {
      name: 'Test Customer',
      phone: '+998901234567'
    },
    items: [
      {
        product_id: testData?.productId || 'TEST_PROD_001',
        sku: 'TST-001',
        name: 'Test Product',
        product_name: 'Test Product',  // Add both name and product_name
        quantity: 2,
        unit_price: 75000.00,
        total_price: 150000.00,
        tax_rate: 0.12,
        tax_amount: 18000.00,
        discount_amount: 0
      }
    ]
  };
  
  // Merge overrides, handling arrays properly
  const result = { ...base, ...overrides };
  
  // If items are overridden, use them completely
  if (overrides.items) {
    result.items = overrides.items;
  }
  
  return result;
}

export function createMockEmployee(overrides: any = {}) {
  return {
    employee_id: 'EMP_TEST_001',
    name: 'Test Employee',
    role: 'cashier',
    phone: '+998901234567',
    email: 'employee@test.com',
    hire_date: '2024-01-01',
    salary: 3000000.00,
    status: 'active',
    ...overrides
  };
}

export function createMockTimeLog(overrides: any = {}) {
  return {
    employee_id: 'EMP_TEST_001',
    action: 'clock_in',
    timestamp: new Date().toISOString(),
    location: 'main_terminal',
    notes: 'Test clock in',
    ...overrides
  };
}

export function createMockStockMovement(overrides: any = {}) {
  return {
    product_id: 'TEST_PROD_001',
    movement_type: 'adjustment',
    quantity_change: 10,
    new_quantity: 100,
    reason: 'inventory_count',
    reference_id: 'ADJ_001',
    notes: 'Test stock adjustment',
    ...overrides
  };
}

export function createMockHealthStatus(overrides: any = {}) {
  return {
    status: 'online',
    last_activity: new Date().toISOString(),
    system_info: {
      cpu_usage: 45.2,
      memory_usage: 67.8,
      disk_space: 85.5,
      uptime: 86400
    },
    network_info: {
      ping_ms: 25,
      bandwidth_mbps: 100
    },
    ...overrides
  };
}

export function createBranchAuthHeaders(apiKey: string = 'test_branch_server_api_key_123') {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Branch-Server': 'test-server'
  };
}

export async function setupTestBranchData() {
  // Create test branch (check if exists first)
  let branchResult = await DatabaseManager.query(`
    SELECT id FROM branches WHERE code = 'TEST_BRANCH'
  `);
  
  if (branchResult.rows.length === 0) {
    branchResult = await DatabaseManager.query(`
      INSERT INTO branches (code, name, address, phone, is_active)
      VALUES ('TEST_BRANCH', 'Test Branch', '123 Test St', '+998901234567', true)
      RETURNING id
    `);
  }
  const branchId = branchResult.rows[0].id;

  // Create test branch server (check if exists first)
  const serverExists = await DatabaseManager.query(`
    SELECT id FROM branch_servers WHERE branch_id = $1 AND server_name = 'Test Server'
  `, [branchId]);
  
  if (serverExists.rows.length === 0) {
    await DatabaseManager.query(`
      INSERT INTO branch_servers (branch_id, server_name, ip_address, port, api_key, status, is_active)
      VALUES ($1, 'Test Server', '192.168.1.100', 3000, 'test_branch_server_api_key_123', 'online', true)
    `, [branchId]);
  }

  // Create test category (check if exists first)
  let categoryResult = await DatabaseManager.query(`
    SELECT id FROM categories WHERE key = 'TEST_CAT'
  `);
  
  if (categoryResult.rows.length === 0) {
    categoryResult = await DatabaseManager.query(`
      INSERT INTO categories (key, name, is_active)
      VALUES ('TEST_CAT', 'Test Category', true)
      RETURNING id
    `);
  }
  const categoryId = categoryResult.rows[0].id;

  // Create test product (check if exists first)
  let productResult = await DatabaseManager.query(`
    SELECT id FROM products WHERE onec_id = 'TEST_PROD_001'
  `);
  
  if (productResult.rows.length === 0) {
    productResult = await DatabaseManager.query(`
      INSERT INTO products (onec_id, sku, name, category_id, base_price, cost, is_active)
      VALUES ('TEST_PROD_001', 'TST-001', 'Test Product', $1, 100000, 60000, true)
      RETURNING id
    `, [categoryId]);
  }
  const productId = productResult.rows[0].id;

  // Create branch inventory (check if exists first)
  const inventoryExists = await DatabaseManager.query(`
    SELECT id FROM branch_inventory WHERE branch_id = $1 AND product_id = $2
  `, [branchId, productId]);
  
  if (inventoryExists.rows.length === 0) {
    await DatabaseManager.query(`
      INSERT INTO branch_inventory (branch_id, product_id, quantity_in_stock, last_movement_at)
      VALUES ($1, $2, 50, NOW())
    `, [branchId, productId]);
  } else {
    // Update existing inventory
    await DatabaseManager.query(`
      UPDATE branch_inventory SET quantity_in_stock = 50, last_movement_at = NOW()
      WHERE branch_id = $1 AND product_id = $2
    `, [branchId, productId]);
  }

  // Create test employee (check if exists first)
  let employeeResult = await DatabaseManager.query(`
    SELECT id FROM employees WHERE branch_id = $1 AND employee_id = 'EMP_TEST_001'
  `, [branchId]);
  
  if (employeeResult.rows.length === 0) {
    employeeResult = await DatabaseManager.query(`
      INSERT INTO employees (branch_id, employee_id, name, role, status)
      VALUES ($1, 'EMP_TEST_001', 'Test Employee', 'cashier', 'active')
      RETURNING id
    `, [branchId]);
  }
  const employeeId = employeeResult.rows[0].id;

  return { branchId, productId, categoryId, employeeId };
}

export async function cleanupTestBranchData() {
  try {
    // Try to check if database is available by attempting a simple query
    await DatabaseManager.query('SELECT 1');
    
    // Calculate 30 seconds ago
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    
    // If successful, proceed with cleanup - only delete recent test data
    await DatabaseManager.query('DELETE FROM branch_inventory WHERE last_movement_at > $1 OR updated_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM employees WHERE employee_id LIKE \'EMP_TEST_%\' OR created_at > $1', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM products WHERE (onec_id LIKE \'TEST_PROD_%\' OR created_at > $1)', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM categories WHERE (key LIKE \'TEST_%\' OR created_at > $1)', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM branch_servers WHERE (api_key LIKE \'test_%\' OR created_at > $1)', [thirtySecondsAgo]);
    await DatabaseManager.query('DELETE FROM branches WHERE (code LIKE \'TEST_%\' OR created_at > $1)', [thirtySecondsAgo]);
  } catch (error) {
    // Ignore cleanup errors - database might already be closed
    console.log('Note: Test cleanup skipped (database already closed)');
  }
}
