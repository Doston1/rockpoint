import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const customerSchema = z.object({
  onec_id: z.string().optional(),
  customer_code: z.string().optional(),
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
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const updateCustomerSchema = customerSchema.partial();

// ============================================================================
// CUSTOMER MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/customers - Get all customers
router.get('/', requirePermission('customers:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 100, 
    is_active, 
    is_vip, 
    search, 
    loyalty_card_number,
    phone,
    email 
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      c.id, c.onec_id, c.customer_code, c.name, c.phone, c.email,
      c.address, c.date_of_birth, c.gender, c.loyalty_card_number,
      c.loyalty_points, c.discount_percentage, c.is_vip, c.is_active,
      c.notes, c.metadata, c.created_at, c.updated_at,
      COUNT(DISTINCT t.id) as transaction_count,
      COALESCE(SUM(t.total_amount), 0) as total_spent,
      MAX(t.transaction_date) as last_transaction_date
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id
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
  
  if (loyalty_card_number) {
    params.push(loyalty_card_number);
    query += ` AND c.loyalty_card_number = $${params.length}`;
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
    query += ` AND (c.name ILIKE $${params.length} OR c.customer_code ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
  }
  
  query += ` GROUP BY c.id`;
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(DISTINCT c.id) FROM').split('GROUP BY')[0];
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY c.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      customers: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/customers/:id - Get specific customer
router.get('/:id', requirePermission('customers:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { include_transactions } = req.query;
  
  const query = `
    SELECT 
      c.id, c.onec_id, c.customer_code, c.name, c.phone, c.email,
      c.address, c.date_of_birth, c.gender, c.loyalty_card_number,
      c.loyalty_points, c.discount_percentage, c.is_vip, c.is_active,
      c.notes, c.metadata, c.created_at, c.updated_at,
      COUNT(DISTINCT t.id) as transaction_count,
      COALESCE(SUM(t.total_amount), 0) as total_spent,
      MAX(t.transaction_date) as last_transaction_date,
      MIN(t.transaction_date) as first_transaction_date
    FROM customers c
    LEFT JOIN transactions t ON c.id = t.customer_id
    WHERE c.id = $1 OR c.onec_id = $1 OR c.customer_code = $1 OR c.loyalty_card_number = $1
    GROUP BY c.id
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found'
    });
  }
  
  const customer = result.rows[0];
  
  // Include recent transactions if requested
  if (include_transactions === 'true') {
    const transactionsResult = await DatabaseManager.query(`
      SELECT 
        t.id, t.transaction_number, t.transaction_date, t.total_amount,
        t.discount_amount, t.tax_amount, t.payment_method, t.status,
        b.name as branch_name, b.code as branch_code,
        e.name as cashier_name
      FROM transactions t
      LEFT JOIN branches b ON t.branch_id = b.id
      LEFT JOIN employees e ON t.employee_id = e.id
      WHERE t.customer_id = $1
      ORDER BY t.transaction_date DESC
      LIMIT 50
    `, [customer.id]);
    
    customer.recent_transactions = transactionsResult.rows;
  }
  
  res.json({
    success: true,
    data: {
      customer
    }
  });
}));

// POST /api/1c/customers - Create or update customers
router.post('/', requirePermission('customers:write'), asyncHandler(async (req: Request, res: Response) => {
  const customers = z.array(customerSchema).parse(req.body);
  
  const syncId = await createSyncLog('customers', 'import', customers.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const customerData of customers) {
      try {
        // Check if customer exists by multiple identifiers
        let existingCustomer = null;
        
        if (customerData.onec_id) {
          const onecResult = await DatabaseManager.query(
            'SELECT id FROM customers WHERE onec_id = $1',
            [customerData.onec_id]
          );
          if (onecResult.rows.length > 0) {
            existingCustomer = onecResult.rows[0];
          }
        }
        
        if (!existingCustomer && customerData.customer_code) {
          const codeResult = await DatabaseManager.query(
            'SELECT id FROM customers WHERE customer_code = $1',
            [customerData.customer_code]
          );
          if (codeResult.rows.length > 0) {
            existingCustomer = codeResult.rows[0];
          }
        }
        
        if (!existingCustomer && customerData.loyalty_card_number) {
          const cardResult = await DatabaseManager.query(
            'SELECT id FROM customers WHERE loyalty_card_number = $1',
            [customerData.loyalty_card_number]
          );
          if (cardResult.rows.length > 0) {
            existingCustomer = cardResult.rows[0];
          }
        }
        
        if (!existingCustomer && customerData.phone) {
          const phoneResult = await DatabaseManager.query(
            'SELECT id FROM customers WHERE phone = $1',
            [customerData.phone]
          );
          if (phoneResult.rows.length > 0) {
            existingCustomer = phoneResult.rows[0];
          }
        }
        
        let customerId;
        if (existingCustomer) {
          // Update existing customer
          customerId = existingCustomer.id;
          await DatabaseManager.query(`
            UPDATE customers SET
              onec_id = COALESCE($1, onec_id),
              customer_code = COALESCE($2, customer_code),
              name = $3,
              phone = $4,
              email = $5,
              address = $6,
              date_of_birth = $7,
              gender = $8,
              loyalty_card_number = COALESCE($9, loyalty_card_number),
              loyalty_points = COALESCE($10, loyalty_points),
              discount_percentage = COALESCE($11, discount_percentage),
              is_vip = COALESCE($12, is_vip),
              is_active = $13,
              notes = $14,
              metadata = $15,
              updated_at = NOW()
            WHERE id = $16
          `, [
            customerData.onec_id, customerData.customer_code, customerData.name,
            customerData.phone, customerData.email, customerData.address,
            customerData.date_of_birth, customerData.gender, customerData.loyalty_card_number,
            customerData.loyalty_points, customerData.discount_percentage,
            customerData.is_vip, customerData.is_active, customerData.notes,
            JSON.stringify(customerData.metadata || {}), customerId
          ]);
        } else {
          // Create new customer
          const insertResult = await DatabaseManager.query(`
            INSERT INTO customers (
              onec_id, customer_code, name, phone, email, address,
              date_of_birth, gender, loyalty_card_number, loyalty_points,
              discount_percentage, is_vip, is_active, notes, metadata,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              NOW(), NOW()
            ) RETURNING id
          `, [
            customerData.onec_id, customerData.customer_code, customerData.name,
            customerData.phone, customerData.email, customerData.address,
            customerData.date_of_birth, customerData.gender, customerData.loyalty_card_number,
            customerData.loyalty_points, customerData.discount_percentage,
            customerData.is_vip, customerData.is_active, customerData.notes,
            JSON.stringify(customerData.metadata || {})
          ]);
          customerId = insertResult.rows[0].id;
        }
        
        results.push({
          onec_id: customerData.onec_id,
          customer_code: customerData.customer_code,
          name: customerData.name,
          success: true,
          action: existingCustomer ? 'updated' : 'created',
          customer_id: customerId
        });
        
      } catch (error) {
        results.push({
          onec_id: customerData.onec_id,
          customer_code: customerData.customer_code,
          name: customerData.name,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// PUT /api/1c/customers/:id - Update specific customer
router.put('/:id', requirePermission('customers:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const customerData = updateCustomerSchema.parse(req.body);
  
  const result = await DatabaseManager.query(`
    UPDATE customers SET
      onec_id = COALESCE($1, onec_id),
      customer_code = COALESCE($2, customer_code),
      name = COALESCE($3, name),
      phone = COALESCE($4, phone),
      email = COALESCE($5, email),
      address = COALESCE($6, address),
      date_of_birth = COALESCE($7, date_of_birth),
      gender = COALESCE($8, gender),
      loyalty_card_number = COALESCE($9, loyalty_card_number),
      loyalty_points = COALESCE($10, loyalty_points),
      discount_percentage = COALESCE($11, discount_percentage),
      is_vip = COALESCE($12, is_vip),
      is_active = COALESCE($13, is_active),
      notes = COALESCE($14, notes),
      metadata = COALESCE($15, metadata),
      updated_at = NOW()
    WHERE id = $16 OR onec_id = $16 OR customer_code = $16 OR loyalty_card_number = $16
    RETURNING id, name
  `, [
    customerData.onec_id, customerData.customer_code, customerData.name,
    customerData.phone, customerData.email, customerData.address,
    customerData.date_of_birth, customerData.gender, customerData.loyalty_card_number,
    customerData.loyalty_points, customerData.discount_percentage,
    customerData.is_vip, customerData.is_active, customerData.notes,
    JSON.stringify(customerData.metadata || {}), id
  ]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: 'Customer updated successfully',
      customer_id: result.rows[0].id,
      customer_name: result.rows[0].name
    }
  });
}));

// GET /api/1c/customers/:id/transactions - Get customer transaction history
router.get('/:id/transactions', requirePermission('customers:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    page = 1, 
    limit = 50, 
    start_date, 
    end_date, 
    branch_code,
    min_amount,
    max_amount 
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  // First, get customer ID
  const customerResult = await DatabaseManager.query(
    'SELECT id FROM customers WHERE id = $1 OR onec_id = $1 OR customer_code = $1 OR loyalty_card_number = $1',
    [id]
  );
  
  if (customerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found'
    });
  }
  
  const customerId = customerResult.rows[0].id;
  
  let query = `
    SELECT 
      t.id, t.transaction_number, t.transaction_date, t.total_amount,
      t.discount_amount, t.tax_amount, t.payment_method, t.status,
      t.notes, t.metadata,
      b.name as branch_name, b.code as branch_code,
      e.name as cashier_name, e.employee_id as cashier_id,
      COUNT(ti.id) as item_count
    FROM transactions t
    LEFT JOIN branches b ON t.branch_id = b.id
    LEFT JOIN employees e ON t.employee_id = e.id
    LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
    WHERE t.customer_id = $1
  `;
  
  const params: any[] = [customerId];
  
  if (start_date) {
    params.push(start_date);
    query += ` AND t.transaction_date >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND t.transaction_date <= $${params.length}`;
  }
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (min_amount) {
    params.push(Number(min_amount));
    query += ` AND t.total_amount >= $${params.length}`;
  }
  
  if (max_amount) {
    params.push(Number(max_amount));
    query += ` AND t.total_amount <= $${params.length}`;
  }
  
  query += ` GROUP BY t.id, b.name, b.code, e.name, e.employee_id`;
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(DISTINCT t.id) FROM').split('GROUP BY')[0];
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY t.transaction_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      transactions: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// POST /api/1c/customers/:id/loyalty-points - Update customer loyalty points
router.post('/:id/loyalty-points', requirePermission('customers:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { points, operation, reason } = z.object({
    points: z.number().int(),
    operation: z.enum(['add', 'subtract', 'set']),
    reason: z.string().optional()
  }).parse(req.body);
  
  await DatabaseManager.query('BEGIN');
  
  try {
    // Get current customer data
    const customerResult = await DatabaseManager.query(
      'SELECT id, name, loyalty_points FROM customers WHERE id = $1 OR onec_id = $1 OR customer_code = $1 OR loyalty_card_number = $1',
      [id]
    );
    
    if (customerResult.rows.length === 0) {
      await DatabaseManager.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    const customer = customerResult.rows[0];
    let newPoints = customer.loyalty_points;
    
    switch (operation) {
      case 'add':
        newPoints += points;
        break;
      case 'subtract':
        newPoints = Math.max(0, newPoints - points);
        break;
      case 'set':
        newPoints = Math.max(0, points);
        break;
    }
    
    // Update customer points
    await DatabaseManager.query(
      'UPDATE customers SET loyalty_points = $1, updated_at = NOW() WHERE id = $2',
      [newPoints, customer.id]
    );
    
    // Log the points change (you may want to create a loyalty_points_history table)
    // For now, we'll just return the result
    
    await DatabaseManager.query('COMMIT');
    
    res.json({
      success: true,
      data: {
        customer_id: customer.id,
        customer_name: customer.name,
        previous_points: customer.loyalty_points,
        new_points: newPoints,
        points_changed: newPoints - customer.loyalty_points,
        operation: operation,
        reason: reason
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    throw error;
  }
}));

// DELETE /api/1c/customers/:id - Deactivate customer
router.delete('/:id', requirePermission('customers:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(`
    UPDATE customers 
    SET is_active = false, updated_at = NOW()
    WHERE id = $1 OR onec_id = $1 OR customer_code = $1 OR loyalty_card_number = $1
    RETURNING id, name
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Customer "${result.rows[0].name}" has been deactivated`,
      customer_id: result.rows[0].id
    }
  });
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createSyncLog(syncType: string, direction: string, totalRecords: number): Promise<string> {
  const result = await DatabaseManager.query(`
    INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
    VALUES ($1, $2, 'in_progress', $3, NOW())
    RETURNING id
  `, [syncType, direction, totalRecords]);
  
  return result.rows[0].id;
}

async function completeSyncLog(
  syncId: string, 
  status: string, 
  recordsProcessed: number, 
  errorMessage?: string
): Promise<void> {
  await DatabaseManager.query(`
    UPDATE onec_sync_logs 
    SET status = $1, records_processed = $2, error_message = $3, completed_at = NOW()
    WHERE id = $4
  `, [status, recordsProcessed, errorMessage, syncId]);
}

export default router;
