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

// POST /api/sync/prices/branch/:branchId - Sync only changed prices to specific branch
router.post('/prices/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { branchId } = req.params;
    const { force_all = false } = req.body; // Option to force sync all products
    
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
    
    let updates: any[] = [];
    let totalChecked = 0;
    
    if (force_all) {
      // Force sync all products (original behavior)
      console.log(`🔄 [PRICE SYNC] Force sync all products for branch ${branchId}`);
      const allProductsQuery = `
        SELECT 
          p.id, p.sku, p.barcode,
          COALESCE(bpp.price, p.base_price) as price,
          COALESCE(bpp.cost, p.cost) as cost
        FROM products p
        LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
        WHERE p.is_active = true AND p.barcode IS NOT NULL
        ORDER BY p.name
      `;
      
      const priceResult = await DatabaseManager.query(allProductsQuery, [branchId]);
      totalChecked = priceResult.rows.length;
      
      updates = priceResult.rows.map((row: any) => ({
        barcode: row.barcode,
        sku: row.sku,
        product_id: row.id,
        price: parseFloat(row.price || 0),
        cost: parseFloat(row.cost || 0),
        effective_date: new Date().toISOString()
      }));
      
      console.log(`🔄 [PRICE SYNC] Force sync: Found ${updates.length} products to sync`);
    } else {
      // Only sync products that have changed prices (new optimized behavior)
      console.log(`🔄 [PRICE SYNC] Optimized sync: checking for changed prices for branch ${branchId}`);
      
      // Check if the sync tracking table exists and has data
      try {
        const trackingTableCheck = await DatabaseManager.query(`
          SELECT COUNT(*) as total_entries, 
                 COUNT(CASE WHEN needs_sync = true THEN 1 END) as needs_sync_count
          FROM branch_product_price_sync_status 
          WHERE branch_id = $1
        `, [branchId]);
        
        console.log(`🔄 [PRICE SYNC] Sync tracking table status:`, trackingTableCheck.rows[0]);
        
        // If no entries exist, fall back to force_all mode
        if (trackingTableCheck.rows[0]?.total_entries === '0') {
          console.warn(`⚠️  [PRICE SYNC] No sync tracking entries found for branch ${branchId}, falling back to force_all mode`);
          const allProductsQuery = `
            SELECT 
              p.id, p.sku, p.barcode,
              COALESCE(bpp.price, p.base_price) as price,
              COALESCE(bpp.cost, p.cost) as cost
            FROM products p
            LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
            WHERE p.is_active = true AND p.barcode IS NOT NULL
            ORDER BY p.name
          `;
          
          const priceResult = await DatabaseManager.query(allProductsQuery, [branchId]);
          totalChecked = priceResult.rows.length;
          
          updates = priceResult.rows.map((row: any) => ({
            barcode: row.barcode,
            sku: row.sku,
            product_id: row.id,
            price: parseFloat(row.price || 0),
            cost: parseFloat(row.cost || 0),
            effective_date: new Date().toISOString()
          }));
          
          console.log(`🔄 [PRICE SYNC] Fallback mode: Found ${updates.length} products to sync`);
        } else {
          // Proceed with original optimized sync logic
          // First, check for duplicates in the sync status table
          const duplicateCheck = await DatabaseManager.query(`
            SELECT product_id, COUNT(*) as count
            FROM branch_product_price_sync_status 
            WHERE branch_id = $1 AND needs_sync = true
            GROUP BY product_id 
            HAVING COUNT(*) > 1
          `, [branchId]);
          
          if (duplicateCheck.rows.length > 0) {
            console.warn(`⚠️  [PRICE SYNC] WARNING: Found duplicate entries in sync status table:`, duplicateCheck.rows);
          }
          
          const changedPricesResult = await DatabaseManager.query(
            'SELECT * FROM get_products_needing_price_sync($1)',
            [branchId]
          );
          
          totalChecked = changedPricesResult.rows.length;
          console.log(`🔄 [PRICE SYNC] Found ${totalChecked} products needing sync`);
          
          if (totalChecked > 0) {
            // Check for duplicates in the database result
            const productIds = changedPricesResult.rows.map((row: any) => row.product_id);
            const uniqueProductIds = [...new Set(productIds)];
            if (productIds.length !== uniqueProductIds.length) {
              console.warn(`⚠️  [PRICE SYNC] WARNING: Database function returned duplicate products! Total: ${productIds.length}, Unique: ${uniqueProductIds.length}`);
            }
            
            console.log(`🔄 [PRICE SYNC] Products needing sync:`, changedPricesResult.rows.map((row: any) => ({
              sku: row.sku,
              barcode: row.barcode,
              product_id: row.product_id,
              current_price: row.current_price,
              last_synced_price: row.last_synced_price,
              price_changed_at: row.price_changed_at
            })));
          }
          
          updates = changedPricesResult.rows.map((row: any) => ({
            barcode: row.barcode,
            sku: row.sku,
            product_id: row.product_id,
            price: parseFloat(row.current_price || 0),
            cost: parseFloat(row.current_cost || 0),
            effective_date: new Date().toISOString()
          }));
          
          // Remove duplicates based on barcode just in case
          const seen = new Set();
          updates = updates.filter((update: any) => {
            if (seen.has(update.barcode)) {
              console.warn(`⚠️  [PRICE SYNC] Removing duplicate update for barcode: ${update.barcode}`);
              return false;
            }
            seen.add(update.barcode);
            return true;
          });
        }
      } catch (error) {
        console.error(`❌ [PRICE SYNC] Error checking sync tracking table, falling back to force_all mode:`, error);
        // Fall back to force_all behavior if tracking table doesn't exist
        const allProductsQuery = `
          SELECT 
            p.id, p.sku, p.barcode,
            COALESCE(bpp.price, p.base_price) as price,
            COALESCE(bpp.cost, p.cost) as cost
          FROM products p
          LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
          WHERE p.is_active = true AND p.barcode IS NOT NULL
          ORDER BY p.name
        `;
        
        const priceResult = await DatabaseManager.query(allProductsQuery, [branchId]);
        totalChecked = priceResult.rows.length;
        
        updates = priceResult.rows.map((row: any) => ({
          barcode: row.barcode,
          sku: row.sku,
          product_id: row.id,
          price: parseFloat(row.price || 0),
          cost: parseFloat(row.cost || 0),
          effective_date: new Date().toISOString()
        }));
        
        console.log(`🔄 [PRICE SYNC] Error fallback mode: Found ${updates.length} products to sync`);
      }
    }
    
    let result: any = { success: true, data: null, error: null };
    let syncedCount = 0;
    
    if (updates.length > 0) {
      console.log(`📤 [PRICE SYNC] Sending ${updates.length} price updates to branch ${branchId}:`);
      
      // Log the first few updates for debugging
      const loggedUpdates = updates.slice(0, 5);
      console.log(`📤 [PRICE SYNC] Sample updates:`, loggedUpdates);
      
      if (updates.length > 5) {
        console.log(`📤 [PRICE SYNC] ... and ${updates.length - 5} more updates`);
      }
      
      // Check for duplicates
      const barcodes = updates.map(u => u.barcode);
      const uniqueBarcodes = [...new Set(barcodes)];
      if (barcodes.length !== uniqueBarcodes.length) {
        console.warn(`⚠️  [PRICE SYNC] WARNING: Found duplicate barcodes! Total updates: ${barcodes.length}, Unique barcodes: ${uniqueBarcodes.length}`);
        console.warn(`⚠️  [PRICE SYNC] Duplicate analysis:`, barcodes.filter((barcode, index) => barcodes.indexOf(barcode) !== index));
      }
      
      // Send to branch
      result = await BranchApiService.makeRequest({
        branchId,
        endpoint: 'chain-core/products/prices',
        method: 'PUT',
        data: { updates },
        timeout: 60000
      });
      
      console.log(`📤 [PRICE SYNC] Branch sync result:`, {
        success: result.success,
        error: result.error,
        data: result.data
      });
      
      // If sync was successful, mark products as synced
      if (result.success) {
        const productIds = updates.map(u => u.product_id);
        const syncedCountResult = await DatabaseManager.query(
          'SELECT mark_products_as_synced($1, $2)',
          [branchId, productIds]
        );
        syncedCount = syncedCountResult.rows[0]?.mark_products_as_synced || 0;
        
        // Update the last_synced_price and last_synced_cost for tracking
        for (const update of updates) {
          await DatabaseManager.query(`
            UPDATE branch_product_price_sync_status 
            SET last_synced_price = $1, last_synced_cost = $2, updated_at = NOW()
            WHERE branch_id = $3 AND product_id = $4
          `, [update.price, update.cost, branchId, update.product_id]);
        }
      }
    }
    
    res.json({
      success: result.success,
      data: {
        sync_type: 'prices',
        branch_id: branchId,
        branch_name: branchCheck.rows[0].name,
        total_products_checked: totalChecked,
        products_needing_sync: updates.length,
        products_synced: syncedCount,
        force_all_enabled: force_all,
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
