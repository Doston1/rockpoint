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

// POST /api/sync/products/branch/:branchId - Sync products to specific branch
router.post('/products/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    
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
    
    // Get all active products with their current pricing
    const productsQuery = `
      SELECT 
        p.id, p.sku, p.name, p.name_ru, p.name_uz, p.barcode, p.description,
        p.description_ru, p.description_uz, p.brand, p.unit_of_measure,
        p.tax_rate, p.is_active, 
        COALESCE(bpp.price, p.base_price) as price,
        COALESCE(bpp.cost, p.cost) as cost,
        c.key as category_key
      FROM products p
      LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
      ORDER BY p.name
    `;
    
    const productsResult = await DatabaseManager.query(productsQuery, [branchId]);
    
    const products = productsResult.rows.map((row: any) => ({
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
      unit_of_measure: row.unit_of_measure,
      tax_rate: parseFloat(row.tax_rate || 0),
      is_active: row.is_active
    }));
    
    // Send to branch
    const result = await BranchApiService.makeRequest({
      branchId,
      endpoint: 'chain-core/products/sync',
      method: 'POST',
      data: { products },
      timeout: 60000 // Longer timeout for large sync
    });
    
    res.json({
      success: result.success,
      data: {
        sync_type: 'products',
        branch_id: branchId,
        branch_name: branchCheck.rows[0].name,
        total_products: products.length,
        sync_result: result.success ? result.data : null,
        error: result.error
      }
    });
    
  } catch (error) {
    console.error('Error syncing products to branch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync products to branch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// POST /api/sync/prices/branch/:branchId - Sync prices to specific branch
router.post('/prices/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    
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
    
    // Get all products with their pricing for this branch
    const priceUpdatesQuery = `
      SELECT 
        p.id, p.sku, p.barcode,
        COALESCE(bpp.price, p.base_price) as price,
        COALESCE(bpp.cost, p.cost) as cost
      FROM products p
      LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
      WHERE p.is_active = true AND p.barcode IS NOT NULL
      ORDER BY p.name
    `;
    
    const priceResult = await DatabaseManager.query(priceUpdatesQuery, [branchId]);
    
    const updates = priceResult.rows.map((row: any) => ({
      barcode: row.barcode,
      sku: row.sku,
      product_id: row.id,
      price: parseFloat(row.price || 0),
      cost: parseFloat(row.cost || 0),
      effective_date: new Date().toISOString()
    }));
    
    // Send to branch
    const result = await BranchApiService.makeRequest({
      branchId,
      endpoint: 'chain-core/products/prices',
      method: 'PUT',
      data: { updates },
      timeout: 60000
    });
    
    res.json({
      success: result.success,
      data: {
        sync_type: 'prices',
        branch_id: branchId,
        branch_name: branchCheck.rows[0].name,
        total_price_updates: updates.length,
        sync_result: result.success ? result.data : null,
        error: result.error
      }
    });
    
  } catch (error) {
    console.error('Error syncing prices to branch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync prices to branch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

// POST /api/sync/promotions/branch/:branchId - Sync promotions to specific branch
router.post('/promotions/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    
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
    
    // Get active promotions for this branch (both branch-specific and chain-wide)
    const promotionsQuery = `
      SELECT 
        p.id, p.name, p.description, p.type, p.branch_id, p.product_id, p.category_id,
        p.discount_percentage, p.discount_amount, p.min_quantity, p.buy_quantity, p.get_quantity,
        p.start_date, p.end_date, p.is_active,
        pr.barcode as product_barcode, pr.sku as product_sku,
        c.key as category_key
      FROM promotions p
      LEFT JOIN products pr ON p.product_id = pr.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true 
        AND p.start_date <= NOW() 
        AND p.end_date >= NOW()
        AND (p.branch_id = $1 OR p.branch_id IS NULL)
      ORDER BY p.start_date DESC
    `;
    
    const promotionsResult = await DatabaseManager.query(promotionsQuery, [branchId]);
    
    // Note: For this implementation, we'll log the promotions that would be synced
    // Branch-core doesn't currently have a promotions sync endpoint, but this shows the data structure
    const promotions = promotionsResult.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      product_barcode: row.product_barcode,
      product_sku: row.product_sku,
      category_key: row.category_key,
      discount_percentage: row.discount_percentage,
      discount_amount: row.discount_amount,
      min_quantity: row.min_quantity,
      buy_quantity: row.buy_quantity,
      get_quantity: row.get_quantity,
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active
    }));
    
    // Send to branch
    const result = await BranchApiService.makeRequest({
      branchId,
      endpoint: 'chain-core/promotions/sync',
      method: 'POST',
      data: { promotions },
      timeout: 60000
    });
    
    res.json({
      success: result.success,
      data: {
        sync_type: 'promotions',
        branch_id: branchId,
        branch_name: branchCheck.rows[0].name,
        total_promotions: promotions.length,
        sync_result: result.success ? result.data : null,
        error: result.error
      }
    });
    
  } catch (error) {
    console.error('Error syncing promotions to branch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync promotions to branch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

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
