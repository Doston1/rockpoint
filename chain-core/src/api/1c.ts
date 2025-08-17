import axios from 'axios';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { authenticateApiKey, requirePermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas for 1C data
const productSchema = z.object({
  oneC_id: z.string(),
  sku: z.string(),
  barcode: z.string().optional(),
  name: z.string(),
  name_ru: z.string().optional(),
  name_uz: z.string().optional(),
  description: z.string().optional(),
  description_ru: z.string().optional(),
  description_uz: z.string().optional(),
  category_key: z.string().optional(),
  brand: z.string().optional(),
  unit_of_measure: z.string().default('pcs'),
  base_price: z.number().positive(),
  cost: z.number().positive(),
  tax_rate: z.number().min(0).max(1).default(0),
  image_url: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  attributes: z.record(z.any()).optional(),
  is_active: z.boolean().default(true)
});

const employeeSchema = z.object({
  oneC_id: z.string(),
  employee_id: z.string(),
  branch_code: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'manager', 'supervisor', 'cashier']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  hire_date: z.string().optional(),
  salary: z.number().positive().optional(),
  status: z.enum(['active', 'inactive', 'terminated']).default('active')
});

const priceUpdateSchema = z.object({
  updates: z.array(z.object({
    barcode: z.string().min(1), // Use barcode as primary identifier
    oneC_id: z.string().optional(),
    sku: z.string().optional(),
    base_price: z.number().positive(),
    cost: z.number().positive().optional(),
    branch_codes: z.array(z.string()).optional(), // If empty, applies to all branches
    effective_date: z.string().optional()
  })).min(1)
});

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

const syncRequestSchema = z.object({
  entity_type: z.enum(['products', 'transactions', 'inventory', 'employees', 'all']),
  branch_codes: z.array(z.string()).optional(),
  force_sync: z.boolean().default(false),
});

const oneCDataSchema = z.object({
  entity_type: z.string(),
  data: z.array(z.any()),
  sync_timestamp: z.string(),
});

// ============================================================================
// PRODUCT MANAGEMENT ENDPOINTS
// ============================================================================

// POST /api/1c/products - Create or update products from 1C
router.post('/products', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const products = z.array(productSchema).parse(req.body);
  
  const syncId = await createSyncLog('products', 'import', products.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const productData of products) {
      try {
        // Check if category exists, create if not
        let categoryId = null;
        if (productData.category_key) {
          const categoryResult = await DatabaseManager.query(
            'SELECT id FROM categories WHERE key = $1',
            [productData.category_key]
          );
          
          if (categoryResult.rows.length === 0) {
            // Create category if it doesn't exist
            const newCategory = await DatabaseManager.query(`
              INSERT INTO categories (key, name, onec_id) 
              VALUES ($1, $2, $3) 
              RETURNING id
            `, [productData.category_key, productData.category_key, productData.category_key]);
            categoryId = newCategory.rows[0].id;
          } else {
            categoryId = categoryResult.rows[0].id;
          }
        }
        
        // Upsert product
        const result = await DatabaseManager.query(`
          INSERT INTO products (
            sku, barcode, name, name_ru, name_uz, description, description_ru, description_uz,
            category_id, brand, unit_of_measure, base_price, cost, tax_rate,
            image_url, images, attributes, is_active, onec_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
          ON CONFLICT (barcode) DO UPDATE SET
            sku = EXCLUDED.sku,
            name = EXCLUDED.name,
            name_ru = EXCLUDED.name_ru,
            name_uz = EXCLUDED.name_uz,
            description = EXCLUDED.description,
            description_ru = EXCLUDED.description_ru,
            description_uz = EXCLUDED.description_uz,
            category_id = EXCLUDED.category_id,
            brand = EXCLUDED.brand,
            unit_of_measure = EXCLUDED.unit_of_measure,
            base_price = EXCLUDED.base_price,
            cost = EXCLUDED.cost,
            tax_rate = EXCLUDED.tax_rate,
            image_url = EXCLUDED.image_url,
            images = EXCLUDED.images,
            attributes = EXCLUDED.attributes,
            is_active = EXCLUDED.is_active,
            onec_id = EXCLUDED.onec_id,
            updated_at = NOW()
          RETURNING id, sku, barcode, name
        `, [
          productData.sku, productData.barcode, productData.name, productData.name_ru, productData.name_uz,
          productData.description, productData.description_ru, productData.description_uz,
          categoryId, productData.brand, productData.unit_of_measure, productData.base_price,
          productData.cost, productData.tax_rate, productData.image_url, productData.images,
          productData.attributes, productData.is_active, productData.oneC_id
        ]);
        
        results.push({
          success: true,
          product_id: result.rows[0].id,
          sku: result.rows[0].sku,
          barcode: result.rows[0].barcode,
          name: result.rows[0].name,
          action: 'created/updated'
        });
        
        // Sync to all active branches
        await syncProductToBranches(result.rows[0].id);
        
      } catch (error) {
        console.error('Error processing product:', error);
        results.push({
          success: false,
          sku: productData.sku,
          error: (error as Error).message || 'Unknown error'
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
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message || 'Unknown error');
    throw error;
  }
}));

// PUT /api/1c/products/prices - Update product prices across branches
router.put('/products/prices', requirePermission('products:write'), asyncHandler(async (req: Request, res: Response) => {
  const { updates } = priceUpdateSchema.parse(req.body);
  
  const syncId = await createSyncLog('products', 'price_update', updates.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const update of updates) {
      try {
        // Find product by barcode (primary), fallback to oneC_id or SKU
        let productQuery: string;
        let identifier: string;
        
        if (update.barcode) {
          productQuery = 'SELECT id, sku, barcode FROM products WHERE barcode = $1';
          identifier = update.barcode;
        } else if (update.oneC_id) {
          productQuery = 'SELECT id, sku, barcode FROM products WHERE onec_id = $1';
          identifier = update.oneC_id;
        } else if (update.sku) {
          productQuery = 'SELECT id, sku, barcode FROM products WHERE sku = $1';
          identifier = update.sku;
        } else {
          results.push({
            success: false,
            identifier: 'unknown',
            error: 'No valid identifier provided (barcode, oneC_id, or sku)'
          });
          continue;
        }
        
        const productResult = await DatabaseManager.query(productQuery, [identifier]);
        
        if (productResult.rows.length === 0) {
          results.push({
            success: false,
            identifier,
            error: 'Product not found'
          });
          continue;
        }
        
        const product = productResult.rows[0];
        
        // Update base price in products table
        await DatabaseManager.query(`
          UPDATE products 
          SET base_price = $1, cost = COALESCE($2, cost), updated_at = NOW()
          WHERE id = $3
        `, [update.base_price, update.cost, product.id]);
        
        // Get target branches
        let branchCodes = update.branch_codes;
        if (!branchCodes || branchCodes.length === 0) {
          // Apply to all active branches
          const branchResult = await DatabaseManager.query(
            'SELECT code FROM branches WHERE is_active = true'
          );
          branchCodes = branchResult.rows.map((b: any) => b.code);
        }
        
        // Update branch-specific pricing
        for (const branchCode of branchCodes!) {
          const branchResult = await DatabaseManager.query(
            'SELECT id FROM branches WHERE code = $1 AND is_active = true',
            [branchCode]
          );
          
          if (branchResult.rows.length > 0) {
            const branchId = branchResult.rows[0].id;
            
            // Upsert branch pricing
            await DatabaseManager.query(`
              INSERT INTO branch_product_pricing (branch_id, product_id, price, cost, effective_from)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (branch_id, product_id) DO UPDATE SET
                price = EXCLUDED.price,
                cost = EXCLUDED.cost,
                effective_from = EXCLUDED.effective_from,
                updated_at = NOW()
            `, [
              branchId, 
              product.id, 
              update.base_price, 
              update.cost,
              update.effective_date ? new Date(update.effective_date) : new Date()
            ]);
            
            // Send price update to branch
            await sendPriceUpdateToBranch(branchCode, {
              barcode: product.barcode,
              sku: product.sku,
              price: update.base_price,
              cost: update.cost,
              effective_date: update.effective_date
            });
          }
        }
        
        results.push({
          success: true,
          sku: product.sku,
          barcode: product.barcode,
          new_price: update.base_price,
          branches_updated: branchCodes!.length
        });
        
      } catch (error) {
        console.error('Error updating price:', error);
        results.push({
          success: false,
          identifier: update.oneC_id || update.sku,
          error: (error as Error).message || 'Unknown error'
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
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message || 'Unknown error');
    throw error;
  }
}));

// ============================================================================
// INVENTORY MANAGEMENT ENDPOINTS
// ============================================================================

// PUT /api/1c/inventory - Update inventory levels from 1C
router.put('/inventory', requirePermission('inventory:write'), asyncHandler(async (req: Request, res: Response) => {
  const { updates } = inventoryUpdateSchema.parse(req.body);
  
  const syncId = await createSyncLog('inventory', 'update', updates.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const update of updates) {
      try {
        // Find product by barcode (primary), fallback to oneC_id or SKU
        let productQuery: string;
        let identifier: string;
        
        if (update.barcode) {
          productQuery = 'SELECT id, sku, barcode FROM products WHERE barcode = $1';
          identifier = update.barcode;
        } else if (update.oneC_id) {
          productQuery = 'SELECT id, sku, barcode FROM products WHERE onec_id = $1';
          identifier = update.oneC_id;
        } else if (update.sku) {
          productQuery = 'SELECT id, sku, barcode FROM products WHERE sku = $1';
          identifier = update.sku;
        } else {
          results.push({
            success: false,
            identifier: 'unknown',
            error: 'No valid identifier provided (barcode, oneC_id, or sku)'
          });
          continue;
        }
        
        const productResult = await DatabaseManager.query(productQuery, [identifier]);
        
        if (productResult.rows.length === 0) {
          results.push({
            success: false,
            identifier,
            error: 'Product not found'
          });
          continue;
        }
        
        // Find branch
        const branchResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1 AND is_active = true',
          [update.branch_code]
        );
        
        if (branchResult.rows.length === 0) {
          results.push({
            success: false,
            identifier,
            branch_code: update.branch_code,
            error: 'Branch not found or inactive'
          });
          continue;
        }
        
        const product = productResult.rows[0];
        const branchId = branchResult.rows[0].id;
        
        // Update inventory in chain-core database
        await DatabaseManager.query(`
          INSERT INTO branch_inventory (
            branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (branch_id, product_id) DO UPDATE SET
            quantity_in_stock = EXCLUDED.quantity_in_stock,
            min_stock_level = COALESCE(EXCLUDED.min_stock_level, branch_inventory.min_stock_level),
            max_stock_level = COALESCE(EXCLUDED.max_stock_level, branch_inventory.max_stock_level),
            updated_at = NOW()
        `, [
          branchId,
          product.id,
          update.quantity_in_stock,
          update.min_stock_level,
          update.max_stock_level
        ]);
        
        // Send inventory update to branch
        await sendInventoryUpdateToBranch(update.branch_code, {
          barcode: product.barcode,
          sku: product.sku,
          quantity_adjustment: update.quantity_in_stock,
          adjustment_type: 'set',
          reason: '1C sync'
        });
        
        results.push({
          success: true,
          sku: product.sku,
          barcode: product.barcode,
          branch_code: update.branch_code,
          new_quantity: update.quantity_in_stock
        });
        
      } catch (error) {
        console.error('Error updating inventory:', error);
        results.push({
          success: false,
          identifier: update.barcode || update.oneC_id || update.sku,
          branch_code: update.branch_code,
          error: (error as Error).message || 'Unknown error'
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
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message || 'Unknown error');
    throw error;
  }
}));

// ============================================================================
// EMPLOYEE MANAGEMENT ENDPOINTS
// ============================================================================

// POST /api/1c/employees - Create or update employees from 1C
router.post('/employees', requirePermission('employees:write'), asyncHandler(async (req: Request, res: Response) => {
  const employees = z.array(employeeSchema).parse(req.body);
  
  const syncId = await createSyncLog('employees', 'import', employees.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const employeeData of employees) {
      try {
        // Find branch
        const branchResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1 AND is_active = true',
          [employeeData.branch_code]
        );
        
        if (branchResult.rows.length === 0) {
          results.push({
            success: false,
            employee_id: employeeData.employee_id,
            error: 'Branch not found or inactive'
          });
          continue;
        }
        
        const branchId = branchResult.rows[0].id;
        
        // Upsert employee
        const result = await DatabaseManager.query(`
          INSERT INTO employees (
            employee_id, branch_id, name, role, phone, email, hire_date, salary, status, onec_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (employee_id, branch_id) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            hire_date = EXCLUDED.hire_date,
            salary = EXCLUDED.salary,
            status = EXCLUDED.status,
            onec_id = EXCLUDED.onec_id,
            updated_at = NOW()
          RETURNING id, employee_id, name
        `, [
          employeeData.employee_id,
          branchId,
          employeeData.name,
          employeeData.role,
          employeeData.phone,
          employeeData.email,
          employeeData.hire_date ? new Date(employeeData.hire_date) : null,
          employeeData.salary,
          employeeData.status,
          employeeData.oneC_id
        ]);
        
        // Send employee data to branch
        await sendEmployeeDataToBranch(employeeData.branch_code, {
          employee_id: employeeData.employee_id,
          name: employeeData.name,
          role: employeeData.role,
          status: employeeData.status
        });
        
        results.push({
          success: true,
          employee_id: result.rows[0].employee_id,
          name: result.rows[0].name,
          branch_code: employeeData.branch_code,
          action: 'created/updated'
        });
        
      } catch (error) {
        console.error('Error processing employee:', error);
        results.push({
          success: false,
          employee_id: employeeData.employee_id,
          error: (error as Error).message || 'Unknown error'
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
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message || 'Unknown error');
    throw error;
  }
}));

// ============================================================================
// SYNC AND STATUS ENDPOINTS
// ============================================================================

// GET /api/1c/status - Get 1C integration status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  // Check last sync status from database
  const lastSyncQuery = `
    SELECT 
      sync_type,
      direction,
      status,
      records_processed,
      error_message,
      started_at,
      completed_at
    FROM onec_sync_logs 
    ORDER BY started_at DESC 
    LIMIT 10
  `;
  
  const result = await DatabaseManager.query(lastSyncQuery);
  
  // Check if 1C service is available
  const isOneCAvailable = await check1CAvailability();
  
  // Get active branches count
  const branchCountResult = await DatabaseManager.query(
    'SELECT COUNT(*) as count FROM branches WHERE is_active = true'
  );
  
  res.json({
    success: true,
    data: {
      integration_status: isOneCAvailable ? 'connected' : 'disconnected',
      last_sync_history: result.rows,
      sync_configuration: {
        auto_sync_enabled: true,
        sync_interval_minutes: 30,
        supported_entities: ['products', 'transactions', 'inventory', 'employees']
      },
      active_branches: parseInt(branchCountResult.rows[0].count),
      timestamp: new Date().toISOString()
    }
  });
}));

// POST /api/1c/sync - Trigger manual sync to branches
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
  const { entity_type, branch_codes, force_sync } = syncRequestSchema.parse(req.body);
  
  // Start sync process
  const syncId = await startSyncProcess(entity_type, branch_codes, force_sync);
  
  res.json({
    success: true,
    data: {
      sync_id: syncId,
      message: `Sync process started for ${entity_type}`,
      estimated_duration: '5-10 minutes',
      target_branches: branch_codes || 'all'
    }
  });
}));

// GET /api/1c/sync/:syncId/status - Get sync status
router.get('/sync/:syncId/status', asyncHandler(async (req: Request, res: Response) => {
  const { syncId } = req.params;
  
  const statusQuery = `
    SELECT 
      id, sync_type, direction, status, records_processed,
      started_at, completed_at, error_message
    FROM onec_sync_logs 
    WHERE id = $1
  `;
  
  const result = await DatabaseManager.query(statusQuery, [syncId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Sync process not found'
    });
  }
  
  const syncProcess = result.rows[0];
  
  res.json({
    success: true,
    data: {
      sync_id: syncProcess.id,
      entity_type: syncProcess.sync_type,
      direction: syncProcess.direction,
      status: syncProcess.status,
      records_processed: syncProcess.records_processed,
      started_at: syncProcess.started_at,
      completed_at: syncProcess.completed_at,
      error_message: syncProcess.error_message
    }
  });
}));

// ============================================================================
// EXPORT ENDPOINTS FOR 1C
// ============================================================================

// GET /api/1c/export/transactions - Export transaction data to 1C
router.get('/export/transactions', asyncHandler(async (req: Request, res: Response) => {
  const { branch_codes, start_date, end_date, include_items = 'true' } = req.query;
  
  let query = `
    SELECT 
      t.id,
      t.transaction_number,
      b.code as branch_code,
      b.name as branch_name,
      e.employee_id,
      e.name as employee_name,
      t.subtotal,
      t.tax_amount,
      t.discount_amount,
      t.total_amount,
      t.payment_method,
      t.status,
      t.completed_at,
      t.onec_id
    FROM transactions t
    JOIN branches b ON t.branch_id = b.id
    LEFT JOIN employees e ON t.employee_id = e.id
    WHERE t.status = 'completed'
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (start_date) {
    query += ` AND t.completed_at >= $${paramIndex}`;
    params.push(start_date);
    paramIndex++;
  }
  
  if (end_date) {
    query += ` AND t.completed_at <= $${paramIndex}`;
    params.push(end_date);
    paramIndex++;
  }
  
  if (branch_codes && Array.isArray(branch_codes)) {
    query += ` AND b.code = ANY($${paramIndex})`;
    params.push(branch_codes);
    paramIndex++;
  }
  
  query += ` ORDER BY t.completed_at DESC`;
  
  const result = await DatabaseManager.query(query, params);
  const transactions = result.rows;
  
  // Include transaction items if requested
  if (include_items === 'true' && transactions.length > 0) {
    const transactionIds = transactions.map((t: any) => t.id);
    const itemsQuery = `
      SELECT 
        ti.transaction_id,
        p.sku,
        p.barcode,
        p.name as product_name,
        p.onec_id as product_onec_id,
        ti.quantity,
        ti.unit_price,
        ti.original_price,
        ti.discount_amount,
        ti.total_amount
      FROM transaction_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transaction_id = ANY($1)
      ORDER BY ti.transaction_id, ti.id
    `;
    
    const itemsResult = await DatabaseManager.query(itemsQuery, [transactionIds]);
    
    // Group items by transaction
    const itemsByTransaction = itemsResult.rows.reduce((acc: any, item: any) => {
      if (!acc[item.transaction_id]) {
        acc[item.transaction_id] = [];
      }
      acc[item.transaction_id].push(item);
      return acc;
    }, {});
    
    // Add items to transactions
    transactions.forEach((transaction: any) => {
      transaction.items = itemsByTransaction[transaction.id] || [];
    });
  }
  
  res.json({
    success: true,
    data: {
      transactions,
      export_timestamp: new Date().toISOString(),
      include_items: include_items === 'true',
      filter: {
        branch_codes: branch_codes || 'all',
        start_date,
        end_date
      }
    }
  });
}));

// GET /api/1c/export/inventory - Export inventory data to 1C
router.get('/export/inventory', asyncHandler(async (req: Request, res: Response) => {
  const { branch_codes } = req.query;
  
  let query = `
    SELECT 
      b.code as branch_code,
      b.name as branch_name,
      p.sku,
      p.barcode,
      p.name as product_name,
      p.onec_id as product_onec_id,
      bi.quantity_in_stock,
      bi.reserved_quantity,
      bi.min_stock_level,
      bi.max_stock_level,
      bi.reorder_point,
      bi.last_counted_at,
      bi.updated_at
    FROM branch_inventory bi
    JOIN branches b ON bi.branch_id = b.id
    JOIN products p ON bi.product_id = p.id
    WHERE b.is_active = true AND p.is_active = true
  `;
  
  const params: any[] = [];
  
  if (branch_codes && Array.isArray(branch_codes)) {
    query += ` AND b.code = ANY($1)`;
    params.push(branch_codes);
  }
  
  query += ` ORDER BY b.code, p.sku`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      inventory: result.rows,
      export_timestamp: new Date().toISOString(),
      filter: {
        branch_codes: branch_codes || 'all'
      }
    }
  });
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function check1CAvailability(): Promise<boolean> {
  try {
    // In a real implementation, you would ping the 1C server
    // For now, we'll assume it's always available
    return true;
  } catch (error) {
    console.error('Error checking 1C availability:', error);
    return false;
  }
}

async function createSyncLog(syncType: string, direction: string, totalRecords: number): Promise<string> {
  const result = await DatabaseManager.query(`
    INSERT INTO onec_sync_logs (
      sync_type, direction, status, started_at
    ) VALUES (
      $1, $2, 'started', NOW()
    ) RETURNING id
  `, [syncType, direction]);
  
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
  `, [status, recordsProcessed, errorMessage || null, syncId]);
}

async function startSyncProcess(
  entityType: string, 
  branchCodes?: string[], 
  forceSync?: boolean
): Promise<string> {
  const syncId = await createSyncLog(entityType, 'to_branches', 0);
  
  // Start background sync process
  setImmediate(async () => {
    try {
      await executeSyncToBranches(syncId, entityType, branchCodes, forceSync);
    } catch (error) {
      console.error('Sync process failed:', error);
      await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    }
  });
  
  return syncId;
}

async function executeSyncToBranches(
  syncId: string,
  entityType: string,
  branchCodes?: string[],
  forceSync?: boolean
): Promise<void> {
  // Get target branches
  let branchQuery = 'SELECT id, code, api_endpoint, api_key FROM branches WHERE is_active = true';
  const params: any[] = [];
  
  if (branchCodes && branchCodes.length > 0) {
    branchQuery += ' AND code = ANY($1)';
    params.push(branchCodes);
  }
  
  const branchesResult = await DatabaseManager.query(branchQuery, params);
  const branches = branchesResult.rows;
  
  let totalProcessed = 0;
  
  for (const branch of branches) {
    try {
      switch (entityType) {
        case 'products':
          await syncProductsToBranch(branch.code);
          break;
        case 'inventory':
          await syncInventoryToBranch(branch.code);
          break;
        case 'employees':
          await syncEmployeesToBranch(branch.code);
          break;
        case 'all':
          await syncProductsToBranch(branch.code);
          await syncInventoryToBranch(branch.code);
          await syncEmployeesToBranch(branch.code);
          break;
      }
      totalProcessed++;
    } catch (error) {
      console.error(`Error syncing ${entityType} to branch ${branch.code}:`, error);
    }
  }
  
  await completeSyncLog(syncId, 'completed', totalProcessed);
}

async function syncProductToBranches(productId: string): Promise<void> {
  // Get all active branches
  const branchesResult = await DatabaseManager.query(
    'SELECT code FROM branches WHERE is_active = true'
  );
  
  // Get product data
  const productResult = await DatabaseManager.query(`
    SELECT 
      p.sku, p.barcode, p.name, p.name_ru, p.name_uz, p.description,
      p.base_price, p.cost, p.unit_of_measure, p.tax_rate, p.is_active,
      c.key as category_key
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1
  `, [productId]);
  
  if (productResult.rows.length === 0) return;
  
  const product = productResult.rows[0];
  
  // Send to all branches
  for (const branch of branchesResult.rows) {
    try {
      await sendProductDataToBranch(branch.code, product);
    } catch (error) {
      console.error(`Error sending product to branch ${branch.code}:`, error);
    }
  }
}

async function getBranchApiEndpoint(branchCode: string): Promise<{ endpoint: string; apiKey: string } | null> {
  const result = await DatabaseManager.query(
    'SELECT api_endpoint, api_key FROM branches WHERE code = $1 AND is_active = true',
    [branchCode]
  );
  
  if (result.rows.length === 0) return null;
  
  const branch = result.rows[0];
  return {
    endpoint: branch.api_endpoint,
    apiKey: branch.api_key
  };
}

async function sendProductDataToBranch(branchCode: string, productData: any): Promise<void> {
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.post(`${branchApi.endpoint}/api/chain-core/products/sync`, {
      products: [productData]
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  } catch (error) {
    console.error(`Failed to send product data to branch ${branchCode}:`, error);
    throw error;
  }
}

async function sendPriceUpdateToBranch(branchCode: string, priceUpdate: any): Promise<void> {
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.put(`${branchApi.endpoint}/api/chain-core/products/prices`, {
      updates: [priceUpdate]
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  } catch (error) {
    console.error(`Failed to send price update to branch ${branchCode}:`, error);
    throw error;
  }
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
      timeout: 10000
    });
  } catch (error) {
    console.error(`Failed to send inventory update to branch ${branchCode}:`, error);
    throw error;
  }
}

async function sendEmployeeDataToBranch(branchCode: string, employeeData: any): Promise<void> {
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.post(`${branchApi.endpoint}/api/chain-core/employees`, {
      employees: [employeeData]
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  } catch (error) {
    console.error(`Failed to send employee data to branch ${branchCode}:`, error);
    throw error;
  }
}

async function syncProductsToBranch(branchCode: string): Promise<void> {
  // Get all active products
  const productsResult = await DatabaseManager.query(`
    SELECT 
      p.sku, p.barcode, p.name, p.name_ru, p.name_uz, p.description,
      p.base_price, p.cost, p.unit_of_measure, p.tax_rate, p.is_active,
      c.key as category_key
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
  `);
  
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.post(`${branchApi.endpoint}/api/chain-core/products/sync`, {
      products: productsResult.rows
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error(`Failed to sync products to branch ${branchCode}:`, error);
    throw error;
  }
}

async function syncInventoryToBranch(branchCode: string): Promise<void> {
  // Get branch inventory
  const inventoryResult = await DatabaseManager.query(`
    SELECT 
      p.sku,
      p.barcode,
      bi.quantity_in_stock,
      bi.min_stock_level,
      bi.max_stock_level
    FROM branch_inventory bi
    JOIN products p ON bi.product_id = p.id
    JOIN branches b ON bi.branch_id = b.id
    WHERE b.code = $1 AND p.is_active = true
  `, [branchCode]);
  
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  const updates = inventoryResult.rows.map((item: any) => ({
    sku: item.sku,
    barcode: item.barcode,
    quantity_adjustment: item.quantity_in_stock,
    adjustment_type: 'set',
    reason: 'Chain-core sync'
  }));
  
  try {
    await axios.put(`${branchApi.endpoint}/api/chain-core/inventory`, {
      updates
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error(`Failed to sync inventory to branch ${branchCode}:`, error);
    throw error;
  }
}

async function syncEmployeesToBranch(branchCode: string): Promise<void> {
  // Get branch employees
  const employeesResult = await DatabaseManager.query(`
    SELECT 
      e.employee_id, e.name, e.role, e.phone, e.email, e.status
    FROM employees e
    JOIN branches b ON e.branch_id = b.id
    WHERE b.code = $1 AND e.status = 'active'
  `, [branchCode]);
  
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.post(`${branchApi.endpoint}/api/chain-core/employees`, {
      employees: employeesResult.rows
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error(`Failed to sync employees to branch ${branchCode}:`, error);
    throw error;
  }
}

export default router;
