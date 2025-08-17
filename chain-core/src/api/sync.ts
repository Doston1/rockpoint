import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';
import { BranchApiService } from '../services/branchApi';

const router = Router();

// Validation schemas
const SyncProductsSchema = z.object({
  branch_ids: z.array(z.string()).optional(),
  products: z.array(z.object({
    sku: z.string(),
    barcode: z.string(),
    name: z.string(),
    price: z.number().positive(),
    cost: z.number().positive().optional(),
    category_key: z.string().optional(),
    is_active: z.boolean().optional()
  })).min(1)
});

const SyncEmployeesSchema = z.object({
  branch_ids: z.array(z.string()).optional(),
  employees: z.array(z.object({
    employee_id: z.string(),
    name: z.string(),
    role: z.enum(['admin', 'manager', 'supervisor', 'cashier']),
    status: z.enum(['active', 'inactive', 'terminated']).default('active')
  })).min(1)
});

const SyncInventorySchema = z.object({
  branch_ids: z.array(z.string()).optional(),
  updates: z.array(z.object({
    barcode: z.string(),
    quantity_adjustment: z.number(),
    adjustment_type: z.enum(['add', 'subtract', 'set']),
    reason: z.string().optional()
  })).min(1)
});

// POST /api/sync/products - Sync products to branches
router.post('/products', asyncHandler(async (req: Request, res: Response) => {
  try {
    const validatedData = SyncProductsSchema.parse(req.body);
    
    const result = await BranchApiService.makeMultiRequest(
      (validatedData.branch_ids || await getAllActiveBranchIds()).map(branchId => ({
        branchId,
        endpoint: 'chain-core/products/sync',
        method: 'POST' as const,
        data: { products: validatedData.products },
        timeout: 30000
      }))
    );
    
    const successful = result.filter(r => r.success);
    const failed = result.filter(r => !r.success);
    
    res.json({
      success: true,
      data: {
        sync_type: 'products',
        total_branches: result.length,
        successful_syncs: successful.length,
        failed_syncs: failed.length,
        results: result.map(r => ({
          branch_id: r.branchId,
          success: r.success,
          error: r.error,
          status: r.status,
          synced_products: r.success ? r.data?.synced || 0 : 0
        }))
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.errors
      });
    }
    
    throw error;
  }
}));

// POST /api/sync/employees - Sync employees to branches
router.post('/employees', asyncHandler(async (req: Request, res: Response) => {
  try {
    const validatedData = SyncEmployeesSchema.parse(req.body);
    
    const result = await BranchApiService.makeMultiRequest(
      (validatedData.branch_ids || await getAllActiveBranchIds()).map(branchId => ({
        branchId,
        endpoint: 'chain-core/employees',
        method: 'POST' as const,
        data: { employees: validatedData.employees },
        timeout: 30000
      }))
    );
    
    const successful = result.filter(r => r.success);
    const failed = result.filter(r => !r.success);
    
    res.json({
      success: true,
      data: {
        sync_type: 'employees',
        total_branches: result.length,
        successful_syncs: successful.length,
        failed_syncs: failed.length,
        results: result.map(r => ({
          branch_id: r.branchId,
          success: r.success,
          error: r.error,
          status: r.status,
          synced_employees: r.success ? r.data?.synced || 0 : 0
        }))
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.errors
      });
    }
    
    throw error;
  }
}));

// POST /api/sync/inventory - Sync inventory updates to branches
router.post('/inventory', asyncHandler(async (req: Request, res: Response) => {
  try {
    const validatedData = SyncInventorySchema.parse(req.body);
    
    const result = await BranchApiService.makeMultiRequest(
      (validatedData.branch_ids || await getAllActiveBranchIds()).map(branchId => ({
        branchId,
        endpoint: 'chain-core/inventory',
        method: 'PUT' as const,
        data: { updates: validatedData.updates },
        timeout: 30000
      }))
    );
    
    const successful = result.filter(r => r.success);
    const failed = result.filter(r => !r.success);
    
    res.json({
      success: true,
      data: {
        sync_type: 'inventory',
        total_branches: result.length,
        successful_syncs: successful.length,
        failed_syncs: failed.length,
        results: result.map(r => ({
          branch_id: r.branchId,
          success: r.success,
          error: r.error,
          status: r.status,
          updated_items: r.success ? r.data?.updated || 0 : 0
        }))
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.errors
      });
    }
    
    throw error;
  }
}));

// GET /api/sync/status - Get sync status from all branches
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const branchIds = await getAllActiveBranchIds();
  
  const results = await BranchApiService.makeMultiRequest(
    branchIds.map(branchId => ({
      branchId,
      endpoint: 'chain-core/status',
      method: 'GET' as const,
      timeout: 10000
    }))
  );
  
  res.json({
    success: true,
    data: {
      total_branches: results.length,
      online_branches: results.filter(r => r.success).length,
      offline_branches: results.filter(r => !r.success).length,
      branches: results.map(r => ({
        branch_id: r.branchId,
        online: r.success,
        status: r.success ? r.data?.system_status : 'offline',
        error: r.error,
        last_check: new Date().toISOString(),
        statistics: r.success ? r.data?.statistics : null
      }))
    }
  });
}));

// POST /api/sync/test-all-connections - Test connections to all branches
router.post('/test-all-connections', asyncHandler(async (req: Request, res: Response) => {
  const branchIds = await getAllActiveBranchIds();
  
  const results = await BranchApiService.makeMultiRequest(
    branchIds.map(branchId => ({
      branchId,
      endpoint: 'health',
      method: 'GET' as const,
      timeout: 5000
    }))
  );
  
  // Update branch server statuses
  for (const result of results) {
    const status = result.success ? 'online' : 'error';
    await DatabaseManager.query(`
      UPDATE branch_servers 
      SET status = $1, last_ping = NOW(), updated_at = NOW()
      WHERE branch_id = $2
    `, [status, result.branchId]);
  }
  
  res.json({
    success: true,
    data: {
      total_branches: results.length,
      online_branches: results.filter(r => r.success).length,
      offline_branches: results.filter(r => !r.success).length,
      test_results: results.map(r => ({
        branch_id: r.branchId,
        success: r.success,
        status: r.status,
        error: r.error,
        authenticated: r.success && r.status !== 401
      }))
    }
  });
}));

// Helper function to get all active branch IDs
async function getAllActiveBranchIds(): Promise<string[]> {
  const result = await DatabaseManager.query(`
    SELECT DISTINCT branch_id 
    FROM branch_servers 
    WHERE is_active = true AND status = 'online'
  `);
  return result.rows.map((row: any) => row.branch_id);
}

export default router;
