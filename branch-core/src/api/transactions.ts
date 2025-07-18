import { DatabaseManager } from '@/database/manager';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { businessLogger } from '@/middleware/logger';
import { RedisManager } from '@/services/redis';
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createTransactionSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  customerId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0)
  })).min(1, 'At least one item is required')
});

const paymentSchema = z.object({
  method: z.enum(['cash', 'card', 'digital_wallet', 'store_credit']),
  amount: z.number().min(0),
  reference: z.string().optional(),
  cardLast4: z.string().optional(),
  changeGiven: z.number().optional()
});

// POST /api/transactions
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { terminalId, employeeId, customerId, items } = createTransactionSchema.parse(req.body);

  const transactionId = uuidv4();
  
  // Calculate totals
  let subtotal = 0;
  const processedItems: any[] = [];

  for (const item of items) {
    const itemTotal = item.quantity * item.unitPrice;
    subtotal += itemTotal;
    
    processedItems.push({
      ...item,
      total: itemTotal
    });
  }

  const tax = subtotal * 0.1; // 10% tax rate - should be configurable
  const total = subtotal + tax;

  await DatabaseManager.transaction(async (client) => {
    // Create transaction record
    const transactionQuery = `
      INSERT INTO transactions 
      (id, terminal_id, employee_id, customer_id, subtotal, tax_amount, total_amount, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
      RETURNING *
    `;

    await client.query(transactionQuery, [
      transactionId, terminalId, employeeId, customerId, subtotal, tax, total
    ]);

    // Create transaction items
    for (const item of processedItems) {
      const itemQuery = `
        INSERT INTO transaction_items 
        (transaction_id, product_id, quantity, unit_price, total_price, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `;

      await client.query(itemQuery, [
        transactionId, item.productId, item.quantity, item.unitPrice, item.total
      ]);
    }

    // Update product stock
    for (const item of items) {
      await client.query(
        'UPDATE products SET quantity_in_stock = quantity_in_stock - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );

      // Log stock movement
      await client.query(
        `INSERT INTO stock_movements 
         (product_id, change_quantity, operation, reason, transaction_id, created_at)
         VALUES ($1, $2, 'subtract', 'sale', $3, NOW())`,
        [item.productId, item.quantity, transactionId]
      );
    }
  });

  businessLogger.transaction.start(transactionId, terminalId, employeeId);

  res.json({
    success: true,
    data: {
      transactionId,
      subtotal,
      tax,
      total,
      status: 'pending',
      items: processedItems
    }
  });
}));

// POST /api/transactions/:id/payment
router.post('/:id/payment', asyncHandler(async (req: Request, res: Response) => {
  const transactionId = req.params.id;
  const payment = paymentSchema.parse(req.body);

  await DatabaseManager.transaction(async (client) => {
    // Get transaction details
    const transactionQuery = 'SELECT * FROM transactions WHERE id = $1 AND status = $2';
    const transactionResult = await client.query(transactionQuery, [transactionId, 'pending']);
    const transaction = transactionResult.rows[0];

    if (!transaction) {
      throw createError('Transaction not found or already completed', 404);
    }

    if (payment.amount < transaction.total_amount) {
      throw createError('Payment amount is insufficient', 400);
    }

    // Record payment
    const paymentQuery = `
      INSERT INTO payments 
      (transaction_id, method, amount, reference, card_last4, change_given, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const changeGiven = payment.method === 'cash' ? payment.amount - transaction.total_amount : 0;

    await client.query(paymentQuery, [
      transactionId,
      payment.method,
      payment.amount,
      payment.reference,
      payment.cardLast4,
      changeGiven
    ]);

    // Update transaction status
    await client.query(
      'UPDATE transactions SET status = $1, completed_at = NOW() WHERE id = $2',
      ['completed', transactionId]
    );
  });

  businessLogger.transaction.complete(transactionId, payment.amount, payment.method);

  res.json({
    success: true,
    data: {
      transactionId,
      status: 'completed',
      paymentMethod: payment.method,
      amountPaid: payment.amount,
      changeGiven: payment.method === 'cash' ? payment.amount - (await getTransactionTotal(transactionId)) : 0
    }
  });
}));

// GET /api/transactions/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const transactionId = req.params.id;

  const transactionQuery = `
    SELECT 
      t.*,
      e.name as employee_name,
      e.employee_id,
      c.name as customer_name
    FROM transactions t
    LEFT JOIN employees e ON t.employee_id = e.employee_id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.id = $1
  `;

  const itemsQuery = `
    SELECT 
      ti.*,
      p.name as product_name,
      p.barcode
    FROM transaction_items ti
    JOIN products p ON ti.product_id = p.id
    WHERE ti.transaction_id = $1
    ORDER BY ti.created_at
  `;

  const paymentsQuery = `
    SELECT * FROM payments 
    WHERE transaction_id = $1 
    ORDER BY created_at
  `;

  const [transactionResult, itemsResult, paymentsResult] = await Promise.all([
    DatabaseManager.query(transactionQuery, [transactionId]),
    DatabaseManager.query(itemsQuery, [transactionId]),
    DatabaseManager.query(paymentsQuery, [transactionId])
  ]);

  const transaction = transactionResult.rows[0];
  if (!transaction) {
    throw createError('Transaction not found', 404);
  }

  res.json({
    success: true,
    data: {
      transaction,
      items: itemsResult.rows,
      payments: paymentsResult.rows
    }
  });
}));

// POST /api/transactions/:id/void
router.post('/:id/void', asyncHandler(async (req: Request, res: Response) => {
  const transactionId = req.params.id;
  const { reason, employeeId } = req.body;

  if (!reason || !employeeId) {
    throw createError('Reason and employee ID are required for voiding transactions', 400);
  }

  await DatabaseManager.transaction(async (client) => {
    // Get transaction details
    const transactionQuery = 'SELECT * FROM transactions WHERE id = $1';
    const transactionResult = await client.query(transactionQuery, [transactionId]);
    const transaction = transactionResult.rows[0];

    if (!transaction) {
      throw createError('Transaction not found', 404);
    }

    if (transaction.status === 'voided') {
      throw createError('Transaction is already voided', 400);
    }

    // Get transaction items to restore stock
    const itemsQuery = 'SELECT * FROM transaction_items WHERE transaction_id = $1';
    const itemsResult = await client.query(itemsQuery, [transactionId]);

    // Restore stock for each item
    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET quantity_in_stock = quantity_in_stock + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );

      // Log stock movement
      await client.query(
        `INSERT INTO stock_movements 
         (product_id, change_quantity, operation, reason, transaction_id, created_at)
         VALUES ($1, $2, 'add', 'void_transaction', $3, NOW())`,
        [item.product_id, item.quantity, transactionId]
      );
    }

    // Update transaction status
    await client.query(
      'UPDATE transactions SET status = $1, voided_at = NOW(), void_reason = $2, voided_by = $3 WHERE id = $4',
      ['voided', reason, employeeId, transactionId]
    );
  });

  businessLogger.transaction.void(transactionId, reason, employeeId);

  res.json({
    success: true,
    message: 'Transaction voided successfully'
  });
}));

// GET /api/transactions
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status as string;
  const employeeId = req.query.employeeId as string;
  const terminalId = req.query.terminalId as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;

  if (status) {
    whereConditions.push(`t.status = $${paramIndex++}`);
    queryParams.push(status);
  }

  if (employeeId) {
    whereConditions.push(`t.employee_id = $${paramIndex++}`);
    queryParams.push(employeeId);
  }

  if (terminalId) {
    whereConditions.push(`t.terminal_id = $${paramIndex++}`);
    queryParams.push(terminalId);
  }

  if (startDate) {
    whereConditions.push(`t.created_at >= $${paramIndex++}`);
    queryParams.push(startDate);
  }

  if (endDate) {
    whereConditions.push(`t.created_at <= $${paramIndex++}`);
    queryParams.push(endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const transactionsQuery = `
    SELECT 
      t.*,
      e.name as employee_name,
      e.employee_id as employee_code,
      COUNT(ti.id) as item_count
    FROM transactions t
    LEFT JOIN employees e ON t.employee_id = e.employee_id
    LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
    ${whereClause}
    GROUP BY t.id, e.name, e.employee_id
    ORDER BY t.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  queryParams.push(limit, offset);

  const result = await DatabaseManager.query(transactionsQuery, queryParams);

  res.json({
    success: true,
    data: {
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total: result.rowCount
      }
    }
  });
}));

// Helper function to get transaction total
async function getTransactionTotal(transactionId: string): Promise<number> {
  const result = await DatabaseManager.query(
    'SELECT total_amount FROM transactions WHERE id = $1',
    [transactionId]
  );
  return result.rows[0]?.total_amount || 0;
}

export default router;
