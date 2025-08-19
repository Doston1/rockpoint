import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const transactionSchema = z.object({
  onec_id: z.string().optional(),
  transaction_number: z.string().min(1, 'Transaction number is required'),
  branch_code: z.string().min(1, 'Branch code is required'),
  employee_id: z.string().min(1, 'Employee ID is required'),
  customer_id: z.string().optional(),
  customer_onec_id: z.string().optional(),
  customer_loyalty_card: z.string().optional(),
  transaction_date: z.string(),
  subtotal_amount: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  payment_method: z.enum(['cash', 'card', 'mixed', 'credit', 'loyalty_points']),
  status: z.enum(['completed', 'cancelled', 'refunded', 'pending']).default('completed'),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  items: z.array(z.object({
    product_id: z.string().optional(),
    product_barcode: z.string().optional(),
    product_sku: z.string().optional(),
    product_name: z.string().min(1),
    quantity: z.number().positive(),
    unit_price: z.number().min(0),
    discount_amount: z.number().min(0).default(0),
    tax_amount: z.number().min(0).default(0),
    total_amount: z.number().min(0),
    metadata: z.record(z.any()).optional()
  })).min(1)
});

const transactionItemSchema = z.object({
  product_id: z.string().optional(),
  product_barcode: z.string().optional(),
  product_sku: z.string().optional(),
  product_name: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  metadata: z.record(z.any()).optional()
});

// ============================================================================
// TRANSACTION MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/transactions - Get all transactions
router.get('/', requirePermission('transactions:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 100, 
    branch_code,
    employee_id,
    customer_id,
    status,
    payment_method,
    start_date,
    end_date,
    min_amount,
    max_amount,
    include_items
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      t.id, t.onec_id, t.transaction_number, t.transaction_date,
      t.subtotal_amount, t.discount_amount, t.tax_amount, t.total_amount,
      t.payment_method, t.status, t.notes, t.metadata,
      t.created_at, t.updated_at,
      b.code as branch_code, b.name as branch_name,
      e.employee_id, e.name as employee_name,
      c.customer_code, c.name as customer_name, c.loyalty_card_number,
      COUNT(DISTINCT ti.id) as item_count,
      COUNT(DISTINCT p.id) as payment_count
    FROM transactions t
    LEFT JOIN branches b ON t.branch_id = b.id
    LEFT JOIN employees e ON t.employee_id = e.id
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
    LEFT JOIN payments p ON t.id = p.transaction_id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (employee_id) {
    params.push(employee_id);
    query += ` AND e.employee_id = $${params.length}`;
  }
  
  if (customer_id) {
    params.push(customer_id);
    query += ` AND (c.id = $${params.length} OR c.customer_code = $${params.length} OR c.onec_id = $${params.length})`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND t.status = $${params.length}`;
  }
  
  if (payment_method) {
    params.push(payment_method);
    query += ` AND t.payment_method = $${params.length}`;
  }
  
  if (start_date) {
    params.push(start_date);
    query += ` AND t.transaction_date >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND t.transaction_date <= $${params.length}`;
  }
  
  if (min_amount) {
    params.push(Number(min_amount));
    query += ` AND t.total_amount >= $${params.length}`;
  }
  
  if (max_amount) {
    params.push(Number(max_amount));
    query += ` AND t.total_amount <= $${params.length}`;
  }
  
  query += ` GROUP BY t.id, b.code, b.name, e.employee_id, e.name, c.customer_code, c.name, c.loyalty_card_number`;
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(DISTINCT t.id) FROM').split('GROUP BY')[0];
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY t.transaction_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  // Include items if requested
  if (include_items === 'true' && result.rows.length > 0) {
    const transactionIds = result.rows.map((t: any) => t.id);
    const itemsResult = await DatabaseManager.query(`
      SELECT 
        ti.transaction_id, ti.id as item_id,
        ti.product_id, ti.product_name, ti.quantity,
        ti.unit_price, ti.discount_amount, ti.tax_amount, ti.total_amount,
        p.sku, p.barcode
      FROM transaction_items ti
      LEFT JOIN products p ON ti.product_id = p.id
      WHERE ti.transaction_id = ANY($1)
      ORDER BY ti.transaction_id, ti.id
    `, [transactionIds]);
    
    // Group items by transaction
    const itemsByTransaction: { [key: string]: any[] } = {};
    itemsResult.rows.forEach((item: any) => {
      if (!itemsByTransaction[item.transaction_id]) {
        itemsByTransaction[item.transaction_id] = [];
      }
      itemsByTransaction[item.transaction_id].push(item);
    });
    
    // Add items to transactions
    result.rows.forEach((transaction: any) => {
      transaction.items = itemsByTransaction[transaction.id] || [];
    });
  }
  
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

// GET /api/1c/transactions/:id - Get specific transaction
router.get('/:id', requirePermission('transactions:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { include_items, include_payments } = req.query;
  
  const query = `
    SELECT 
      t.id, t.onec_id, t.transaction_number, t.transaction_date,
      t.subtotal_amount, t.discount_amount, t.tax_amount, t.total_amount,
      t.payment_method, t.status, t.notes, t.metadata,
      t.created_at, t.updated_at,
      b.code as branch_code, b.name as branch_name,
      e.employee_id, e.name as employee_name,
      c.customer_code, c.name as customer_name, c.loyalty_card_number
    FROM transactions t
    LEFT JOIN branches b ON t.branch_id = b.id
    LEFT JOIN employees e ON t.employee_id = e.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.id = $1 OR t.onec_id = $1 OR t.transaction_number = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found'
    });
  }
  
  const transaction = result.rows[0];
  
  // Include items if requested (default is true for single transaction)
  if (include_items !== 'false') {
    const itemsResult = await DatabaseManager.query(`
      SELECT 
        ti.id as item_id, ti.product_id, ti.product_name,
        ti.quantity, ti.unit_price, ti.discount_amount, ti.tax_amount, ti.total_amount,
        ti.metadata,
        p.sku, p.barcode, p.name as product_full_name
      FROM transaction_items ti
      LEFT JOIN products p ON ti.product_id = p.id
      WHERE ti.transaction_id = $1
      ORDER BY ti.id
    `, [transaction.id]);
    
    transaction.items = itemsResult.rows;
  }
  
  // Include payments if requested
  if (include_payments === 'true') {
    const paymentsResult = await DatabaseManager.query(`
      SELECT 
        id as payment_id, payment_method, amount, currency,
        card_type, card_last_four, reference_number,
        status, processed_at, metadata
      FROM payments
      WHERE transaction_id = $1
      ORDER BY processed_at
    `, [transaction.id]);
    
    transaction.payments = paymentsResult.rows;
  }
  
  res.json({
    success: true,
    data: {
      transaction
    }
  });
}));

// POST /api/1c/transactions - Import transactions from 1C
router.post('/', requirePermission('transactions:write'), asyncHandler(async (req: Request, res: Response) => {
  const transactions = z.array(transactionSchema).parse(req.body);
  
  const syncId = await createSyncLog('transactions', 'import', transactions.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const transactionData of transactions) {
      try {
        // Find branch
        const branchResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1',
          [transactionData.branch_code]
        );
        
        if (branchResult.rows.length === 0) {
          throw new Error(`Branch with code "${transactionData.branch_code}" not found`);
        }
        
        const branchId = branchResult.rows[0].id;
        
        // Find employee
        const employeeResult = await DatabaseManager.query(
          'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
          [transactionData.employee_id, branchId]
        );
        
        if (employeeResult.rows.length === 0) {
          throw new Error(`Employee with ID "${transactionData.employee_id}" not found in branch "${transactionData.branch_code}"`);
        }
        
        const employeeId = employeeResult.rows[0].id;
        
        // Find customer if provided
        let customerId = null;
        if (transactionData.customer_id || transactionData.customer_onec_id || transactionData.customer_loyalty_card) {
          const customerQuery = `
            SELECT id FROM customers 
            WHERE id = $1 OR onec_id = $1 OR customer_code = $1 OR loyalty_card_number = $1
          `;
          const customerParam = transactionData.customer_id || transactionData.customer_onec_id || transactionData.customer_loyalty_card;
          
          const customerResult = await DatabaseManager.query(customerQuery, [customerParam]);
          if (customerResult.rows.length > 0) {
            customerId = customerResult.rows[0].id;
          }
        }
        
        // Check if transaction exists
        const existingResult = await DatabaseManager.query(
          'SELECT id FROM transactions WHERE transaction_number = $1 AND branch_id = $2 OR onec_id = $3',
          [transactionData.transaction_number, branchId, transactionData.onec_id || null]
        );
        
        let transactionId;
        if (existingResult.rows.length > 0) {
          // Update existing transaction
          transactionId = existingResult.rows[0].id;
          await DatabaseManager.query(`
            UPDATE transactions SET
              onec_id = COALESCE($1, onec_id),
              transaction_number = $2,
              employee_id = $3,
              customer_id = $4,
              transaction_date = $5,
              subtotal_amount = $6,
              discount_amount = $7,
              tax_amount = $8,
              total_amount = $9,
              payment_method = $10,
              status = $11,
              notes = $12,
              metadata = $13,
              updated_at = NOW()
            WHERE id = $14
          `, [
            transactionData.onec_id, transactionData.transaction_number, employeeId, customerId,
            transactionData.transaction_date, transactionData.subtotal_amount, transactionData.discount_amount,
            transactionData.tax_amount, transactionData.total_amount, transactionData.payment_method,
            transactionData.status, transactionData.notes, JSON.stringify(transactionData.metadata || {}),
            transactionId
          ]);
          
          // Delete existing items and re-create them
          await DatabaseManager.query('DELETE FROM transaction_items WHERE transaction_id = $1', [transactionId]);
          
        } else {
          // Create new transaction
          const insertResult = await DatabaseManager.query(`
            INSERT INTO transactions (
              onec_id, transaction_number, branch_id, employee_id, customer_id,
              transaction_date, subtotal_amount, discount_amount, tax_amount, total_amount,
              payment_method, status, notes, metadata, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
            ) RETURNING id
          `, [
            transactionData.onec_id, transactionData.transaction_number, branchId, employeeId, customerId,
            transactionData.transaction_date, transactionData.subtotal_amount, transactionData.discount_amount,
            transactionData.tax_amount, transactionData.total_amount, transactionData.payment_method,
            transactionData.status, transactionData.notes, JSON.stringify(transactionData.metadata || {})
          ]);
          transactionId = insertResult.rows[0].id;
        }
        
        // Create transaction items
        for (const item of transactionData.items) {
          // Find product if barcode or SKU provided
          let productId = null;
          if (item.product_barcode || item.product_sku || item.product_id) {
            const productQuery = `
              SELECT id FROM products 
              WHERE id = $1 OR barcode = $1 OR sku = $1
            `;
            const productParam = item.product_id || item.product_barcode || item.product_sku;
            
            const productResult = await DatabaseManager.query(productQuery, [productParam]);
            if (productResult.rows.length > 0) {
              productId = productResult.rows[0].id;
            }
          }
          
          await DatabaseManager.query(`
            INSERT INTO transaction_items (
              transaction_id, product_id, product_name, quantity,
              unit_price, discount_amount, tax_amount, total_amount,
              metadata, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
            )
          `, [
            transactionId, productId, item.product_name, item.quantity,
            item.unit_price, item.discount_amount, item.tax_amount, item.total_amount,
            JSON.stringify(item.metadata || {})
          ]);
        }
        
        results.push({
          onec_id: transactionData.onec_id,
          transaction_number: transactionData.transaction_number,
          success: true,
          action: existingResult.rows.length > 0 ? 'updated' : 'created',
          transaction_id: transactionId,
          items_count: transactionData.items.length
        });
        
      } catch (error) {
        results.push({
          onec_id: transactionData.onec_id,
          transaction_number: transactionData.transaction_number,
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

// PUT /api/1c/transactions/:id/status - Update transaction status
router.put('/:id/status', requirePermission('transactions:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = z.object({
    status: z.enum(['completed', 'cancelled', 'refunded', 'pending']),
    notes: z.string().optional()
  }).parse(req.body);
  
  const result = await DatabaseManager.query(`
    UPDATE transactions 
    SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
    WHERE id = $3 OR onec_id = $3 OR transaction_number = $3
    RETURNING id, transaction_number, status
  `, [status, notes, id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: 'Transaction status updated successfully',
      transaction_id: result.rows[0].id,
      transaction_number: result.rows[0].transaction_number,
      new_status: result.rows[0].status
    }
  });
}));

// ============================================================================
// TRANSACTION ITEMS ENDPOINTS
// ============================================================================

// GET /api/1c/transactions/:id/items - Get transaction items
router.get('/:id/items', requirePermission('transactions:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get transaction ID
  const transactionResult = await DatabaseManager.query(
    'SELECT id FROM transactions WHERE id = $1 OR onec_id = $1 OR transaction_number = $1',
    [id]
  );
  
  if (transactionResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found'
    });
  }
  
  const transactionId = transactionResult.rows[0].id;
  
  const result = await DatabaseManager.query(`
    SELECT 
      ti.id as item_id, ti.product_id, ti.product_name,
      ti.quantity, ti.unit_price, ti.discount_amount, ti.tax_amount, ti.total_amount,
      ti.metadata, ti.created_at,
      p.sku, p.barcode, p.name as product_full_name, p.category_id,
      c.name as category_name
    FROM transaction_items ti
    LEFT JOIN products p ON ti.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE ti.transaction_id = $1
    ORDER BY ti.id
  `, [transactionId]);
  
  res.json({
    success: true,
    data: {
      transaction_id: transactionId,
      items: result.rows
    }
  });
}));

// POST /api/1c/transactions/:id/items - Add items to transaction
router.post('/:id/items', requirePermission('transactions:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const items = z.array(transactionItemSchema).parse(req.body);
  
  // Get transaction ID
  const transactionResult = await DatabaseManager.query(
    'SELECT id, status FROM transactions WHERE id = $1 OR onec_id = $1 OR transaction_number = $1',
    [id]
  );
  
  if (transactionResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found'
    });
  }
  
  const transaction = transactionResult.rows[0];
  
  if (transaction.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: 'Can only add items to pending transactions'
    });
  }
  
  await DatabaseManager.query('BEGIN');
  
  try {
    const results = [];
    
    for (const item of items) {
      // Find product if provided
      let productId = null;
      if (item.product_barcode || item.product_sku || item.product_id) {
        const productQuery = `
          SELECT id FROM products 
          WHERE id = $1 OR barcode = $1 OR sku = $1
        `;
        const productParam = item.product_id || item.product_barcode || item.product_sku;
        
        const productResult = await DatabaseManager.query(productQuery, [productParam]);
        if (productResult.rows.length > 0) {
          productId = productResult.rows[0].id;
        }
      }
      
      const itemResult = await DatabaseManager.query(`
        INSERT INTO transaction_items (
          transaction_id, product_id, product_name, quantity,
          unit_price, discount_amount, tax_amount, total_amount,
          metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
        ) RETURNING id
      `, [
        transaction.id, productId, item.product_name, item.quantity,
        item.unit_price, item.discount_amount, item.tax_amount, item.total_amount,
        JSON.stringify(item.metadata || {})
      ]);
      
      results.push({
        item_id: itemResult.rows[0].id,
        product_name: item.product_name,
        quantity: item.quantity,
        total_amount: item.total_amount
      });
    }
    
    // Recalculate transaction totals
    const totalsResult = await DatabaseManager.query(`
      SELECT 
        SUM(total_amount) as new_total,
        SUM(discount_amount) as new_discount,
        SUM(tax_amount) as new_tax
      FROM transaction_items
      WHERE transaction_id = $1
    `, [transaction.id]);
    
    const totals = totalsResult.rows[0];
    
    await DatabaseManager.query(`
      UPDATE transactions 
      SET 
        subtotal_amount = $1 - $2 - $3,
        discount_amount = $2,
        tax_amount = $3,
        total_amount = $1,
        updated_at = NOW()
      WHERE id = $4
    `, [totals.new_total, totals.new_discount, totals.new_tax, transaction.id]);
    
    await DatabaseManager.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: {
        message: 'Items added successfully',
        transaction_id: transaction.id,
        items_added: results.length,
        new_total: totals.new_total,
        items: results
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    throw error;
  }
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
