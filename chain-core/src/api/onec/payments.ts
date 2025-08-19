import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const paymentSchema = z.object({
  transaction_number: z.string().optional(),
  transaction_id: z.string().optional(),
  onec_transaction_id: z.string().optional(),
  branch_code: z.string().min(1),
  payment_method: z.enum(['cash', 'card', 'mobile_payment', 'bank_transfer', 'loyalty_points', 'gift_card']),
  amount: z.number().positive(),
  currency: z.string().default('UZS'),
  card_type: z.string().optional(),
  card_last_four: z.string().optional(),
  reference_number: z.string().optional(),
  processor_response: z.record(z.any()).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled', 'refunded']).default('completed'),
  processed_at: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// ============================================================================
// PAYMENTS MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/payments - Get all payments
router.get('/', requirePermission('transactions:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 100, 
    branch_code,
    payment_method,
    status,
    start_date,
    end_date,
    min_amount,
    max_amount,
    transaction_id
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      p.id, p.payment_method, p.amount, p.currency, p.card_type, p.card_last_four,
      p.reference_number, p.status, p.processed_at, p.notes, p.metadata,
      p.created_at, p.updated_at,
      t.transaction_number, t.total_amount as transaction_total,
      b.code as branch_code, b.name as branch_name,
      e.employee_id, e.name as employee_name
    FROM payments p
    LEFT JOIN transactions t ON p.transaction_id = t.id
    LEFT JOIN branches b ON t.branch_id = b.id
    LEFT JOIN employees e ON t.employee_id = e.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (payment_method) {
    params.push(payment_method);
    query += ` AND p.payment_method = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND p.status = $${params.length}`;
  }
  
  if (transaction_id) {
    params.push(transaction_id);
    query += ` AND (t.id = $${params.length} OR t.transaction_number = $${params.length} OR t.onec_id = $${params.length})`;
  }
  
  if (start_date) {
    params.push(start_date);
    query += ` AND p.processed_at >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND p.processed_at <= $${params.length}`;
  }
  
  if (min_amount) {
    params.push(Number(min_amount));
    query += ` AND p.amount >= $${params.length}`;
  }
  
  if (max_amount) {
    params.push(Number(max_amount));
    query += ` AND p.amount <= $${params.length}`;
  }
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY p.processed_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      payments: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/payments/:id - Get specific payment
router.get('/:id', requirePermission('transactions:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      p.id, p.payment_method, p.amount, p.currency, p.card_type, p.card_last_four,
      p.reference_number, p.processor_response, p.status, p.processed_at, 
      p.notes, p.metadata, p.created_at, p.updated_at,
      t.id as transaction_id, t.transaction_number, t.total_amount as transaction_total,
      b.code as branch_code, b.name as branch_name,
      e.employee_id, e.name as employee_name
    FROM payments p
    LEFT JOIN transactions t ON p.transaction_id = t.id
    LEFT JOIN branches b ON t.branch_id = b.id
    LEFT JOIN employees e ON t.employee_id = e.id
    WHERE p.id = $1 OR p.reference_number = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      payment: result.rows[0]
    }
  });
}));

// POST /api/1c/payments - Import payment records
router.post('/', requirePermission('transactions:write'), asyncHandler(async (req: Request, res: Response) => {
  const payments = z.array(paymentSchema).parse(req.body);
  
  const syncId = await createSyncLog('payments', 'import', payments.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const paymentData of payments) {
      try {
        // Find transaction
        let transactionId = null;
        
        if (paymentData.transaction_id) {
          const transactionResult = await DatabaseManager.query(
            'SELECT id FROM transactions WHERE id = $1',
            [paymentData.transaction_id]
          );
          if (transactionResult.rows.length > 0) {
            transactionId = transactionResult.rows[0].id;
          }
        }
        
        if (!transactionId && paymentData.transaction_number) {
          const branchResult = await DatabaseManager.query(
            'SELECT id FROM branches WHERE code = $1',
            [paymentData.branch_code]
          );
          
          if (branchResult.rows.length > 0) {
            const transactionResult = await DatabaseManager.query(
              'SELECT id FROM transactions WHERE transaction_number = $1 AND branch_id = $2',
              [paymentData.transaction_number, branchResult.rows[0].id]
            );
            if (transactionResult.rows.length > 0) {
              transactionId = transactionResult.rows[0].id;
            }
          }
        }
        
        if (!transactionId && paymentData.onec_transaction_id) {
          const transactionResult = await DatabaseManager.query(
            'SELECT id FROM transactions WHERE onec_id = $1',
            [paymentData.onec_transaction_id]
          );
          if (transactionResult.rows.length > 0) {
            transactionId = transactionResult.rows[0].id;
          }
        }
        
        if (!transactionId) {
          throw new Error('Transaction not found');
        }
        
        // Check if payment already exists
        const existingResult = await DatabaseManager.query(
          'SELECT id FROM payments WHERE transaction_id = $1 AND payment_method = $2 AND amount = $3',
          [transactionId, paymentData.payment_method, paymentData.amount]
        );
        
        let paymentId;
        if (existingResult.rows.length > 0) {
          // Update existing payment
          paymentId = existingResult.rows[0].id;
          await DatabaseManager.query(`
            UPDATE payments SET
              payment_method = $1,
              amount = $2,
              currency = $3,
              card_type = $4,
              card_last_four = $5,
              reference_number = $6,
              processor_response = $7,
              status = $8,
              processed_at = $9,
              notes = $10,
              metadata = $11,
              updated_at = NOW()
            WHERE id = $12
          `, [
            paymentData.payment_method, paymentData.amount, paymentData.currency,
            paymentData.card_type, paymentData.card_last_four, paymentData.reference_number,
            JSON.stringify(paymentData.processor_response || {}), paymentData.status,
            paymentData.processed_at || new Date().toISOString(), paymentData.notes,
            JSON.stringify(paymentData.metadata || {}), paymentId
          ]);
        } else {
          // Create new payment
          const insertResult = await DatabaseManager.query(`
            INSERT INTO payments (
              transaction_id, payment_method, amount, currency, card_type, card_last_four,
              reference_number, processor_response, status, processed_at, notes, metadata,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
            ) RETURNING id
          `, [
            transactionId, paymentData.payment_method, paymentData.amount, paymentData.currency,
            paymentData.card_type, paymentData.card_last_four, paymentData.reference_number,
            JSON.stringify(paymentData.processor_response || {}), paymentData.status,
            paymentData.processed_at || new Date().toISOString(), paymentData.notes,
            JSON.stringify(paymentData.metadata || {})
          ]);
          paymentId = insertResult.rows[0].id;
        }
        
        results.push({
          transaction_number: paymentData.transaction_number,
          payment_method: paymentData.payment_method,
          amount: paymentData.amount,
          success: true,
          action: existingResult.rows.length > 0 ? 'updated' : 'created',
          payment_id: paymentId
        });
        
      } catch (error) {
        results.push({
          transaction_number: paymentData.transaction_number,
          payment_method: paymentData.payment_method,
          amount: paymentData.amount,
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

// GET /api/1c/payments/methods - Get payment methods summary
router.get('/methods', requirePermission('transactions:read'), asyncHandler(async (req: Request, res: Response) => {
  const { branch_code, start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      p.payment_method,
      COUNT(*) as transaction_count,
      SUM(p.amount) as total_amount,
      AVG(p.amount) as average_amount,
      MIN(p.amount) as min_amount,
      MAX(p.amount) as max_amount
    FROM payments p
    LEFT JOIN transactions t ON p.transaction_id = t.id
    LEFT JOIN branches b ON t.branch_id = b.id
    WHERE p.status = 'completed'
  `;
  
  const params: any[] = [];
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (start_date) {
    params.push(start_date);
    query += ` AND p.processed_at >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND p.processed_at <= $${params.length}`;
  }
  
  query += ` GROUP BY p.payment_method ORDER BY total_amount DESC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      payment_methods: result.rows
    }
  });
}));

// GET /api/1c/payments/summary - Get payments summary by branch
router.get('/summary', requirePermission('transactions:read'), asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      b.code as branch_code,
      b.name as branch_name,
      COUNT(p.id) as total_payments,
      SUM(p.amount) as total_amount,
      COUNT(CASE WHEN p.payment_method = 'cash' THEN 1 END) as cash_payments,
      SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) as cash_amount,
      COUNT(CASE WHEN p.payment_method = 'card' THEN 1 END) as card_payments,
      SUM(CASE WHEN p.payment_method = 'card' THEN p.amount ELSE 0 END) as card_amount,
      COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments,
      COUNT(CASE WHEN p.status = 'refunded' THEN 1 END) as refunded_payments
    FROM branches b
    LEFT JOIN transactions t ON b.id = t.branch_id
    LEFT JOIN payments p ON t.id = p.transaction_id
    WHERE b.is_active = true
  `;
  
  const params: any[] = [];
  
  if (start_date) {
    params.push(start_date);
    query += ` AND p.processed_at >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND p.processed_at <= $${params.length}`;
  }
  
  query += ` GROUP BY b.id, b.code, b.name ORDER BY total_amount DESC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      payment_summary: result.rows
    }
  });
}));

// PUT /api/1c/payments/:id/status - Update payment status
router.put('/:id/status', requirePermission('transactions:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes } = z.object({
    status: z.enum(['pending', 'completed', 'failed', 'cancelled', 'refunded']),
    notes: z.string().optional()
  }).parse(req.body);
  
  const result = await DatabaseManager.query(`
    UPDATE payments 
    SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
    WHERE id = $3 OR reference_number = $3
    RETURNING id, payment_method, amount, status
  `, [status, notes, id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: 'Payment status updated successfully',
      payment_id: result.rows[0].id,
      payment_method: result.rows[0].payment_method,
      amount: result.rows[0].amount,
      new_status: result.rows[0].status
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
