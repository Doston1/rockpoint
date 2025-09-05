import { ClickPassService } from '@/services/ClickPassService';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// =================================================================
// VALIDATION SCHEMAS
// =================================================================

const createClickPassPaymentSchema = z.object({
  amount_uzs: z.number()
    .min(0.01, 'Amount must be greater than 0')
    .max(999999999, 'Amount too large'),
  otp_data: z.string()
    .min(10, 'QR code data must be at least 10 characters')
    .max(500, 'QR code data too long'),
  employee_id: z.string()
    .min(1, 'Employee ID is required'),
  terminal_id: z.string()
    .min(1, 'Terminal ID is required'),
  pos_transaction_id: z.string()
    .min(1, 'Transaction ID must not be empty')
    .optional(),
  cashbox_code: z.string().optional()
});

const confirmPaymentSchema = z.object({
  action: z.enum(['confirm', 'reject']),
  employee_id: z.string().min(1, 'Employee ID is required')
});

const reversalSchema = z.object({
  reason: z.string()
    .min(1, 'Reversal reason is required')
    .max(500, 'Reason too long'),
  requested_by: z.string()
    .min(1, 'Employee ID is required'),
  reversal_amount: z.number().min(0.01).optional()
});

const listPaymentsSchema = z.object({
  status: z.enum(['pending', 'processing', 'success', 'failed', 'cancelled', 'confirmed', 'rejected']).optional(),
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
 * POST /api/payments/click-pass
 * Create a new Click Pass payment
 * 
 * This endpoint is called by the POS when a QR code is scanned.
 * It validates the QR data, creates a payment request to Click,
 * and returns the result immediately.
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔄 Click Pass payment request received:', {
    body: { ...req.body, otp_data: '[MASKED]' },
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for']
    }
  });

  // Validate request body
  const validatedData = createClickPassPaymentSchema.parse(req.body);
  
  const startTime = Date.now();
  
  try {
    // Create Click Pass payment
    const result = await ClickPassService.createPayment({
      amount_uzs: validatedData.amount_uzs,
      otp_data: validatedData.otp_data,
      employee_id: validatedData.employee_id,
      terminal_id: validatedData.terminal_id,
      pos_transaction_id: validatedData.pos_transaction_id,
      cashbox_code: validatedData.cashbox_code
    });

    const processingTime = Date.now() - startTime;
    
    console.log('✅ Click Pass payment result:', {
      success: result.success,
      order_id: result.data?.order_id,
      status: result.data?.status,
      click_trans_id: result.data?.click_trans_id,
      processing_time_ms: processingTime
    });

    // Log successful payment
    if (result.success && result.data) {
      console.log('📊 Click Pass payment completed:', {
        click_transaction_id: result.data.click_transaction_id,
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
    console.error('❌ Click Pass payment creation failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing the payment',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/payments/click-pass/:id/confirm
 * Confirm or reject a Click Pass payment
 * 
 * Some Click Pass payments may require manual confirmation.
 */
router.put('/:id/confirm', asyncHandler(async (req: Request, res: Response) => {
  const clickTransactionId = req.params.id;
  const { action, employee_id } = confirmPaymentSchema.parse(req.body);

  console.log('🔄 Click Pass payment confirmation:', {
    click_transaction_id: clickTransactionId,
    action,
    employee_id
  });

  try {
    const result = await ClickPassService.confirmPayment(clickTransactionId, action, employee_id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: `Payment ${action}ed successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Confirmation failed',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ Click Pass payment confirmation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to confirm payment',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/payments/click-pass/:orderId/reverse
 * Cancel/reverse a Click Pass payment
 * 
 * Cancels a successful payment. orderId is the order_id from the original payment.
 */
router.put('/:orderId/reverse', asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.orderId;
  const { reason, requested_by, reversal_amount } = reversalSchema.parse(req.body);

  console.log('🔄 Click Pass reversal request:', {
    order_id: orderId,
    reason,
    requested_by,
    reversal_amount
  });

  try {
    const result = await ClickPassService.reversePayment(orderId, reason, requested_by, reversal_amount);

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
    console.error('❌ Click Pass reversal failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to reverse payment',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/click-pass/:id/status
 * Check payment status from Click
 * 
 * Queries Click directly for the latest payment status.
 */
router.get('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const clickTransactionId = req.params.id;

  try {
    const result = await ClickPassService.checkPaymentStatus(clickTransactionId);

    if (result.success) {
      res.json({
        success: true,
        data: {
          status: result.status,
          payment_status: result.payment_status
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
    console.error('❌ Click Pass status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to check payment status',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/click-pass/:id
 * Get Click Pass transaction details
 * 
 * Returns comprehensive transaction information from our database.
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const clickTransactionId = req.params.id;

  try {
    const transaction = await ClickPassService.getTransaction(clickTransactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        message: 'The specified Click Pass transaction does not exist',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: transaction,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to get Click Pass transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve transaction details',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/click-pass
 * List Click Pass transactions with filtering and pagination
 * 
 * Supports filtering by status, employee, terminal, date range, etc.
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const filters = listPaymentsSchema.parse(req.query);

  try {
    const result = await ClickPassService.getTransactions({
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
    console.error('❌ Failed to list Click Pass transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve transactions list',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/payments/click-pass/:id/link-transaction
 * Link Click Pass payment to a POS transaction
 * 
 * Used to associate a successful Click Pass payment with a POS transaction
 * for receipt generation and inventory management.
 */
router.post('/:id/link-transaction', asyncHandler(async (req: Request, res: Response) => {
  const clickTransactionId = req.params.id;
  const { pos_transaction_id } = z.object({
    pos_transaction_id: z.string().uuid()
  }).parse(req.body);

  console.log('🔗 Linking Click Pass to POS transaction:', {
    click_transaction_id: clickTransactionId,
    pos_transaction_id
  });

  try {
    // Update the Click Pass transaction with POS transaction ID
    const updateResult = await DatabaseManager.query(
      'UPDATE click_pass_transactions SET pos_transaction_id = $1 WHERE id = $2 AND status = $3',
      [pos_transaction_id, clickTransactionId, 'success']
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
        message: 'Click Pass transaction not found or not successful',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Click Pass transaction linked to POS transaction successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to link Click Pass to POS transaction:', error);
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
