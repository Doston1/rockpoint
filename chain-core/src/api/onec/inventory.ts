import axios from 'axios';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const inventoryUpdateSchema = z.object({
  updates: z.array(z.object({
    barcode: z.string().min(1), // Use barcode as primary identifier
    oneC_id: z.string().optional(),
    sku: z.string().optional(),
    branch_code: z.string(),
    quantity_in_stock: z.number().min(0),
    min_stock_level: z.number().min(0).optional(),
    max_stock_level: z.number().min(0).optional()
  })).min(1)
});

const stockMovementSchema = z.object({
  movements: z.array(z.object({
    product_barcode: z.string().optional(),
    product_sku: z.string().optional(),
    product_id: z.string().optional(),
    branch_code: z.string(),
    movement_type: z.enum(['in', 'out', 'transfer', 'adjustment', 'loss', 'damaged']),
    quantity: z.number(),
    unit_cost: z.number().min(0).optional(),
    reference_type: z.enum(['purchase', 'sale', 'transfer', 'adjustment', 'return', 'inventory_count']).optional(),
    reference_id: z.string().optional(),
    notes: z.string().optional(),
    movement_date: z.string().optional(),
    employee_id: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })).min(1)
});

// ============================================================================
// INVENTORY MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/inventory - Get inventory levels
router.get('/', requirePermission('inventory:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 100, 
    branch_code,
    low_stock,
    out_of_stock,
    search,
    category_key
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      bi.id, bi.quantity_in_stock, bi.min_stock_level, bi.max_stock_level,
      bi.last_updated, bi.updated_at,
      p.id as product_id, p.sku, p.barcode, p.name, p.name_ru, p.name_uz,
      p.base_price, p.cost, p.unit_of_measure,
      b.code as branch_code, b.name as branch_name,
      c.key as category_key, c.name as category_name,
      bpp.price as branch_price, bpp.cost as branch_cost,
      CASE 
        WHEN bi.quantity_in_stock = 0 THEN 'out_of_stock'
        WHEN bi.quantity_in_stock <= bi.min_stock_level THEN 'low_stock'
        WHEN bi.quantity_in_stock >= bi.max_stock_level THEN 'overstocked'
        ELSE 'normal'
      END as stock_status
    FROM branch_inventory bi
    LEFT JOIN products p ON bi.product_id = p.id
    LEFT JOIN branches b ON bi.branch_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON bi.branch_id = bpp.branch_id AND bi.product_id = bpp.product_id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (category_key) {
    params.push(category_key);
    query += ` AND c.key = $${params.length}`;
  }
  
  if (low_stock === 'true') {
    query += ` AND bi.quantity_in_stock <= bi.min_stock_level AND bi.quantity_in_stock > 0`;
  }
  
  if (out_of_stock === 'true') {
    query += ` AND bi.quantity_in_stock = 0`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
  }
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY b.name ASC, p.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      inventory: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/inventory/summary - Get inventory summary
router.get('/summary', requirePermission('inventory:read'), asyncHandler(async (req: Request, res: Response) => {
  const { branch_code } = req.query;
  
  let query = `
    SELECT 
      b.code as branch_code,
      b.name as branch_name,
      COUNT(bi.id) as total_products,
      SUM(bi.quantity_in_stock) as total_stock_quantity,
      SUM(bi.quantity_in_stock * COALESCE(bpp.cost, p.cost)) as total_stock_value,
      COUNT(CASE WHEN bi.quantity_in_stock = 0 THEN 1 END) as out_of_stock_count,
      COUNT(CASE WHEN bi.quantity_in_stock <= bi.min_stock_level AND bi.quantity_in_stock > 0 THEN 1 END) as low_stock_count,
      COUNT(CASE WHEN bi.quantity_in_stock >= bi.max_stock_level THEN 1 END) as overstocked_count
    FROM branches b
    LEFT JOIN branch_inventory bi ON b.id = bi.branch_id
    LEFT JOIN products p ON bi.product_id = p.id
    LEFT JOIN branch_product_pricing bpp ON bi.branch_id = bpp.branch_id AND bi.product_id = bpp.product_id
    WHERE b.is_active = true
  `;
  
  const params: any[] = [];
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  query += ` GROUP BY b.id, b.code, b.name ORDER BY b.name ASC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      inventory_summary: result.rows
    }
  });
}));

// GET /api/1c/inventory/branch/:code - Get inventory for specific branch
router.get('/branch/:code', requirePermission('inventory:read'), asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const { 
    page = 1, 
    limit = 100, 
    low_stock,
    out_of_stock,
    search,
    category_key 
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  // Find branch
  const branchResult = await DatabaseManager.query(
    'SELECT id, name FROM branches WHERE code = $1',
    [code]
  );
  
  if (branchResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  const branch = branchResult.rows[0];
  
  let query = `
    SELECT 
      bi.id, bi.quantity_in_stock, bi.min_stock_level, bi.max_stock_level,
      bi.last_updated, bi.updated_at,
      p.id as product_id, p.sku, p.barcode, p.name, p.name_ru, p.name_uz,
      p.base_price, p.cost, p.unit_of_measure,
      c.key as category_key, c.name as category_name,
      bpp.price as branch_price, bpp.cost as branch_cost,
      CASE 
        WHEN bi.quantity_in_stock = 0 THEN 'out_of_stock'
        WHEN bi.quantity_in_stock <= bi.min_stock_level THEN 'low_stock'
        WHEN bi.quantity_in_stock >= bi.max_stock_level THEN 'overstocked'
        ELSE 'normal'
      END as stock_status
    FROM branch_inventory bi
    LEFT JOIN products p ON bi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON bi.branch_id = bpp.branch_id AND bi.product_id = bpp.product_id
    WHERE bi.branch_id = $1
  `;
  
  const params: any[] = [branch.id];
  
  if (category_key) {
    params.push(category_key);
    query += ` AND c.key = $${params.length}`;
  }
  
  if (low_stock === 'true') {
    query += ` AND bi.quantity_in_stock <= bi.min_stock_level AND bi.quantity_in_stock > 0`;
  }
  
  if (out_of_stock === 'true') {
    query += ` AND bi.quantity_in_stock = 0`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
  }
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY p.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      branch: {
        code: code,
        name: branch.name
      },
      inventory: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// PUT /api/1c/inventory - Update inventory levels from 1C
router.put('/', requirePermission('inventory:write'), asyncHandler(async (req: Request, res: Response) => {
  const { updates } = inventoryUpdateSchema.parse(req.body);
  
  const syncId = await createSyncLog('inventory', 'update', updates.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const update of updates) {
      try {
        // Find branch
        const branchResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1',
          [update.branch_code]
        );
        
        if (branchResult.rows.length === 0) {
          throw new Error(`Branch with code "${update.branch_code}" not found`);
        }
        
        const branchId = branchResult.rows[0].id;
        
        // Find product by barcode (primary), then oneC_id, then SKU
        let productQuery = 'SELECT id FROM products WHERE ';
        let productParam;
        
        if (update.barcode) {
          productQuery += 'barcode = $1';
          productParam = update.barcode;
        } else if (update.oneC_id) {
          productQuery += 'oneC_id = $1';
          productParam = update.oneC_id;
        } else if (update.sku) {
          productQuery += 'sku = $1';
          productParam = update.sku;
        } else {
          throw new Error('Must provide barcode, oneC_id, or sku');
        }
        
        const productResult = await DatabaseManager.query(productQuery, [productParam]);
        
        if (productResult.rows.length === 0) {
          throw new Error('Product not found');
        }
        
        const productId = productResult.rows[0].id;
        
        // Update or insert inventory
        await DatabaseManager.query(`
          INSERT INTO branch_inventory (branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level, last_updated, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (branch_id, product_id) 
          DO UPDATE SET 
            quantity_in_stock = $3,
            min_stock_level = COALESCE($4, branch_inventory.min_stock_level),
            max_stock_level = COALESCE($5, branch_inventory.max_stock_level),
            last_updated = NOW(),
            updated_at = NOW()
        `, [
          branchId, productId, update.quantity_in_stock, 
          update.min_stock_level, update.max_stock_level
        ]);
        
        // Send update to branch
        await sendInventoryUpdateToBranch(update.branch_code, {
          product_id: productId,
          barcode: update.barcode,
          sku: update.sku,
          quantity_in_stock: update.quantity_in_stock,
          min_stock_level: update.min_stock_level,
          max_stock_level: update.max_stock_level
        });
        
        results.push({
          barcode: update.barcode,
          sku: update.sku,
          oneC_id: update.oneC_id,
          branch_code: update.branch_code,
          success: true,
          new_quantity: update.quantity_in_stock
        });
        
      } catch (error) {
        results.push({
          barcode: update.barcode,
          sku: update.sku,
          oneC_id: update.oneC_id,
          branch_code: update.branch_code,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        updated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// ============================================================================
// STOCK MOVEMENTS ENDPOINTS
// ============================================================================

// GET /api/1c/stock-movements - Get stock movement history
router.get('/stock-movements', requirePermission('inventory:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 100, 
    branch_code,
    product_id,
    movement_type,
    start_date,
    end_date
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      sm.id, sm.movement_type, sm.quantity, sm.unit_cost,
      sm.reference_type, sm.reference_id, sm.notes,
      sm.movement_date, sm.metadata, sm.created_at,
      p.id as product_id, p.sku, p.barcode, p.name,
      b.code as branch_code, b.name as branch_name,
      e.employee_id, e.name as employee_name
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
    LEFT JOIN branches b ON sm.branch_id = b.id
    LEFT JOIN employees e ON sm.employee_id = e.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (product_id) {
    params.push(product_id);
    query += ` AND (p.id = $${params.length} OR p.sku = $${params.length} OR p.barcode = $${params.length})`;
  }
  
  if (movement_type) {
    params.push(movement_type);
    query += ` AND sm.movement_type = $${params.length}`;
  }
  
  if (start_date) {
    params.push(start_date);
    query += ` AND sm.movement_date >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND sm.movement_date <= $${params.length}`;
  }
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY sm.movement_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      stock_movements: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// POST /api/1c/stock-movements - Record stock movements
router.post('/stock-movements', requirePermission('inventory:write'), asyncHandler(async (req: Request, res: Response) => {
  const { movements } = stockMovementSchema.parse(req.body);
  
  const syncId = await createSyncLog('stock_movements', 'import', movements.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const movement of movements) {
      try {
        // Find branch
        const branchResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1',
          [movement.branch_code]
        );
        
        if (branchResult.rows.length === 0) {
          throw new Error(`Branch with code "${movement.branch_code}" not found`);
        }
        
        const branchId = branchResult.rows[0].id;
        
        // Find product
        let productQuery = 'SELECT id FROM products WHERE ';
        let productParam;
        
        if (movement.product_barcode) {
          productQuery += 'barcode = $1';
          productParam = movement.product_barcode;
        } else if (movement.product_sku) {
          productQuery += 'sku = $1';
          productParam = movement.product_sku;
        } else if (movement.product_id) {
          productQuery += 'id = $1';
          productParam = movement.product_id;
        } else {
          throw new Error('Must provide product_barcode, product_sku, or product_id');
        }
        
        const productResult = await DatabaseManager.query(productQuery, [productParam]);
        
        if (productResult.rows.length === 0) {
          throw new Error('Product not found');
        }
        
        const productId = productResult.rows[0].id;
        
        // Find employee if provided
        let employeeId = null;
        if (movement.employee_id) {
          const employeeResult = await DatabaseManager.query(
            'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
            [movement.employee_id, branchId]
          );
          
          if (employeeResult.rows.length > 0) {
            employeeId = employeeResult.rows[0].id;
          }
        }
        
        // Create stock movement record
        const movementResult = await DatabaseManager.query(`
          INSERT INTO stock_movements (
            product_id, branch_id, employee_id, movement_type, quantity,
            unit_cost, reference_type, reference_id, notes,
            movement_date, metadata, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
          ) RETURNING id
        `, [
          productId, branchId, employeeId, movement.movement_type, movement.quantity,
          movement.unit_cost, movement.reference_type, movement.reference_id, movement.notes,
          movement.movement_date || new Date().toISOString(), JSON.stringify(movement.metadata || {})
        ]);
        
        const movementId = movementResult.rows[0].id;
        
        // Update inventory quantity
        const quantityChange = movement.movement_type === 'in' ? movement.quantity : -movement.quantity;
        
        await DatabaseManager.query(`
          UPDATE branch_inventory 
          SET 
            quantity_in_stock = quantity_in_stock + $1,
            last_updated = NOW(),
            updated_at = NOW()
          WHERE branch_id = $2 AND product_id = $3
        `, [quantityChange, branchId, productId]);
        
        results.push({
          product_id: movement.product_id,
          product_barcode: movement.product_barcode,
          product_sku: movement.product_sku,
          branch_code: movement.branch_code,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          success: true,
          movement_id: movementId
        });
        
      } catch (error) {
        results.push({
          product_id: movement.product_id,
          product_barcode: movement.product_barcode,
          product_sku: movement.product_sku,
          branch_code: movement.branch_code,
          movement_type: movement.movement_type,
          quantity: movement.quantity,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        recorded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createSyncLog(syncType: string, direction: string, totalRecords: number): Promise<string> {
  const result = await DatabaseManager.query(`
    INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
    VALUES ($1, $2, 'in_progress', $3, NOW())
    RETURNING id
  `, [syncType, direction, totalRecords]);
  
  return result.rows[0].id;
}

async function completeSyncLog(
  syncId: string, 
  status: string, 
  recordsProcessed: number, 
  errorMessage?: string
): Promise<void> {
  await DatabaseManager.query(`
    UPDATE onec_sync_logs 
    SET status = $1, records_processed = $2, error_message = $3, completed_at = NOW()
    WHERE id = $4
  `, [status, recordsProcessed, errorMessage, syncId]);
}

async function getBranchApiEndpoint(branchCode: string): Promise<{ endpoint: string; apiKey: string } | null> {
  const result = await DatabaseManager.query(`
    SELECT api_endpoint, api_key 
    FROM branches 
    WHERE code = $1 AND is_active = true
  `, [branchCode]);
  
  if (result.rows.length === 0) return null;
  
  return {
    endpoint: result.rows[0].api_endpoint,
    apiKey: result.rows[0].api_key
  };
}

async function sendInventoryUpdateToBranch(branchCode: string, inventoryUpdate: any): Promise<void> {
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.put(`${branchApi.endpoint}/api/chain-core/inventory`, {
      updates: [inventoryUpdate]
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error(`Failed to send inventory update to branch ${branchCode}:`, error);
    throw error;
  }
}

export default router;
