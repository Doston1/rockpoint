import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

// =============================================
// VALIDATION SCHEMAS
// =============================================

const productSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  name_ru: z.string().optional(),
  name_uz: z.string().optional(),
  description: z.string().optional(),
  description_ru: z.string().optional(),
  description_uz: z.string().optional(),
  category_key: z.string().optional(),
  brand: z.string().optional(),
  unit_of_measure: z.string().default('pcs'),
  base_price: z.number().positive(),
  cost: z.number().positive(),
  tax_rate: z.number().min(0).max(1).default(0),
  image_url: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  attributes: z.record(z.any()).optional(),
  is_active: z.boolean().default(true),
  oneC_id: z.string()
});

const priceUpdateSchema = z.object({
  sku: z.string().optional(),
  oneC_id: z.string().optional(),
  base_price: z.number().positive(),
  cost: z.number().positive().optional()
}).refine(data => data.sku || data.oneC_id, {
  message: "Either sku or oneC_id must be provided"
});

const inventoryUpdateSchema = z.object({
  branch_code: z.string(),
  updates: z.array(z.object({
    sku: z.string().optional(),
    oneC_id: z.string().optional(),
    quantity_in_stock: z.number().min(0),
    min_stock_level: z.number().min(0).optional(),
    max_stock_level: z.number().min(0).optional()
  }).refine(data => data.sku || data.oneC_id, {
    message: "Either sku or oneC_id must be provided for each item"
  }))
});

const employeeSchema = z.object({
  employee_id: z.string(),
  branch_code: z.string(),
  name: z.string().min(1),
  role: z.enum(['admin', 'manager', 'supervisor', 'cashier']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  hire_date: z.string().optional(),
  salary: z.number().positive().optional(),
  status: z.enum(['active', 'inactive', 'terminated']).default('active'),
  oneC_id: z.string()
});

// =============================================
// PRODUCT MANAGEMENT ENDPOINTS
// =============================================

// GET /api/1c/products - Get all products
router.get('/products', asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 100, category, active_only = 'true' } = req.query;
  
  let query = `
    SELECT p.*, c.name as category_name, c.key as category_key
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `;
  
  const conditions = [];
  const params: any[] = [];
  
  if (active_only === 'true') {
    conditions.push('p.is_active = true');
  }
  
  if (category) {
    conditions.push('c.key = $' + (params.length + 1));
    params.push(category);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), (Number(page) - 1) * Number(limit));
  
  const result = await DatabaseManager.query(query, params);
  
  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id';
  if (conditions.length > 0) {
    countQuery += ' WHERE ' + conditions.join(' AND ');
  }
  
  const countResult = await DatabaseManager.query(countQuery, params.slice(0, -2));
  const totalCount = parseInt(countResult.rows[0].count);
  
  res.json({
    success: true,
    data: {
      products: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / Number(limit))
      }
    }
  });
}));

// POST /api/1c/products - Create new product
router.post('/products', asyncHandler(async (req: Request, res: Response) => {
  const productData = productSchema.parse(req.body);
  
  // Check if product already exists
  const existingProduct = await DatabaseManager.query(
    'SELECT id FROM products WHERE sku = $1 OR oneC_id = $2',
    [productData.sku, productData.oneC_id]
  );
  
  if (existingProduct.rows.length > 0) {
    throw createError('Product with this SKU or 1C ID already exists', 409);
  }
  
  // Get or create category
  let categoryId = null;
  if (productData.category_key) {
    const categoryResult = await DatabaseManager.query(
      'SELECT id FROM categories WHERE key = $1',
      [productData.category_key]
    );
    
    if (categoryResult.rows.length > 0) {
      categoryId = categoryResult.rows[0].id;
    }
  }
  
  // Insert product
  const result = await DatabaseManager.query(`
    INSERT INTO products (
      sku, barcode, name, name_ru, name_uz, description, description_ru, description_uz,
      category_id, brand, unit_of_measure, base_price, cost, tax_rate,
      image_url, images, attributes, is_active, oneC_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    ) RETURNING *
  `, [
    productData.sku, productData.barcode, productData.name, productData.name_ru, productData.name_uz,
    productData.description, productData.description_ru, productData.description_uz,
    categoryId, productData.brand, productData.unit_of_measure, productData.base_price,
    productData.cost, productData.tax_rate, productData.image_url, productData.images,
    productData.attributes, productData.is_active, productData.oneC_id
  ]);
  
  res.status(201).json({
    success: true,
    data: {
      product: result.rows[0],
      message: 'Product created successfully'
    }
  });
}));

// PUT /api/1c/products/:id - Update product
router.put('/products/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const productData = productSchema.partial().parse(req.body);
  
  // Build dynamic update query
  const updateFields = [];
  const params = [];
  let paramCount = 1;
  
  for (const [key, value] of Object.entries(productData)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      params.push(value);
      paramCount++;
    }
  }
  
  if (updateFields.length === 0) {
    throw createError('No valid fields provided for update', 400);
  }
  
  updateFields.push(`updated_at = NOW()`);
  params.push(id);
  
  const result = await DatabaseManager.query(`
    UPDATE products 
    SET ${updateFields.join(', ')}
    WHERE oneC_id = $${paramCount} OR id = $${paramCount}
    RETURNING *
  `, params);
  
  if (result.rows.length === 0) {
    throw createError('Product not found', 404);
  }
  
  res.json({
    success: true,
    data: {
      product: result.rows[0],
      message: 'Product updated successfully'
    }
  });
}));

// PUT /api/1c/products/prices - Update product prices
router.put('/products/prices', asyncHandler(async (req: Request, res: Response) => {
  const updates = z.array(priceUpdateSchema).parse(req.body);
  
  const results = [];
  
  for (const update of updates) {
    const condition = update.sku ? 'sku = $1' : 'oneC_id = $1';
    const identifier = update.sku || update.oneC_id;
    
    const updateFields = ['base_price = $2', 'updated_at = NOW()'];
    const params = [identifier, update.base_price];
    
    if (update.cost) {
      updateFields.push('cost = $3');
      params.push(update.cost);
    }
    
    const result = await DatabaseManager.query(`
      UPDATE products 
      SET ${updateFields.join(', ')}
      WHERE ${condition}
      RETURNING sku, name, base_price, cost
    `, params);
    
    if (result.rows.length > 0) {
      results.push(result.rows[0]);
    }
  }
  
  res.json({
    success: true,
    data: {
      updated_products: results,
      message: `${results.length} products updated successfully`
    }
  });
}));

// =============================================
// INVENTORY MANAGEMENT ENDPOINTS
// =============================================

// GET /api/1c/inventory - Get inventory levels
router.get('/inventory', asyncHandler(async (req: Request, res: Response) => {
  const { branch_code, sku, low_stock_only = 'false' } = req.query;
  
  let query = `
    SELECT 
      bi.*, 
      p.sku, p.name, p.oneC_id as product_oneC_id,
      b.code as branch_code, b.name as branch_name
    FROM branch_inventory bi
    JOIN products p ON bi.product_id = p.id
    JOIN branches b ON bi.branch_id = b.id
  `;
  
  const conditions = [];
  const params: any[] = [];
  
  if (branch_code) {
    conditions.push(`b.code = $${params.length + 1}`);
    params.push(branch_code);
  }
  
  if (sku) {
    conditions.push(`p.sku = $${params.length + 1}`);
    params.push(sku);
  }
  
  if (low_stock_only === 'true') {
    conditions.push('bi.quantity_in_stock <= bi.min_stock_level');
  }
  
  conditions.push('p.is_active = true');
  conditions.push('b.is_active = true');
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY b.code, p.sku';
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      inventory: result.rows,
      total_items: result.rows.length
    }
  });
}));

// PUT /api/1c/inventory - Update inventory levels
router.put('/inventory', asyncHandler(async (req: Request, res: Response) => {
  const updateData = inventoryUpdateSchema.parse(req.body);
  
  // Get branch ID
  const branchResult = await DatabaseManager.query(
    'SELECT id FROM branches WHERE code = $1 AND is_active = true',
    [updateData.branch_code]
  );
  
  if (branchResult.rows.length === 0) {
    throw createError('Branch not found or inactive', 404);
  }
  
  const branchId = branchResult.rows[0].id;
  const results = [];
  
  for (const update of updateData.updates) {
    // Get product ID
    const condition = update.sku ? 'sku = $1' : 'oneC_id = $1';
    const identifier = update.sku || update.oneC_id;
    
    const productResult = await DatabaseManager.query(
      `SELECT id FROM products WHERE ${condition} AND is_active = true`,
      [identifier]
    );
    
    if (productResult.rows.length === 0) {
      continue; // Skip invalid products
    }
    
    const productId = productResult.rows[0].id;
    
    // Upsert inventory record
    const result = await DatabaseManager.query(`
      INSERT INTO branch_inventory (branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (branch_id, product_id) 
      DO UPDATE SET 
        quantity_in_stock = $3,
        min_stock_level = COALESCE($4, branch_inventory.min_stock_level),
        max_stock_level = COALESCE($5, branch_inventory.max_stock_level),
        updated_at = NOW()
      RETURNING *
    `, [branchId, productId, update.quantity_in_stock, update.min_stock_level, update.max_stock_level]);
    
    results.push(result.rows[0]);
  }
  
  res.json({
    success: true,
    data: {
      updated_inventory: results,
      message: `${results.length} inventory items updated successfully`
    }
  });
}));

// =============================================
// EMPLOYEE MANAGEMENT ENDPOINTS
// =============================================

// GET /api/1c/employees - Get employees
router.get('/employees', asyncHandler(async (req: Request, res: Response) => {
  const { branch_code, status = 'active' } = req.query;
  
  let query = `
    SELECT 
      e.*, 
      b.code as branch_code, b.name as branch_name
    FROM employees e
    JOIN branches b ON e.branch_id = b.id
  `;
  
  const conditions = ['b.is_active = true'];
  const params: any[] = [];
  
  if (branch_code) {
    conditions.push(`b.code = $${params.length + 1}`);
    params.push(branch_code);
  }
  
  if (status && status !== 'all') {
    conditions.push(`e.status = $${params.length + 1}`);
    params.push(status);
  }
  
  query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY b.code, e.name';
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      employees: result.rows,
      total_employees: result.rows.length
    }
  });
}));

// POST /api/1c/employees - Create employee
router.post('/employees', asyncHandler(async (req: Request, res: Response) => {
  const employeeData = employeeSchema.parse(req.body);
  
  // Get branch ID
  const branchResult = await DatabaseManager.query(
    'SELECT id FROM branches WHERE code = $1 AND is_active = true',
    [employeeData.branch_code]
  );
  
  if (branchResult.rows.length === 0) {
    throw createError('Branch not found or inactive', 404);
  }
  
  const branchId = branchResult.rows[0].id;
  
  // Check if employee already exists
  const existingEmployee = await DatabaseManager.query(
    'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
    [employeeData.employee_id, branchId]
  );
  
  if (existingEmployee.rows.length > 0) {
    throw createError('Employee with this ID already exists in this branch', 409);
  }
  
  // Insert employee
  const result = await DatabaseManager.query(`
    INSERT INTO employees (
      employee_id, branch_id, name, role, phone, email, hire_date, salary, status, oneC_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    ) RETURNING *
  `, [
    employeeData.employee_id, branchId, employeeData.name, employeeData.role,
    employeeData.phone, employeeData.email, employeeData.hire_date,
    employeeData.salary, employeeData.status, employeeData.oneC_id
  ]);
  
  res.status(201).json({
    success: true,
    data: {
      employee: result.rows[0],
      message: 'Employee created successfully'
    }
  });
}));

// =============================================
// TIME TRACKING ENDPOINTS
// =============================================

// GET /api/1c/time-logs - Get employee working hours
router.get('/time-logs', asyncHandler(async (req: Request, res: Response) => {
  const { 
    branch_code, 
    employee_id, 
    start_date, 
    end_date,
    period = 'day' // day, week, month
  } = req.query;
  
  // Calculate date range based on period
  let dateCondition = '';
  const params: any[] = [];
  let paramCount = 1;
  
  if (start_date && end_date) {
    dateCondition = `etl.clock_in >= $${paramCount} AND etl.clock_in <= $${paramCount + 1}`;
    params.push(start_date, end_date);
    paramCount += 2;
  } else {
    // Use period to calculate range
    switch (period) {
      case 'day':
        dateCondition = `etl.clock_in >= CURRENT_DATE AND etl.clock_in < CURRENT_DATE + INTERVAL '1 day'`;
        break;
      case 'week':
        dateCondition = `etl.clock_in >= DATE_TRUNC('week', CURRENT_DATE) AND etl.clock_in < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`;
        break;
      case 'month':
        dateCondition = `etl.clock_in >= DATE_TRUNC('month', CURRENT_DATE) AND etl.clock_in < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`;
        break;
    }
  }
  
  let query = `
    SELECT 
      etl.*,
      e.name as employee_name, e.employee_id, e.oneC_id as employee_oneC_id,
      b.code as branch_code, b.name as branch_name
    FROM employee_time_logs etl
    JOIN employees e ON etl.employee_id = e.id
    JOIN branches b ON etl.branch_id = b.id
    WHERE ${dateCondition}
  `;
  
  if (branch_code) {
    query += ` AND b.code = $${paramCount}`;
    params.push(branch_code);
    paramCount++;
  }
  
  if (employee_id) {
    query += ` AND e.employee_id = $${paramCount}`;
    params.push(employee_id);
    paramCount++;
  }
  
  query += ' ORDER BY etl.clock_in DESC';
  
  const result = await DatabaseManager.query(query, params);
  
  // Calculate summary statistics
  const summary = result.rows.reduce((acc: any, log: any) => {
    acc.total_hours += log.total_hours || 0;
    acc.overtime_hours += log.overtime_hours || 0;
    acc.total_logs += 1;
    return acc;
  }, { total_hours: 0, overtime_hours: 0, total_logs: 0 });
  
  res.json({
    success: true,
    data: {
      time_logs: result.rows,
      summary,
      period: period,
      date_range: start_date && end_date ? { start_date, end_date } : null
    }
  });
}));

// =============================================
// TRANSACTION REPORTS ENDPOINTS
// =============================================

// GET /api/1c/transactions - Get transaction data
router.get('/transactions', asyncHandler(async (req: Request, res: Response) => {
  const { 
    branch_code, 
    start_date, 
    end_date,
    status = 'completed',
    include_items = 'false'
  } = req.query;
  
  let query = `
    SELECT 
      t.*,
      b.code as branch_code, b.name as branch_name,
      e.name as employee_name, e.employee_id
    FROM transactions t
    JOIN branches b ON t.branch_id = b.id
    LEFT JOIN employees e ON t.employee_id = e.id
  `;
  
  const conditions = ['b.is_active = true'];
  const params: any[] = [];
  
  if (branch_code) {
    conditions.push(`b.code = $${params.length + 1}`);
    params.push(branch_code);
  }
  
  if (status && status !== 'all') {
    conditions.push(`t.status = $${params.length + 1}`);
    params.push(status);
  }
  
  if (start_date) {
    conditions.push(`t.completed_at >= $${params.length + 1}`);
    params.push(start_date);
  }
  
  if (end_date) {
    conditions.push(`t.completed_at <= $${params.length + 1}`);
    params.push(end_date);
  }
  
  query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY t.completed_at DESC';
  
  const result = await DatabaseManager.query(query, params);
  
  // If include_items is true, fetch transaction items
  const transactions = result.rows;
  if (include_items === 'true' && transactions.length > 0) {
    const transactionIds = transactions.map((t: any) => t.id);
    
    const itemsResult = await DatabaseManager.query(`
      SELECT 
        ti.*,
        p.sku, p.name as product_name, p.oneC_id as product_oneC_id
      FROM transaction_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transaction_id = ANY($1)
      ORDER BY ti.transaction_id, ti.id
    `, [transactionIds]);
    
    // Group items by transaction
    const itemsByTransaction = itemsResult.rows.reduce((acc: any, item: any) => {
      if (!acc[item.transaction_id]) {
        acc[item.transaction_id] = [];
      }
      acc[item.transaction_id].push(item);
      return acc;
    }, {});
    
    // Add items to transactions
    transactions.forEach((transaction: any) => {
      transaction.items = itemsByTransaction[transaction.id] || [];
    });
  }
  
  // Calculate summary
  const summary = transactions.reduce((acc: any, t: any) => {
    acc.total_amount += parseFloat(t.total_amount || 0);
    acc.total_transactions += 1;
    acc.average_transaction = acc.total_amount / acc.total_transactions;
    return acc;
  }, { total_amount: 0, total_transactions: 0, average_transaction: 0 });
  
  res.json({
    success: true,
    data: {
      transactions,
      summary,
      include_items: include_items === 'true'
    }
  });
}));

// =============================================
// SYSTEM STATUS ENDPOINTS
// =============================================

// GET /api/1c/status - Get system status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  // Get basic system stats
  const stats = await Promise.all([
    DatabaseManager.query('SELECT COUNT(*) as count FROM branches WHERE is_active = true'),
    DatabaseManager.query('SELECT COUNT(*) as count FROM products WHERE is_active = true'),
    DatabaseManager.query('SELECT COUNT(*) as count FROM employees WHERE status = \'active\''),
    DatabaseManager.query(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE completed_at >= CURRENT_DATE AND status = 'completed'
    `),
    DatabaseManager.query(`
      SELECT COALESCE(SUM(total_amount), 0) as amount 
      FROM transactions 
      WHERE completed_at >= CURRENT_DATE AND status = 'completed'
    `)
  ]);
  
  res.json({
    success: true,
    data: {
      system_status: 'healthy',
      timestamp: new Date().toISOString(),
      statistics: {
        active_branches: parseInt(stats[0].rows[0].count),
        active_products: parseInt(stats[1].rows[0].count),
        active_employees: parseInt(stats[2].rows[0].count),
        daily_transactions: parseInt(stats[3].rows[0].count),
        daily_revenue: parseFloat(stats[4].rows[0].amount)
      }
    }
  });
}));

export default router;
