import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';
import { BranchApiService } from '../services/branchApi';

const router = Router();

// Validation schemas
const updateBranchPaymentMethodSchema = z.object({
  is_enabled: z.boolean(),
  priority: z.number().min(0).max(10).optional(),
  daily_limit: z.number().positive().optional(),
  transaction_limit: z.number().positive().optional(),
  notes: z.string().optional(),
});

const updateCredentialsSchema = z.object({
  credentials: z.array(z.object({
    credential_key: z.string(),
    credential_value: z.string(),
    is_test_environment: z.boolean().optional().default(false),
    description: z.string().optional(),
  })),
});

// GET /api/payment-methods - Get all available payment methods
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = `
    SELECT 
      id, method_code, method_name, method_name_ru, method_name_uz,
      description, description_ru, description_uz, is_active,
      requires_qr, requires_fiscal_receipt, api_documentation_url,
      logo_url, sort_order, created_at, updated_at
    FROM payment_methods 
    WHERE is_active = true
    ORDER BY sort_order ASC, method_name ASC
  `;
  
  const result = await DatabaseManager.query(query);
  
  res.json({
    success: true,
    data: result.rows.map((method: any) => ({
      id: method.id,
      methodCode: method.method_code,
      methodName: method.method_name,
      methodNameRu: method.method_name_ru,
      methodNameUz: method.method_name_uz,
      description: method.description,
      descriptionRu: method.description_ru,
      descriptionUz: method.description_uz,
      isActive: method.is_active,
      requiresQr: method.requires_qr,
      requiresFiscalReceipt: method.requires_fiscal_receipt,
      apiDocumentationUrl: method.api_documentation_url,
      logoUrl: method.logo_url,
      sortOrder: method.sort_order,
      createdAt: method.created_at,
      updatedAt: method.updated_at,
    })),
    timestamp: new Date().toISOString(),
  });
}));

// GET /api/branches/:branchId/payment-methods - Get payment methods configured for a specific branch
router.get('/branches/:branchId/payment-methods', asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  
  const query = `
    SELECT 
      bpm.id, bpm.branch_id, bpm.payment_method_id, bpm.is_enabled,
      bpm.priority, bpm.daily_limit, bpm.transaction_limit,
      bpm.enabled_at, bpm.enabled_by, bpm.notes,
      bpm.created_at, bpm.updated_at,
      pm.id as pm_id, pm.method_code, pm.method_name, pm.method_name_ru, pm.method_name_uz,
      pm.description, pm.description_ru, pm.description_uz, pm.is_active as pm_is_active,
      pm.requires_qr, pm.requires_fiscal_receipt, pm.api_documentation_url,
      pm.logo_url, pm.sort_order
    FROM branch_payment_methods bpm
    INNER JOIN payment_methods pm ON bpm.payment_method_id = pm.id
    WHERE bpm.branch_id = $1 AND pm.is_active = true
    ORDER BY bpm.priority ASC, pm.sort_order ASC
  `;
  
  const result = await DatabaseManager.query(query, [branchId]);
  
  res.json({
    success: true,
    data: result.rows.map((row: any) => ({
      id: row.id,
      branchId: row.branch_id,
      paymentMethodId: row.payment_method_id,
      isEnabled: row.is_enabled,
      priority: row.priority,
      dailyLimit: row.daily_limit ? parseFloat(row.daily_limit) : null,
      transactionLimit: row.transaction_limit ? parseFloat(row.transaction_limit) : null,
      enabledAt: row.enabled_at,
      enabledBy: row.enabled_by,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      paymentMethod: {
        id: row.pm_id,
        methodCode: row.method_code,
        methodName: row.method_name,
        methodNameRu: row.method_name_ru,
        methodNameUz: row.method_name_uz,
        description: row.description,
        descriptionRu: row.description_ru,
        descriptionUz: row.description_uz,
        isActive: row.pm_is_active,
        requiresQr: row.requires_qr,
        requiresFiscalReceipt: row.requires_fiscal_receipt,
        apiDocumentationUrl: row.api_documentation_url,
        logoUrl: row.logo_url,
        sortOrder: row.sort_order,
      },
    })),
    timestamp: new Date().toISOString(),
  });
}));

// PUT /api/branches/:branchId/payment-methods/:branchPaymentMethodId - Update branch payment method configuration
router.put('/branches/:branchId/payment-methods/:branchPaymentMethodId', asyncHandler(async (req: Request, res: Response) => {
  const { branchId, branchPaymentMethodId } = req.params;
  const validatedData = updateBranchPaymentMethodSchema.parse(req.body);
  
  // Check if branch payment method exists by its ID
  const checkQuery = `
    SELECT id FROM branch_payment_methods 
    WHERE id = $1 AND branch_id = $2
  `;
  const checkResult = await DatabaseManager.query(checkQuery, [branchPaymentMethodId, branchId]);
  
  if (checkResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch payment method not found',
      timestamp: new Date().toISOString(),
    });
  }

  // Update existing branch payment method
  const updateQuery = `
    UPDATE branch_payment_methods 
    SET 
      is_enabled = $1,
      priority = $2,
      daily_limit = $3,
      transaction_limit = $4,
      notes = $5,
      enabled_at = CASE WHEN $1 = true AND enabled_at IS NULL THEN NOW() ELSE enabled_at END,
      updated_at = NOW()
    WHERE id = $6 AND branch_id = $7
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(updateQuery, [
    validatedData.is_enabled,
    validatedData.priority || 0,
    validatedData.daily_limit || null,
    validatedData.transaction_limit || null,
    validatedData.notes || null,
    branchPaymentMethodId,
    branchId,
  ]);

  res.json({
    success: true,
    data: result.rows[0],
    message: 'Branch payment method updated successfully',
    timestamp: new Date().toISOString(),
  });
}));

// GET /api/branches/:branchId/payment-methods/:paymentMethodId/credentials - Get credentials for a payment method
router.get('/branches/:branchId/payment-methods/:paymentMethodId/credentials', asyncHandler(async (req: Request, res: Response) => {
  const { branchId, paymentMethodId } = req.params;
  
  const query = `
    SELECT 
      id, branch_id, payment_method_id, credential_key, credential_value,
      is_encrypted, is_test_environment, description, last_updated_by,
      created_at, updated_at
    FROM branch_payment_credentials
    WHERE branch_id = $1 AND payment_method_id = $2
    ORDER BY credential_key ASC
  `;
  
  const result = await DatabaseManager.query(query, [branchId, paymentMethodId]);
  
  res.json({
    success: true,
    data: result.rows.map((cred: any) => ({
      id: cred.id,
      branchId: cred.branch_id,
      paymentMethodId: cred.payment_method_id,
      credentialKey: cred.credential_key,
      credentialValue: cred.credential_value,
      isEncrypted: cred.is_encrypted,
      isTestEnvironment: cred.is_test_environment,
      description: cred.description,
      lastUpdatedBy: cred.last_updated_by,
      createdAt: cred.created_at,
      updatedAt: cred.updated_at,
    })),
    timestamp: new Date().toISOString(),
  });
}));

// PUT /api/branches/:branchId/payment-methods/:paymentMethodId/credentials - Update credentials for a payment method
router.put('/branches/:branchId/payment-methods/:paymentMethodId/credentials', asyncHandler(async (req: Request, res: Response) => {
  const { branchId, paymentMethodId } = req.params;
  const validatedData = updateCredentialsSchema.parse(req.body);
  
  // Start transaction
  await DatabaseManager.query('BEGIN');
  
  try {
    // Delete existing credentials for this payment method
    await DatabaseManager.query(
      'DELETE FROM branch_payment_credentials WHERE branch_id = $1 AND payment_method_id = $2',
      [branchId, paymentMethodId]
    );
    
    // Insert new credentials
    const insertPromises = validatedData.credentials.map(async (cred) => {
      const insertQuery = `
        INSERT INTO branch_payment_credentials (
          branch_id, payment_method_id, credential_key, credential_value,
          is_encrypted, is_test_environment, description, last_updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      return DatabaseManager.query(insertQuery, [
        branchId,
        paymentMethodId,
        cred.credential_key,
        cred.credential_value,
        cred.credential_key.includes('secret') || cred.credential_key.includes('password'),
        cred.is_test_environment,
        cred.description,
        null, // TODO: Add user ID from auth middleware when available
      ]);
    });
    
    const results = await Promise.all(insertPromises);
    
    // Commit transaction
    await DatabaseManager.query('COMMIT');
    
    res.json({
      success: true,
      data: results.map(r => r.rows[0]),
      message: 'Payment method credentials updated successfully',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    // Rollback transaction
    await DatabaseManager.query('ROLLBACK');
    throw error;
  }
}));

// GET /api/branches/:branchId/payment-methods/status - Get payment methods status summary for a branch
router.get('/branches/:branchId/payment-methods/status', asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  
  const query = `
    SELECT 
      pm.method_code,
      pm.method_name,
      COALESCE(bpm.is_enabled, false) as is_enabled,
      CASE 
        WHEN bpm.id IS NULL THEN 'not_configured'
        WHEN bpm.is_enabled = false THEN 'disabled'
        WHEN NOT EXISTS (
          SELECT 1 FROM branch_payment_credentials 
          WHERE branch_id = bpm.branch_id AND payment_method_id = bpm.payment_method_id
        ) AND pm.method_code != 'cash' THEN 'missing_credentials'
        ELSE 'active'
      END as status,
      COUNT(pt.id) as transaction_count_24h,
      COALESCE(SUM(pt.amount), 0) as total_amount_24h
    FROM payment_methods pm
    LEFT JOIN branch_payment_methods bpm ON pm.id = bpm.payment_method_id AND bpm.branch_id = $1
    LEFT JOIN payment_transactions pt ON pm.id = pt.payment_method_id 
      AND pt.branch_id = $1 
      AND pt.initiated_at >= NOW() - INTERVAL '24 hours'
      AND pt.status = 'completed'
    WHERE pm.is_active = true
    GROUP BY pm.id, pm.method_code, pm.method_name, bpm.id, bpm.is_enabled
    ORDER BY pm.sort_order ASC
  `;
  
  const result = await DatabaseManager.query(query, [branchId]);
  
  res.json({
    success: true,
    data: result.rows.map((row: any) => ({
      methodCode: row.method_code,
      methodName: row.method_name,
      isEnabled: row.is_enabled,
      status: row.status,
      transactionCount24h: parseInt(row.transaction_count_24h),
      totalAmount24h: parseFloat(row.total_amount_24h),
    })),
    timestamp: new Date().toISOString(),
  });
}));

// POST /api/payment-methods/sync/:branchId - Sync payment methods configuration to branch
router.post('/sync/:branchId', asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  
  try {
    // Validate branch exists
    const branchCheck = await DatabaseManager.query(
      'SELECT id, name FROM branches WHERE id = $1 AND is_active = true',
      [branchId]
    );
    
    if (branchCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found or inactive'
      });
    }

    // Get current payment methods configuration for the branch
    const paymentMethodsQuery = `
      SELECT 
        pm.id,
        pm.method_code,
        pm.method_name,
        pm.method_name_ru,
        pm.method_name_uz,
        pm.description,
        pm.description_ru,
        pm.description_uz,
        pm.requires_qr,
        pm.requires_fiscal_receipt,
        pm.is_active as method_active,
        bpm.id as branch_payment_method_id,
        bpm.is_enabled,
        bpm.priority as priority_order,
        bpm.updated_at
      FROM payment_methods pm
      LEFT JOIN branch_payment_methods bpm ON pm.id = bpm.payment_method_id AND bpm.branch_id = $1
      WHERE pm.is_active = true
      ORDER BY bpm.priority ASC NULLS LAST, pm.method_name ASC
    `;
    
    const paymentMethodsResult = await DatabaseManager.query(paymentMethodsQuery, [branchId]);
    
    // Get credentials for enabled payment methods
    const credentialsQuery = `
      SELECT 
        bpc.payment_method_id,
        bpc.credential_key,
        bpc.credential_value,
        bpc.is_encrypted,
        bpc.is_test_environment,
        bpc.description
      FROM branch_payment_credentials bpc
      JOIN branch_payment_methods bpm ON bpm.payment_method_id = bpc.payment_method_id 
        AND bpm.branch_id = bpc.branch_id
      WHERE bpc.branch_id = $1 AND bpm.is_enabled = true
      ORDER BY bpc.payment_method_id, bpc.credential_key
    `;
    
    const credentialsResult = await DatabaseManager.query(credentialsQuery, [branchId]);
    
    // Organize credentials by payment method
    const credentialsByMethod: { [key: string]: any[] } = {};
    credentialsResult.rows.forEach((cred: any) => {
      if (!credentialsByMethod[cred.payment_method_id]) {
        credentialsByMethod[cred.payment_method_id] = [];
      }
      credentialsByMethod[cred.payment_method_id].push({
        key: cred.credential_key,
        value: cred.credential_value,
        isEncrypted: cred.is_encrypted,
        isTestEnvironment: cred.is_test_environment,
        description: cred.description,
      });
    });

    // Prepare sync payload
    const syncPayload = {
      sync_type: 'payment_methods_config',
      timestamp: new Date().toISOString(),
      data: {
        payment_methods: paymentMethodsResult.rows.map((row: any) => ({
          id: row.id,
          method_code: row.method_code,
          method_name: row.method_name,
          method_name_ru: row.method_name_ru,
          method_name_uz: row.method_name_uz,
          description: row.description,
          description_ru: row.description_ru,
          description_uz: row.description_uz,
          requires_qr: row.requires_qr,
          requires_fiscal_receipt: row.requires_fiscal_receipt,
          is_enabled: row.is_enabled || false,
          priority_order: row.priority_order,
          credentials: credentialsByMethod[row.id] || []
        })).filter((method: any) => method.is_enabled) // Only send enabled methods
      }
    };

    // Send to branch
    const result = await BranchApiService.makeRequest({
      branchId,
      endpoint: 'sync/payment-methods-config',
      method: 'POST',
      data: syncPayload,
      timeout: 15000
    });

    if (result.success) {
      // Log successful sync
      await DatabaseManager.query(`
        INSERT INTO branch_sync_logs (branch_id, sync_type, direction, status, records_processed, completed_at)
        VALUES ($1, 'payment_methods', 'to_branch', 'completed', $2, NOW())
      `, [branchId, paymentMethodsResult.rows.filter((row: any) => row.is_enabled).length]);

      res.status(200).json({
        success: true,
        data: {
          message: 'Payment methods configuration synced successfully',
          synced_methods: paymentMethodsResult.rows.filter((row: any) => row.is_enabled).length,
          branch_response: result.data
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error(`Branch sync failed: ${result.error || 'Unknown error'}`);
    }

  } catch (error: any) {
    // Log failed sync
    try {
      await DatabaseManager.query(`
        INSERT INTO branch_sync_logs (branch_id, sync_type, direction, status, error_message, completed_at)
        VALUES ($1, 'payment_methods', 'to_branch', 'failed', $2, NOW())
      `, [branchId, error.message]);
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to sync payment methods configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}));

export default router;
