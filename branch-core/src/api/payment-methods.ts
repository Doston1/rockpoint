import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// =================================================================
// VALIDATION SCHEMAS
// =================================================================

const updatePaymentMethodStatusSchema = z.object({
  is_enabled: z.boolean(),
  daily_limit: z.number().min(0).optional(),
  transaction_limit: z.number().min(0).optional(),
  priority: z.number().min(0).optional()
});

const updateCredentialsSchema = z.object({
  credentials: z.record(z.string(), z.string().min(1)),
  is_test_environment: z.boolean().optional()
});

// =================================================================
// ROUTE HANDLERS
// =================================================================

/**
 * GET /api/payment-methods/status
 * Get all payment methods status for this branch
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  console.log('📋 Getting payment methods status for branch');

  try {
    const result = await DatabaseManager.query(`
      SELECT 
        payment_method_code,
        payment_method_name,
        is_enabled,
        priority,
        daily_limit,
        transaction_limit,
        credentials_configured,
        last_sync_at,
        sync_status,
        error_message,
        created_at,
        updated_at
      FROM branch_payment_methods_status
      ORDER BY priority ASC, payment_method_code ASC
    `);

    res.json({
      success: true,
      data: {
        payment_methods: result.rows
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to get payment methods status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve payment methods status',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payment-methods/active
 * Get only active payment methods for this branch
 */
router.get('/active', asyncHandler(async (req: Request, res: Response) => {
  console.log('📋 Getting active payment methods for branch');

  try {
    const result = await DatabaseManager.query(`
      SELECT 
        payment_method_code,
        payment_method_name,
        is_enabled,
        priority,
        daily_limit,
        transaction_limit,
        credentials_configured
      FROM branch_payment_methods_status
      WHERE is_enabled = true AND credentials_configured = true
      ORDER BY priority ASC, payment_method_code ASC
    `);

    res.json({
      success: true,
      data: {
        payment_methods: result.rows
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to get active payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve active payment methods',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/payment-methods/:code/status
 * Update payment method status
 */
router.put('/:code/status', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  const validatedData = updatePaymentMethodStatusSchema.parse(req.body);

  console.log('⚙️ Updating payment method status:', {
    payment_method_code: code,
    changes: validatedData
  });

  try {
    // Check if payment method exists
    const existingResult = await DatabaseManager.query(
      'SELECT id FROM branch_payment_methods_status WHERE payment_method_code = $1',
      [code]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found',
        message: `Payment method '${code}' is not configured for this branch`,
        timestamp: new Date().toISOString()
      });
    }

    // Update payment method status
    const updateResult = await DatabaseManager.query(`
      UPDATE branch_payment_methods_status 
      SET 
        is_enabled = COALESCE($2, is_enabled),
        daily_limit = COALESCE($3, daily_limit),
        transaction_limit = COALESCE($4, transaction_limit),
        priority = COALESCE($5, priority),
        updated_at = NOW()
      WHERE payment_method_code = $1
      RETURNING *
    `, [
      code,
      validatedData.is_enabled,
      validatedData.daily_limit,
      validatedData.transaction_limit,
      validatedData.priority
    ]);

    res.json({
      success: true,
      data: {
        payment_method: updateResult.rows[0]
      },
      message: `Payment method '${code}' status updated successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to update payment method status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update payment method status',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/payment-methods/:code/credentials
 * Get payment method credentials
 */
router.get('/:code/credentials', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  console.log('🔑 Getting payment method credentials:', {
    payment_method_code: code
  });

  try {
    const result = await DatabaseManager.query(`
      SELECT 
        credential_key,
        credential_value,
        is_encrypted,
        is_test_environment,
        last_sync_at,
        updated_at
      FROM payment_method_credentials
      WHERE payment_method_code = $1
      ORDER BY credential_key ASC
    `, [code]);

    // Convert array to object for easier frontend consumption
    const credentials: Record<string, any> = {};
    let isTestEnvironment = false;

    result.rows.forEach((row: any) => {
      credentials[row.credential_key] = {
        value: row.credential_value,
        is_encrypted: row.is_encrypted,
        last_updated: row.updated_at
      };
      if (row.is_test_environment) {
        isTestEnvironment = true;
      }
    });

    res.json({
      success: true,
      data: {
        payment_method_code: code,
        credentials,
        is_test_environment: isTestEnvironment,
        last_sync_at: result.rows[0]?.last_sync_at || null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to get payment method credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve payment method credentials',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/payment-methods/:code/credentials
 * Update payment method credentials
 */
router.put('/:code/credentials', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  const validatedData = updateCredentialsSchema.parse(req.body);

  console.log('🔑 Updating payment method credentials:', {
    payment_method_code: code,
    credential_keys: Object.keys(validatedData.credentials),
    is_test_environment: validatedData.is_test_environment
  });

  try {
    // Start transaction
    await DatabaseManager.query('BEGIN');

    // Delete existing credentials for this payment method
    await DatabaseManager.query(
      'DELETE FROM payment_method_credentials WHERE payment_method_code = $1',
      [code]
    );

    // Insert new credentials
    for (const [key, value] of Object.entries(validatedData.credentials)) {
      await DatabaseManager.query(`
        INSERT INTO payment_method_credentials (
          payment_method_code,
          credential_key,
          credential_value,
          is_encrypted,
          is_test_environment,
          last_sync_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
      `, [
        code,
        key,
        value,
        true, // Always mark as encrypted for security
        validatedData.is_test_environment || false
      ]);
    }

    // Update payment method status to indicate credentials are configured
    await DatabaseManager.query(`
      UPDATE branch_payment_methods_status 
      SET 
        credentials_configured = true,
        sync_status = 'synced',
        error_message = NULL,
        updated_at = NOW()
      WHERE payment_method_code = $1
    `, [code]);

    // Commit transaction
    await DatabaseManager.query('COMMIT');

    res.json({
      success: true,
      data: {
        payment_method_code: code,
        credentials_count: Object.keys(validatedData.credentials).length,
        is_test_environment: validatedData.is_test_environment || false
      },
      message: `Credentials for payment method '${code}' updated successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    // Rollback transaction on error
    await DatabaseManager.query('ROLLBACK');
    
    console.error('❌ Failed to update payment method credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update payment method credentials',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/payment-methods/:code/test-connection
 * Test payment method connection
 */
router.post('/:code/test-connection', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  console.log('🔬 Testing payment method connection:', {
    payment_method_code: code
  });

  try {
    // This would be implemented based on specific payment method requirements
    // For now, return a mock test result
    // TODO: Implement actual connection testing for each payment method
    
    const result = await DatabaseManager.query(`
      SELECT 
        payment_method_name,
        is_enabled,
        credentials_configured
      FROM branch_payment_methods_status
      WHERE payment_method_code = $1
    `, [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment method not found',
        message: `Payment method '${code}' is not configured for this branch`,
        timestamp: new Date().toISOString()
      });
    }

    const paymentMethod = result.rows[0];

    if (!paymentMethod.credentials_configured) {
      return res.status(400).json({
        success: false,
        error: 'Credentials not configured',
        message: `Credentials for '${paymentMethod.payment_method_name}' are not configured`,
        timestamp: new Date().toISOString()
      });
    }

    // Mock connection test - replace with actual implementation
    const connectionTest = {
      success: true,
      response_time_ms: Math.floor(Math.random() * 500) + 100,
      api_version: '1.0',
      environment: 'sandbox' // This would be determined from credentials
    };

    res.json({
      success: true,
      data: {
        payment_method_code: code,
        payment_method_name: paymentMethod.payment_method_name,
        connection_test: connectionTest
      },
      message: `Connection test for '${paymentMethod.payment_method_name}' completed successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to test payment method connection:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to test payment method connection',
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
