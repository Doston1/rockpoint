import { PaymeQRService } from '@/services/PaymeQRService';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// =================================================================
// VALIDATION SCHEMAS
// =================================================================

const createPaymeQRReceiptSchema = z.object({
  amount_uzs: z.number()
    .min(0.01, 'Amount must be greater than 0')
    .max(999999999, 'Amount too large'),
  employee_id: z.string()
    .min(1, 'Employee ID is required'),
  terminal_id: z.string()
    .min(1, 'Terminal ID is required'),
  pos_transaction_id: z.string()
    .min(1, 'Transaction ID must not be empty')
    .optional(),
  description: z.string().max(500).optional(),
  account_data: z.record(z.string(), z.any()).optional()
});

const submitFiscalDataSchema = z.object({
  fiscal_data: z.object({
    fiscal_url: z.string().url(),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
      total: z.number()
    })).optional()
  })
});

const cancelReceiptSchema = z.object({
  reason: z.string()
    .min(1, 'Cancellation reason is required')
    .max(500, 'Reason too long'),
  requested_by: z.string()
    .min(1, 'Employee ID is required')
});

const listReceiptsSchema = z.object({
  status: z.enum(['created', 'waiting_for_payment', 'paid', 'cancelled', 'error', 'expired']).optional(),
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
 * POST /api/payments/payme-qr
 * Create a new Payme QR receipt/payment
 * 
 * This endpoint creates a Payme QR code for the customer to scan and pay.
 * Returns QR code data and payment URL for customer use.
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔄 Payme QR receipt creation request received:', {
    body: { ...req.body },
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for']
    }
  });

  // Validate request body
  const validatedData = createPaymeQRReceiptSchema.parse(req.body);
  
  const startTime = Date.now();
  
  try {
    // Create Payme QR receipt
    const result = await PaymeQRService.createReceipt({
      amount_uzs: validatedData.amount_uzs,
      employee_id: validatedData.employee_id,
      terminal_id: validatedData.terminal_id,
      pos_transaction_id: validatedData.pos_transaction_id,
      description: validatedData.description,
      account_data: validatedData.account_data
    });

    const processingTime = Date.now() - startTime;
    
    console.log('✅ Payme QR receipt result:', {
      success: result.success,
      order_id: result.data?.order_id,
      receipt_id: result.data?.receipt_id,
      status: result.data?.status,
      processing_time_ms: processingTime
    });

    // Log successful receipt creation
    if (result.success && result.data) {
      console.log('📊 Payme QR receipt created:', {
        payme_receipt_id: result.data.payme_receipt_id,
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
        message: 'QR receipt created successfully',
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
    console.error('❌ Payme QR receipt creation failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred while creating the QR receipt',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/payme-qr/:id/status
 * Check receipt status from Payme
 * 
 * Polls Payme for the latest receipt status and payment information.
 */
router.get('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const paymeReceiptId = req.params.id;

  try {
    const result = await PaymeQRService.checkReceiptStatus(paymeReceiptId);

    if (result.success) {
      res.json({
        success: true,
        data: {
          status: result.status,
          payme_state: result.payme_state,
          payment_info: result.payment_info
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
    console.error('❌ Payme QR status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to check receipt status',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/payments/payme-qr/:id/fiscal
 * Submit fiscal receipt data to Payme
 * 
 * Called after a successful payment to provide fiscal receipt information.
 */
router.post('/:id/fiscal', asyncHandler(async (req: Request, res: Response) => {
  const paymeReceiptId = req.params.id;
  const { fiscal_data } = submitFiscalDataSchema.parse(req.body);

  console.log('🧾 Payme QR fiscal data submission:', {
    payme_receipt_id: paymeReceiptId,
    fiscal_url: fiscal_data.fiscal_url
  });

  try {
    const result = await PaymeQRService.submitFiscalData(paymeReceiptId, fiscal_data);

    if (result.success) {
      res.json({
        success: true,
        message: 'Fiscal data submitted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Fiscal data submission failed',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ Payme QR fiscal data submission failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to submit fiscal data',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/payments/payme-qr/:id/cancel
 * Cancel a Payme QR receipt
 * 
 * Cancels a pending or active receipt before payment is completed.
 */
router.put('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const paymeReceiptId = req.params.id;
  const { reason, requested_by } = cancelReceiptSchema.parse(req.body);

  console.log('🔄 Payme QR receipt cancellation:', {
    payme_receipt_id: paymeReceiptId,
    reason,
    requested_by
  });

  try {
    const result = await PaymeQRService.cancelReceipt(paymeReceiptId, reason, requested_by);

    if (result.success) {
      res.json({
        success: true,
        message: 'Receipt cancelled successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Cancellation failed',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ Payme QR receipt cancellation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to cancel receipt',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/payme-qr/:id
 * Get Payme QR receipt details
 * 
 * Returns comprehensive receipt information from our database.
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const paymeReceiptId = req.params.id;

  try {
    const receipt = await PaymeQRService.getReceipt(paymeReceiptId);

    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Receipt not found',
        message: 'The specified Payme QR receipt does not exist',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: receipt,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to get Payme QR receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve receipt details',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payments/payme-qr
 * List Payme QR receipts with filtering and pagination
 * 
 * Supports filtering by status, employee, terminal, date range, etc.
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const filters = listReceiptsSchema.parse(req.query);

  try {
    const result = await PaymeQRService.getReceipts({
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
        receipts: result.receipts,
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
    console.error('❌ Failed to list Payme QR receipts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve receipts list',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/payments/payme-qr/:id/link-transaction
 * Link Payme QR receipt to a POS transaction
 * 
 * Used to associate a successful Payme payment with a POS transaction
 * for receipt generation and inventory management.
 */
router.post('/:id/link-transaction', asyncHandler(async (req: Request, res: Response) => {
  const paymeReceiptId = req.params.id;
  const { pos_transaction_id } = z.object({
    pos_transaction_id: z.string().uuid()
  }).parse(req.body);

  console.log('🔗 Linking Payme QR to POS transaction:', {
    payme_receipt_id: paymeReceiptId,
    pos_transaction_id
  });

  try {
    // Update the Payme QR receipt with POS transaction ID
    const updateResult = await DatabaseManager.query(
      'UPDATE payme_qr_receipts SET pos_transaction_id = $1 WHERE id = $2 AND status = $3',
      [pos_transaction_id, paymeReceiptId, 'paid']
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Receipt not found',
        message: 'Payme QR receipt not found or not paid',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Payme QR receipt linked to POS transaction successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to link Payme QR to POS transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to link transactions',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/payments/payme-qr/:id/poll-status
 * Start status polling for a receipt
 * 
 * Initiates automated status checking for payment completion.
 */
router.post('/:id/poll-status', asyncHandler(async (req: Request, res: Response) => {
  const paymeReceiptId = req.params.id;

  console.log('🔄 Starting Payme QR status polling:', {
    payme_receipt_id: paymeReceiptId
  });

  try {
    const result = await PaymeQRService.startStatusPolling(paymeReceiptId);

    if (result.success) {
      res.json({
        success: true,
        data: {
          polling_started: true,
          check_interval_ms: result.interval_ms
        },
        message: 'Status polling started successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to start polling',
        message: result.error,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    console.error('❌ Failed to start Payme QR status polling:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to start status polling',
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
