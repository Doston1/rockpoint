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



// POST /api/sync/products-complete/branch/:branchId - Comprehensive product sync
router.post('/products-complete/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { since_timestamp } = req.body; // Optional: only sync changes since this timestamp
    
    // Validate branch exists
    const branchCheck = await DatabaseManager.query(
      'SELECT id, name, last_sync_at FROM branches WHERE id = $1 AND is_active = true',
      [branchId]
    );
    
    if (branchCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Branch not found or inactive'
      });
    }
    
    const branch = branchCheck.rows[0];
    const lastSyncAt = since_timestamp || branch.last_sync_at || '1970-01-01';
        
    const syncResults = {
      products: { synced: 0, checked: 0 },
      prices: { synced: 0, checked: 0 },
      promotions: { synced: 0, checked: 0 },
      inventory_status: { synced: 0, checked: 0 }
    };
    
    // 1. Get products that are new or updated since last sync
    const newOrUpdatedProducts = await DatabaseManager.query(`
      SELECT 
        p.id, p.sku, p.name, p.name_ru, p.name_uz, p.barcode, p.description,
        p.description_ru, p.description_uz, p.brand, p.unit_of_measure,
        p.tax_rate, p.is_active, p.created_at, p.updated_at,
        COALESCE(bpp.price, p.base_price) as price,
        COALESCE(bpp.cost, p.cost) as cost,
        c.key as category_key
      FROM products p
      LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.created_at > $2 OR p.updated_at > $2 OR bpp.updated_at > $2)
        AND p.barcode IS NOT NULL
      ORDER BY p.updated_at DESC, p.created_at DESC
    `, [branchId, lastSyncAt]);
    
    syncResults.products.checked = newOrUpdatedProducts.rows.length;
    
    // 2. Get products with price changes (using existing sync status table)
    const priceChanges = await DatabaseManager.query(
      'SELECT * FROM get_products_needing_price_sync($1)',
      [branchId]
    );
    
    syncResults.prices.checked = priceChanges.rows.length;
    
    // 3. Get promotions that are new or updated since last sync
    const promotionChanges = await DatabaseManager.query(`
      SELECT 
        pr.id, pr.name, pr.description, pr.type, pr.discount_percentage,
        pr.discount_amount, pr.min_quantity, pr.buy_quantity, pr.get_quantity,
        pr.start_date, pr.end_date, pr.is_active,
        p.sku, p.barcode,
        c.key as category_key
      FROM promotions pr
      LEFT JOIN products p ON pr.product_id = p.id
      LEFT JOIN categories c ON pr.category_id = c.id
      WHERE (pr.branch_id = $1 OR pr.branch_id IS NULL)
        AND (pr.created_at > $2 OR pr.updated_at > $2)
        AND pr.is_active = true
        AND pr.start_date <= NOW()
        AND pr.end_date >= NOW()
      ORDER BY pr.updated_at DESC
    `, [branchId, lastSyncAt]);
    
    syncResults.promotions.checked = promotionChanges.rows.length;
    
    // 4. Get products with active/inactive status changes
    const statusChanges = await DatabaseManager.query(`
      SELECT 
        p.id, p.sku, p.barcode, p.is_active, p.updated_at
      FROM products p
      WHERE p.updated_at > $1 AND p.barcode IS NOT NULL
      ORDER BY p.updated_at DESC
    `, [lastSyncAt]);
    
    syncResults.inventory_status.checked = statusChanges.rows.length;
    
    // Prepare comprehensive sync payload
    const syncPayload: any = {
      sync_type: 'complete_products',
      timestamp: new Date().toISOString(),
      last_sync_at: lastSyncAt,
      data: {}
    };
    
    // Add new/updated products
    if (newOrUpdatedProducts.rows.length > 0) {
      syncPayload.data.products = newOrUpdatedProducts.rows.map((row: any) => ({
        sku: row.sku,
        barcode: row.barcode,
        name: row.name,
        name_ru: row.name_ru,
        name_uz: row.name_uz,
        description: row.description,
        description_ru: row.description_ru,
        description_uz: row.description_uz,
        category_key: row.category_key,
        brand: row.brand,
        price: parseFloat(row.price || 0),
        cost: parseFloat(row.cost || 0),
        tax_rate: parseFloat(row.tax_rate || 0),
        unit_of_measure: row.unit_of_measure,
        is_active: row.is_active,
        product_id: row.id
      }));
      syncResults.products.synced = syncPayload.data.products.length;
    }
    
    // Add price changes
    if (priceChanges.rows.length > 0) {
      syncPayload.data.price_updates = priceChanges.rows.map((row: any) => ({
        barcode: row.barcode,
        sku: row.sku,
        product_id: row.product_id,
        price: parseFloat(row.current_price || 0),
        cost: parseFloat(row.current_cost || 0),
        effective_date: new Date().toISOString()
      }));
      syncResults.prices.synced = syncPayload.data.price_updates.length;
    }
    
    // Add promotions
    if (promotionChanges.rows.length > 0) {
      syncPayload.data.promotions = promotionChanges.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        discount_percentage: parseFloat(row.discount_percentage || 0),
        discount_amount: parseFloat(row.discount_amount || 0),
        min_quantity: parseInt(row.min_quantity || 1),
        buy_quantity: parseInt(row.buy_quantity || 0),
        get_quantity: parseInt(row.get_quantity || 0),
        start_date: row.start_date,
        end_date: row.end_date,
        is_active: row.is_active,
        product_sku: row.sku,
        product_barcode: row.barcode,
        category_key: row.category_key
      }));
      syncResults.promotions.synced = syncPayload.data.promotions.length;
    }
    
    // Add status changes
    if (statusChanges.rows.length > 0) {
      syncPayload.data.status_updates = statusChanges.rows.map((row: any) => ({
        barcode: row.barcode,
        sku: row.sku,
        product_id: row.id,
        is_active: row.is_active
      }));
      syncResults.inventory_status.synced = syncPayload.data.status_updates.length;
    }
    
    // Only send if there are changes to sync
    const totalChanges = syncResults.products.synced + syncResults.prices.synced + 
                        syncResults.promotions.synced + syncResults.inventory_status.synced;
    
    if (totalChanges === 0) {
      return res.status(200).json({
        success: true,
        data: {
          message: 'No changes to sync',
          results: syncResults,
          total_synced: 0
        }
      });
    }
    
    // Send to branch
    const result = await BranchApiService.makeRequest({
      branchId,
      endpoint: 'sync/products-complete',
      method: 'POST',
      data: syncPayload,
      timeout: 30000
    });
    
    if (result.success) {
      // Check if branch-core actually processed the sync successfully
      const branchResponse = result.data;
      
      if (!branchResponse?.success) {
        throw new Error(`Branch-core reported sync failure: ${branchResponse?.message || 'Unknown error'}`);
      }
      
      // Check if there were any failures in the sync processing
      const totalFailed = (branchResponse?.total_failed || 0);
      const totalSuccess = (branchResponse?.total_success || 0);
      
      if (totalFailed > 0) {
        // Log the partial failure but don't mark as fully successful
        console.warn(`⚠️  Partial sync failure: ${totalSuccess} succeeded, ${totalFailed} failed`);
        
        // Only mark successfully synced items as synced, not the failed ones
        if (totalSuccess > 0 && branchResponse?.results) {
          // Mark only the successful price changes as synced
          if (priceChanges.rows.length > 0 && branchResponse.results.price_updates?.success > 0) {
            const successfulPriceUpdates = Math.min(branchResponse.results.price_updates.success, priceChanges.rows.length);
            const productIds = priceChanges.rows.slice(0, successfulPriceUpdates).map((row: any) => row.product_id);
            await DatabaseManager.query(
              'SELECT mark_products_as_synced($1, $2)',
              [branchId, productIds]
            );
          }
          
          // Partial update of last_sync_at only if some items succeeded
          await DatabaseManager.query(
            'UPDATE branches SET last_sync_at = NOW(), updated_at = NOW() WHERE id = $1',
            [branchId]
          );
        }
        
        // Log partial sync
        await DatabaseManager.query(`
          INSERT INTO branch_sync_logs (branch_id, sync_type, direction, status, records_processed, error_message, completed_at)
          VALUES ($1, 'products', 'to_branch', 'partial', $2, $3, NOW())
        `, [branchId, totalSuccess, `${totalFailed} items failed to sync`]);
        
        return res.status(207).json({ // 207 Multi-Status for partial success
          success: false,
          data: {
            message: `Partial sync completed: ${totalSuccess} succeeded, ${totalFailed} failed`,
            results: syncResults,
            total_synced: totalSuccess,
            total_failed: totalFailed,
            branch_errors: branchResponse?.errors || []
          }
        });
      }
      
      // Full success - mark all items as synced
      if (priceChanges.rows.length > 0) {
        const productIds = priceChanges.rows.map((row: any) => row.product_id);
        await DatabaseManager.query(
          'SELECT mark_products_as_synced($1, $2)',
          [branchId, productIds]
        );
      }
      
      // Update branch last_sync_at
      await DatabaseManager.query(
        'UPDATE branches SET last_sync_at = NOW(), updated_at = NOW() WHERE id = $1',
        [branchId]
      );
      
      // Log successful sync
      await DatabaseManager.query(`
        INSERT INTO branch_sync_logs (branch_id, sync_type, direction, status, records_processed, completed_at)
        VALUES ($1, 'products', 'to_branch', 'completed', $2, NOW())
      `, [branchId, totalChanges]);
      
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Complete sync successful',
          results: syncResults,
          total_synced: totalChanges
        }
      });
    } else {
      // HTTP request failed - branch-core is unreachable or returned HTTP error
      throw new Error(`Branch communication failed: ${result.error || 'Network error'} (HTTP ${result.status})`);
    }
    
  } catch (error: any) {
    
    // Log failed sync
    try {
      await DatabaseManager.query(`
        INSERT INTO branch_sync_logs (branch_id, sync_type, direction, status, error_message, completed_at)
        VALUES ($1, 'products', 'to_branch', 'failed', $2, NOW())
      `, [req.params.branchId, error.message]);
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to perform complete sync',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
