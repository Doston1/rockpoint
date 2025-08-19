import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  loyalty_card_number: z.string().optional(),
  loyalty_points: z.number().min(0).default(0),
  discount_percentage: z.number().min(0).max(100).default(0),
  is_vip: z.boolean().default(false),
  notes: z.string().optional()
});

const updateCustomerSchema = createCustomerSchema.partial();

// ============================================================================
// CUSTOMER MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/customers - Get all customers with pagination
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 50, 
    search, 
    is_active = 'true',
    is_vip,
    phone,
    email 
  } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      c.id, c.name, c.phone, c.email, c.address, 
      c.date_of_birth, c.gender, c.loyalty_card_number,
      c.loyalty_points, c.discount_percentage, c.is_vip, c.is_active,
      c.notes, c.created_at, c.updated_at,
      COUNT(DISTINCT t.id) as transaction_count,
      COALESCE(SUM(t.total_amount), 0) as total_spent,
      MAX(COALESCE(t.completed_at, t.created_at)) as last_transaction_date
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id AND t.status = 'completed'
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (is_active !== undefined) {
    params.push(is_active === 'true');
    query += ` AND c.is_active = $${params.length}`;
  }
  
  if (is_vip !== undefined) {
    params.push(is_vip === 'true');
    query += ` AND c.is_vip = $${params.length}`;
  }
  
  if (phone) {
    params.push(`%${phone}%`);
    query += ` AND c.phone ILIKE $${params.length}`;
  }
  
  if (email) {
    params.push(`%${email}%`);
    query += ` AND c.email ILIKE $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.loyalty_card_number ILIKE $${params.length})`;
  }
  
  query += ` GROUP BY c.id, c.name, c.phone, c.email, c.address, c.date_of_birth, c.gender, c.loyalty_card_number, c.loyalty_points, c.discount_percentage, c.is_vip, c.is_active, c.notes, c.created_at, c.updated_at`;
  
  // Get total count for pagination - use a simpler query without aggregates
  let countQuery = `
    SELECT COUNT(DISTINCT c.id) as count
    FROM customers c
    WHERE 1=1
  `;
  
  // Add the same WHERE conditions for counting
  let countParams = [];
  
  if (is_active !== undefined) {
    countParams.push(is_active === 'true');
    countQuery += ` AND c.is_active = $${countParams.length}`;
  }
  
  if (is_vip !== undefined) {
    countParams.push(is_vip === 'true');
    countQuery += ` AND c.is_vip = $${countParams.length}`;
  }
  
  if (phone) {
    countParams.push(`%${phone}%`);
    countQuery += ` AND c.phone ILIKE $${countParams.length}`;
  }
  
  if (email) {
    countParams.push(`%${email}%`);
    countQuery += ` AND c.email ILIKE $${countParams.length}`;
  }
  
  if (search) {
    countParams.push(`%${search}%`);
    countQuery += ` AND (c.name ILIKE $${countParams.length} OR c.phone ILIKE $${countParams.length} OR c.email ILIKE $${countParams.length} OR c.loyalty_card_number ILIKE $${countParams.length})`;
  }
  
  const countResult = await DatabaseManager.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination and ordering
  params.push(Number(limit), offset);
  query += ` ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      customers: result.rows
    },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    },
    timestamp: new Date().toISOString()
  });
}));

// GET /api/customers/:id - Get specific customer
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { include_transactions = 'false' } = req.query;
  
  const query = `
    SELECT 
      c.id, c.name, c.phone, c.email, c.address,
      c.date_of_birth, c.gender, c.loyalty_card_number,
      c.loyalty_points, c.discount_percentage, c.is_vip, c.is_active,
      c.notes, c.created_at, c.updated_at,
      COUNT(DISTINCT t.id) as transaction_count,
      COALESCE(SUM(t.total_amount), 0) as total_spent,
      MAX(COALESCE(t.completed_at, t.created_at)) as last_transaction_date,
      MIN(COALESCE(t.completed_at, t.created_at)) as first_transaction_date,
      AVG(t.total_amount) as average_transaction_amount
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id AND t.status = 'completed'
    WHERE c.id = $1
    GROUP BY c.id, c.name, c.phone, c.email, c.address, c.date_of_birth, c.gender, c.loyalty_card_number, c.loyalty_points, c.discount_percentage, c.is_vip, c.is_active, c.notes, c.created_at, c.updated_at
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found',
      timestamp: new Date().toISOString()
    });
  }
  
  const customer = result.rows[0];
  
  // Include recent transactions if requested
  if (include_transactions === 'true') {
    const transactionsResult = await DatabaseManager.query(`
      SELECT 
        t.id, t.terminal_id as transaction_number, COALESCE(t.completed_at, t.created_at) as transaction_date, t.total_amount,
        0 as discount_amount, t.tax_amount, 'cash' as payment_method, t.status,
        'Main Branch' as branch_name, 'MAIN' as branch_code,
        e.name as cashier_name
      FROM transactions t
      LEFT JOIN employees e ON t.employee_id = e.id
      WHERE t.customer_id = $1::uuid
      ORDER BY COALESCE(t.completed_at, t.created_at) DESC
      LIMIT 20
    `, [customer.id]);
    
    customer.recent_transactions = transactionsResult.rows;
  }
  
  res.json({
    success: true,
    data: customer,
    timestamp: new Date().toISOString()
  });
}));

// POST /api/customers - Create new customer
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const customerData = createCustomerSchema.parse(req.body);
  
  // Check for duplicate phone or email if provided
  if (customerData.phone || customerData.email) {
    let duplicateQuery = 'SELECT id, name FROM customers WHERE is_active = true AND (';
    const duplicateParams: any[] = [];
    
    if (customerData.phone) {
      duplicateParams.push(customerData.phone);
      duplicateQuery += `phone = $${duplicateParams.length}`;
    }
    
    if (customerData.email) {
      if (duplicateParams.length > 0) duplicateQuery += ' OR ';
      duplicateParams.push(customerData.email);
      duplicateQuery += `email = $${duplicateParams.length}`;
    }
    
    duplicateQuery += ')';
    
    const duplicateResult = await DatabaseManager.query(duplicateQuery, duplicateParams);
    if (duplicateResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer with this phone number or email already exists',
        existing_customer: duplicateResult.rows[0],
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Generate loyalty card number if not provided
  if (!customerData.loyalty_card_number) {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    customerData.loyalty_card_number = `LC${timestamp}${random}`;
  }
  
  const insertResult = await DatabaseManager.query(`
    INSERT INTO customers (
      name, phone, email, address, date_of_birth, gender,
      loyalty_card_number, loyalty_points, discount_percentage,
      is_vip, is_active, notes, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, NOW(), NOW()
    ) RETURNING *
  `, [
    customerData.name, customerData.phone, customerData.email,
    customerData.address, customerData.date_of_birth, customerData.gender,
    customerData.loyalty_card_number, customerData.loyalty_points,
    customerData.discount_percentage, customerData.is_vip, customerData.notes
  ]);
  
  res.status(201).json({
    success: true,
    data: insertResult.rows[0],
    message: 'Customer created successfully',
    timestamp: new Date().toISOString()
  });
}));

// PUT /api/customers/:id - Update customer
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const customerData = updateCustomerSchema.parse(req.body);
  
  // Check if customer exists
  const existingResult = await DatabaseManager.query(
    'SELECT id FROM customers WHERE id = $1',
    [id]
  );
  
  if (existingResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found',
      timestamp: new Date().toISOString()
    });
  }
  
  // Check for duplicate phone or email if provided and different from current
  if (customerData.phone || customerData.email) {
    let duplicateQuery = 'SELECT id, name FROM customers WHERE is_active = true AND id != $1 AND (';
    const duplicateParams: any[] = [id];
    
    if (customerData.phone) {
      duplicateParams.push(customerData.phone);
      duplicateQuery += `phone = $${duplicateParams.length}`;
    }
    
    if (customerData.email) {
      if (customerData.phone) duplicateQuery += ' OR ';
      duplicateParams.push(customerData.email);
      duplicateQuery += `email = $${duplicateParams.length}`;
    }
    
    duplicateQuery += ')';
    
    const duplicateResult = await DatabaseManager.query(duplicateQuery, duplicateParams);
    if (duplicateResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer with this phone number or email already exists',
        existing_customer: duplicateResult.rows[0],
        timestamp: new Date().toISOString()
      });
    }
  }
  
  const updateResult = await DatabaseManager.query(`
    UPDATE customers SET
      name = COALESCE($1, name),
      phone = COALESCE($2, phone),
      email = COALESCE($3, email),
      address = COALESCE($4, address),
      date_of_birth = COALESCE($5, date_of_birth),
      gender = COALESCE($6, gender),
      loyalty_card_number = COALESCE($7, loyalty_card_number),
      loyalty_points = COALESCE($8, loyalty_points),
      discount_percentage = COALESCE($9, discount_percentage),
      is_vip = COALESCE($10, is_vip),
      notes = COALESCE($11, notes),
      updated_at = NOW()
    WHERE id = $12
    RETURNING *
  `, [
    customerData.name, customerData.phone, customerData.email,
    customerData.address, customerData.date_of_birth, customerData.gender,
    customerData.loyalty_card_number, customerData.loyalty_points,
    customerData.discount_percentage, customerData.is_vip,
    customerData.notes, id
  ]);
  
  res.json({
    success: true,
    data: updateResult.rows[0],
    message: 'Customer updated successfully',
    timestamp: new Date().toISOString()
  });
}));

// DELETE /api/customers/:id - Deactivate customer (soft delete)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(`
    UPDATE customers 
    SET is_active = false, updated_at = NOW()
    WHERE id = $1 AND is_active = true
    RETURNING id, name
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found or already deactivated',
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Customer "${result.rows[0].name}" has been deactivated`,
      customer_id: result.rows[0].id
    },
    timestamp: new Date().toISOString()
  });
}));

// POST /api/customers/:id/activate - Reactivate customer
router.post('/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(`
    UPDATE customers 
    SET is_active = true, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found',
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Customer "${result.rows[0].name}" has been activated`,
      customer_id: result.rows[0].id
    },
    timestamp: new Date().toISOString()
  });
}));

// GET /api/customers/:id/transactions - Get customer transaction history
router.get('/:id/transactions', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    page = 1, 
    limit = 20, 
    start_date, 
    end_date,
    min_amount,
    max_amount,
    branch_id 
  } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  // Check if customer exists
  const customerResult = await DatabaseManager.query(
    'SELECT id, name FROM customers WHERE id = $1',
    [id]
  );
  
  if (customerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found',
      timestamp: new Date().toISOString()
    });
  }
  
  let query = `
    SELECT 
      t.id, t.terminal_id as transaction_number, COALESCE(t.completed_at, t.created_at) as transaction_date, t.total_amount,
      0 as discount_amount, t.tax_amount, 'cash' as payment_method, t.status,
      'Main Branch' as branch_name, 'MAIN' as branch_code,
      e.name as cashier_name, e.employee_id as cashier_id,
      COUNT(ti.id) as item_count
    FROM transactions t
    LEFT JOIN employees e ON t.employee_id = e.id
    LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
    WHERE t.customer_id = $1::uuid
  `;
  
  const params: any[] = [id];
  
  if (start_date) {
    params.push(start_date);
    query += ` AND COALESCE(t.completed_at, t.created_at) >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND COALESCE(t.completed_at, t.created_at) <= $${params.length}`;
  }
  
  if (min_amount) {
    params.push(Number(min_amount));
    query += ` AND t.total_amount >= $${params.length}`;
  }
  
  if (max_amount) {
    params.push(Number(max_amount));
    query += ` AND t.total_amount <= $${params.length}`;
  }
  
  // Note: branch_id filtering removed as branches table is not properly set up
  
  query += ` GROUP BY t.id, e.name, e.employee_id`;
  
  // Get total count for pagination
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_subquery`;
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY COALESCE(t.completed_at, t.created_at) DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      customer: customerResult.rows[0],
      transactions: result.rows
    },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    },
    timestamp: new Date().toISOString()
  });
}));

export default router;
