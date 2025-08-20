import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { asyncHandler, createError } from '../../middleware/errorHandler';
import { FastPayService } from '../../services/FastPayService';
import { UzumBankConfig } from '../../services/UzumBankConfig';

const router = Router();

// =================================================================
// VALIDATION SCHEMAS
// =================================================================

const updateConfigSchema = z.object({
  merchant_service_user_id: z.string().min(1).optional(),
  secret_key: z.string().min(1).optional(),
  service_id: z.string().refine(val => !isNaN(parseInt(val)), 'Must be a valid number').optional(),
  api_base_url: z.string().url().optional(),
  request_timeout_ms: z.string().refine(val => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1000;
  }, 'Must be a number >= 1000').optional(),
  cashbox_code_prefix: z.string().min(1).optional(),
  max_retry_attempts: z.string().refine(val => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 0 && num <= 10;
  }, 'Must be a number between 0 and 10').optional(),
  enable_logging: z.enum(['true', 'false']).optional()
});

const analyticsQuerySchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  group_by: z.enum(['day', 'hour', 'terminal', 'employee']).default('day')
});

// =================================================================
// ROUTE HANDLERS
// =================================================================

/**
 * GET /api/admin/uzum-bank/config
 * Get all Uzum Bank configuration
 */
router.get('/config', asyncHandler(async (req: Request, res: Response) => {
  try {
    const config = await UzumBankConfig.getAllConfig();
    const validation = await UzumBankConfig.validateConfig();
    const status = await UzumBankConfig.getStatus();

    res.json({
      success: true,
      data: {
        config,
        validation,
        status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Failed to get Uzum Bank config:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve configuration',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * PUT /api/admin/uzum-bank/config
 * Update Uzum Bank configuration
 */
router.put('/config', asyncHandler(async (req: Request, res: Response) => {
  const updates = updateConfigSchema.parse(req.body);

  console.log('🔧 Updating Uzum Bank configuration:', Object.keys(updates));

  try {
    // Update each provided configuration value
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const encrypt = key === 'secret_key';
        await UzumBankConfig.setConfig(key, value, undefined, encrypt);
      }
    }

    // Validate the updated configuration
    const validation = await UzumBankConfig.validateConfig();
    const config = await UzumBankConfig.getAllConfig();

    res.json({
      success: true,
      data: {
        config,
        validation,
        updated_keys: Object.keys(updates)
      },
      message: 'Configuration updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Failed to update Uzum Bank config:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update configuration',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/admin/uzum-bank/config/test
 * Test Uzum Bank configuration
 */
router.post('/config/test', asyncHandler(async (req: Request, res: Response) => {
  console.log('🧪 Testing Uzum Bank configuration...');

  try {
    const testResult = await UzumBankConfig.testConfig();

    if (testResult.success) {
      res.json({
        success: true,
        message: 'Configuration test passed - ready for production',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Configuration test failed',
        message: testResult.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('❌ Configuration test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to test configuration',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * POST /api/admin/uzum-bank/config/reset
 * Reset configuration to defaults
 */
router.post('/config/reset', asyncHandler(async (req: Request, res: Response) => {
  console.log('🔄 Resetting Uzum Bank configuration to defaults...');

  try {
    await UzumBankConfig.resetToDefaults();
    const config = await UzumBankConfig.getAllConfig();
    const validation = await UzumBankConfig.validateConfig();

    res.json({
      success: true,
      data: {
        config,
        validation
      },
      message: 'Configuration reset to defaults',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Failed to reset Uzum Bank config:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to reset configuration',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/admin/uzum-bank/status
 * Get Uzum Bank integration status
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const configStatus = await UzumBankConfig.getStatus();
    
    // Get recent transaction statistics
    const recentStatsResult = await DatabaseManager.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
        SUM(CASE WHEN status = 'success' THEN amount_uzs ELSE 0 END) as total_amount_processed,
        AVG(CASE WHEN completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (completed_at - initiated_at)) * 1000
        END) as avg_processing_time_ms
      FROM uzum_fastpay_transactions 
      WHERE initiated_at >= NOW() - INTERVAL '24 hours'
    `);

    const stats = recentStatsResult.rows[0];

    // Get error frequency
    const errorStatsResult = await DatabaseManager.query(`
      SELECT 
        error_code,
        error_message,
        COUNT(*) as count
      FROM uzum_fastpay_transactions 
      WHERE status = 'failed' 
        AND initiated_at >= NOW() - INTERVAL '24 hours'
        AND error_code > 0
      GROUP BY error_code, error_message
      ORDER BY count DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        configuration: configStatus,
        recent_24h_stats: {
          total_transactions: parseInt(stats.total_transactions || '0'),
          successful_transactions: parseInt(stats.successful_transactions || '0'),
          failed_transactions: parseInt(stats.failed_transactions || '0'),
          pending_transactions: parseInt(stats.pending_transactions || '0'),
          total_amount_processed: parseFloat(stats.total_amount_processed || '0'),
          avg_processing_time_ms: Math.round(parseFloat(stats.avg_processing_time_ms || '0')),
          success_rate: stats.total_transactions > 0 
            ? Math.round((stats.successful_transactions / stats.total_transactions) * 100)
            : 0
        },
        common_errors: errorStatsResult.rows
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Failed to get Uzum Bank status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve status information',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/admin/uzum-bank/transactions
 * List Uzum Bank transactions with advanced filtering
 */
router.get('/transactions', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const status = req.query.status as string;
  const startDate = req.query.start_date as string;
  const endDate = req.query.end_date as string;
  const employeeId = req.query.employee_id as string;
  const terminalId = req.query.terminal_id as string;
  const errorCode = req.query.error_code as string;

  try {
    const result = await FastPayService.getTransactions({
      status,
      employeeId,
      terminalId,
      startDate,
      endDate,
      page,
      limit
    });

    // Add additional filtering by error code if specified
    let filteredTransactions = result.transactions;
    if (errorCode) {
      const code = parseInt(errorCode);
      filteredTransactions = result.transactions.filter(
        (t: any) => t.error_code === code
      );
    }

    res.json({
      success: true,
      data: {
        transactions: filteredTransactions,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        },
        filters: {
          status,
          start_date: startDate,
          end_date: endDate,
          employee_id: employeeId,
          terminal_id: terminalId,
          error_code: errorCode
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Failed to get Uzum Bank transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve transactions',
      timestamp: new Date().toISOString()
    });
  }
}));

/**
 * GET /api/admin/uzum-bank/analytics
 * Get analytics data for Uzum Bank transactions
 */
router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, group_by } = analyticsQuerySchema.parse(req.query);

  try {
    let query = '';
    let params: any[] = [];
    let paramIndex = 1;

    // Build date filter
    let dateFilter = '';
    if (start_date) {
      dateFilter += ` AND initiated_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ` AND initiated_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    // Build grouping query based on group_by parameter
    switch (group_by) {
      case 'day':
        query = `
          SELECT 
            DATE(initiated_at) as period,
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
            SUM(CASE WHEN status = 'success' THEN amount_uzs ELSE 0 END) as total_amount,
            AVG(CASE WHEN completed_at IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (completed_at - initiated_at)) * 1000
            END) as avg_processing_time_ms
          FROM uzum_fastpay_transactions 
          WHERE 1=1 ${dateFilter}
          GROUP BY DATE(initiated_at)
          ORDER BY period DESC
          LIMIT 30
        `;
        break;

      case 'hour':
        query = `
          SELECT 
            DATE_TRUNC('hour', initiated_at) as period,
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
            SUM(CASE WHEN status = 'success' THEN amount_uzs ELSE 0 END) as total_amount,
            AVG(CASE WHEN completed_at IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (completed_at - initiated_at)) * 1000
            END) as avg_processing_time_ms
          FROM uzum_fastpay_transactions 
          WHERE 1=1 ${dateFilter}
          GROUP BY DATE_TRUNC('hour', initiated_at)
          ORDER BY period DESC
          LIMIT 48
        `;
        break;

      case 'terminal':
        query = `
          SELECT 
            terminal_id as period,
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
            SUM(CASE WHEN status = 'success' THEN amount_uzs ELSE 0 END) as total_amount,
            AVG(CASE WHEN completed_at IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (completed_at - initiated_at)) * 1000
            END) as avg_processing_time_ms
          FROM uzum_fastpay_transactions 
          WHERE 1=1 ${dateFilter}
          GROUP BY terminal_id
          ORDER BY total_transactions DESC
          LIMIT 20
        `;
        break;

      case 'employee':
        query = `
          SELECT 
            ft.employee_id as period,
            e.name as employee_name,
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN ft.status = 'success' THEN 1 END) as successful_transactions,
            COUNT(CASE WHEN ft.status = 'failed' THEN 1 END) as failed_transactions,
            SUM(CASE WHEN ft.status = 'success' THEN ft.amount_uzs ELSE 0 END) as total_amount,
            AVG(CASE WHEN ft.completed_at IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (ft.completed_at - ft.initiated_at)) * 1000
            END) as avg_processing_time_ms
          FROM uzum_fastpay_transactions ft
          LEFT JOIN employees e ON ft.employee_id = e.employee_id
          WHERE 1=1 ${dateFilter}
          GROUP BY ft.employee_id, e.name
          ORDER BY total_transactions DESC
          LIMIT 20
        `;
        break;
    }

    const result = await DatabaseManager.query(query, params);

    // Get overall summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
        SUM(CASE WHEN status = 'success' THEN amount_uzs ELSE 0 END) as total_amount,
        AVG(CASE WHEN completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (completed_at - initiated_at)) * 1000
        END) as avg_processing_time_ms,
        COUNT(DISTINCT terminal_id) as unique_terminals,
        COUNT(DISTINCT employee_id) as unique_employees
      FROM uzum_fastpay_transactions 
      WHERE 1=1 ${dateFilter}
    `;

    const summaryResult = await DatabaseManager.query(summaryQuery, params);
    const summary = summaryResult.rows[0];

    res.json({
      success: true,
      data: {
        summary: {
          total_transactions: parseInt(summary.total_transactions || '0'),
          successful_transactions: parseInt(summary.successful_transactions || '0'),
          failed_transactions: parseInt(summary.failed_transactions || '0'),
          total_amount: parseFloat(summary.total_amount || '0'),
          avg_processing_time_ms: Math.round(parseFloat(summary.avg_processing_time_ms || '0')),
          unique_terminals: parseInt(summary.unique_terminals || '0'),
          unique_employees: parseInt(summary.unique_employees || '0'),
          success_rate: summary.total_transactions > 0 
            ? Math.round((summary.successful_transactions / summary.total_transactions) * 100)
            : 0
        },
        breakdown: result.rows.map((row: any) => ({
          ...row,
          total_transactions: parseInt(row.total_transactions || '0'),
          successful_transactions: parseInt(row.successful_transactions || '0'),
          failed_transactions: parseInt(row.failed_transactions || '0'),
          total_amount: parseFloat(row.total_amount || '0'),
          avg_processing_time_ms: Math.round(parseFloat(row.avg_processing_time_ms || '0')),
          success_rate: row.total_transactions > 0 
            ? Math.round((row.successful_transactions / row.total_transactions) * 100)
            : 0
        })),
        filters: {
          start_date,
          end_date,
          group_by
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Failed to get Uzum Bank analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve analytics data',
      timestamp: new Date().toISOString()
    });
  }
}));

// =================================================================
// ERROR HANDLING
// =================================================================

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
