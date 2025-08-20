import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { asyncHandler, createError } from '../../middleware/errorHandler';
import { businessLogger } from '../../middleware/logger';
import { FastPayService } from '../../services/FastPayService';

const router = Router();

// =================================================================
// VALIDATION SCHEMAS
// =================================================================

const createFastPayPaymentSchema = z.object({
  amount_uzs: z.number()
    .min(0.01, 'Amount must be greater than 0')
    .max(999999999, 'Amount too large'),
  otp_data: z.string()
    .min(40, 'QR code data must be at least 40 characters')
    .max(500, 'QR code data too long'),
  employee_id: z.string()
    .min(1, 'Employee ID is required'),
  terminal_id: z.string()
    .min(1, 'Terminal ID is required'),
  pos_transaction_id: z.string()
    .uuid('Invalid transaction ID format')
    .optional()
});

const fiscalizationSchema = z.object({
  fiscal_url: z.string()
    .url('Invalid fiscal URL format')
    .max(1000, 'Fiscal URL too long')
});

const reversalSchema = z.object({
  reason: z.string()
    .min(1, 'Reversal reason is required')
    .max(500, 'Reason too long'),
  requested_by: z.string()
    .min(1, 'Employee ID is required')
});

const listPaymentsSchema = z.object({
  status: z.enum(['pending', 'processing', 'success', 'failed', 'cancelled', 'reversed']).optional(),
  employee_id: z.string().optional(),
  terminal_id: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

// =================================================================
// ROUTE HANDLERS
// =================================================================

/**
 * POST /api/payments/fastpay
 * Create a new FastPay payment
 * 
 * This endpoint is called by the POS when a QR code is scanned.
 * It validates the QR data, creates a payment request to Uzum Bank,
 * and returns the result immediately.
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔄 FastPay payment request received:', {
    body: { ...req.body, otp_data: '[MASKED]' },
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for']
    }
  });

  // Validate request body
  const validatedData = createFastPayPaymentSchema.parse(req.body);
  
  const startTime = Date.now();
  
  try {
    // Create FastPay payment
    const result = await FastPayService.createPayment({
      amount_uzs: validatedData.amount_uzs,
      otp_data: validatedData.otp_data,
      employee_id: validatedData.employee_id,
      terminal_id: validatedData.terminal_id,
      pos_transaction_id: validatedData.pos_transaction_id
    });

    const processingTime = Date.now() - startTime;
    
    console.log('✅ FastPay payment result:', {
      success: result.success,
      order_id: result.data?.order_id,
      status: result.data?.status,
      error_code: result.data?.error_code,
      processing_time_ms: processingTime
    });

    // Log to business logger
    if (result.success && result.data) {
      console.log('📊 FastPay payment completed:', {
        fastpay_transaction_id: result.data.fastpay_transaction_id,
        order_id: result.data.order_id,
        amount_uzs: validatedData.amount_uzs,
        terminal_id: validatedData.terminal_id,
        employee_id: validatedData.employee_id
      });
    }

    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        message: 'Payment processed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      // Return error but with 200 status (business logic error, not HTTP error)
      res.status(200).json({
        success: false,
        error: result.error,
        message: result.message,
        data: result.data || null,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ FastPay payment creation failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing the payment',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/payments/fastpay/:id/fiscalize
 * Submit fiscal receipt URL to Uzum Bank
 * 
 * Called after a successful payment to provide the fiscal receipt link.
 */
router.post('/:id/fiscalize', asyncHandler(async (req: Request, res: Response) => {
  const fastpayTransactionId = req.params.id;
  const { fiscal_url } = fiscalizationSchema.parse(req.body);

  console.log('🧾 FastPay fiscalization request:', {
    fastpay_transaction_id: fastpayTransactionId,
    fiscal_url
  });

  try {
    const result = await FastPayService.submitFiscalization(fastpayTransactionId, fiscal_url);

    if (result.success) {
      res.json({
        success: true,
        message: 'Fiscal receipt submitted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Fiscalization failed',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ FastPay fiscalization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to submit fiscal receipt',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/payments/fastpay/:orderId/reverse
 * Cancel/reverse a FastPay payment
 * 
 * Cancels a successful payment. orderId is the order_id from the original payment.
 */
router.put('/:orderId/reverse', asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.orderId;
  const { reason, requested_by } = reversalSchema.parse(req.body);

  console.log('🔄 FastPay reversal request:', {
    order_id: orderId,
    reason,
    requested_by
  });

  try {
    const result = await FastPayService.reversePayment(orderId, reason, requested_by);

    if (result.success) {
      res.json({
        success: true,
        message: 'Payment reversed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Reversal failed',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ FastPay reversal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to reverse payment',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/fastpay/:id/status
 * Check payment status from Uzum Bank
 * 
 * Queries Uzum Bank directly for the latest payment status.
 */
router.get('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const fastpayTransactionId = req.params.id;

  try {
    const result = await FastPayService.checkPaymentStatus(fastpayTransactionId);

    if (result.success) {
      res.json({
        success: true,
        data: {
          status: result.status
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Status check failed',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ FastPay status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to check payment status',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/fastpay/:id
 * Get FastPay transaction details
 * 
 * Returns comprehensive transaction information from our database.
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const fastpayTransactionId = req.params.id;

  try {
    const transaction = await FastPayService.getTransaction(fastpayTransactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        message: 'The specified FastPay transaction does not exist',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: transaction,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to get FastPay transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve transaction details',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/fastpay
 * List FastPay transactions with filtering and pagination
 * 
 * Supports filtering by status, employee, terminal, date range, etc.
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const filters = listPaymentsSchema.parse(req.query);

  try {
    const result = await FastPayService.getTransactions({
      status: filters.status,
      employeeId: filters.employee_id,
      terminalId: filters.terminal_id,
      startDate: filters.start_date,
      endDate: filters.end_date,
      page: filters.page,
      limit: filters.limit
    });

    res.json({
      success: true,
      data: {
        transactions: result.transactions,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit)
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to list FastPay transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve transactions list',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/payments/fastpay/:id/link-transaction
 * Link FastPay payment to a POS transaction
 * 
 * Used to associate a successful FastPay payment with a POS transaction
 * for receipt generation and inventory management.
 */
router.post('/:id/link-transaction', asyncHandler(async (req: Request, res: Response) => {
  const fastpayTransactionId = req.params.id;
  const { pos_transaction_id } = z.object({
    pos_transaction_id: z.string().uuid()
  }).parse(req.body);

  console.log('🔗 Linking FastPay to POS transaction:', {
    fastpay_transaction_id: fastpayTransactionId,
    pos_transaction_id
  });

  try {
    // Update the FastPay transaction with POS transaction ID
    const updateResult = await DatabaseManager.query(
      'UPDATE uzum_fastpay_transactions SET pos_transaction_id = $1 WHERE id = $2 AND status = $3',
      [pos_transaction_id, fastpayTransactionId, 'success']
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        message: 'FastPay transaction not found or not successful',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'FastPay transaction linked to POS transaction successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to link FastPay to POS transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to link transactions',
      timestamp: new Date().toISOString()
    });
  }
}));

// =================================================================
// ERROR HANDLING
// =================================================================

// Handle validation errors
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: 'Invalid request data',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      })),
      timestamp: new Date().toISOString()
    });
  }
  next(error);
});

export default router;
