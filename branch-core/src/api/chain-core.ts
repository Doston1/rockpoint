import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const PriceUpdateSchema = z.object({
  updates: z.array(z.object({
    sku: z.string().optional(),
    product_id: z.string().optional(),
    price: z.number().positive(),
    cost: z.number().positive().optional(),
    effective_date: z.string().optional()
  })).min(1)
});

const InventoryUpdateSchema = z.object({
  updates: z.array(z.object({
    sku: z.string().optional(),
    product_id: z.string().optional(),
    quantity_adjustment: z.number(),
    adjustment_type: z.enum(['add', 'subtract', 'set']),
    reason: z.string().optional(),
    reference_id: z.string().optional()
  })).min(1)
});

const ProductSyncSchema = z.object({
  products: z.array(z.object({
    sku: z.string(),
    name: z.string(),
    name_ru: z.string().optional(),
    name_uz: z.string().optional(),
    description: z.string().optional(),
    category_id: z.string().optional(),
    brand: z.string().optional(),
    price: z.number().positive(),
    cost: z.number().positive().optional(),
    barcode: z.string().optional(),
    unit_of_measure: z.string().optional(),
    tax_rate: z.number().min(0).max(1).optional(),
    is_active: z.boolean().optional()
  })).min(1)
});

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

// Get current inventory levels
router.get('/inventory', async (req: Request, res: Response) => {
  try {
    const { sku, category, low_stock_only, page = '1', limit = '100' } = req.query;
    
    let query = `
      SELECT 
        bi.id,
        bi.product_id,
        p.sku,
        p.name,
        p.name_ru,
        bi.quantity_in_stock,
        bi.min_stock_level,
        bi.max_stock_level,
        bi.last_updated,
        p.price as current_price,
        p.cost,
        c.name as category_name,
        CASE 
          WHEN bi.quantity_in_stock <= bi.min_stock_level THEN true 
          ELSE false 
        END as is_low_stock
      FROM branch_inventory bi
      JOIN products p ON bi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (sku) {
      query += ` AND p.sku = $${paramIndex}`;
      params.push(sku);
      paramIndex++;
    }

    if (category) {
      query += ` AND c.key = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (low_stock_only === 'true') {
      query += ` AND bi.quantity_in_stock <= bi.min_stock_level`;
    }

    query += ` ORDER BY p.name`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string));
    params.push((parseInt(page as string) - 1) * parseInt(limit as string));

    const result = await DatabaseManager.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM branch_inventory bi
      JOIN products p ON bi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (sku) {
      countQuery += ` AND p.sku = $${countParamIndex}`;
      countParams.push(sku);
      countParamIndex++;
    }

    if (category) {
      countQuery += ` AND c.key = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }

    if (low_stock_only === 'true') {
      countQuery += ` AND bi.quantity_in_stock <= bi.min_stock_level`;
    }

    const countResult = await DatabaseManager.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        inventory: result.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch inventory data'
    });
  }
});

// Update inventory levels
router.put('/inventory', async (req: Request, res: Response) => {
  try {
    const validatedData = InventoryUpdateSchema.parse(req.body);
    const results: any[] = [];

    await DatabaseManager.query('BEGIN');

    for (const update of validatedData.updates) {
      try {
        // Find product by SKU or ID
        let productQuery = 'SELECT id FROM products WHERE ';
        let productParams: any[] = [];
        
        if (update.sku) {
          productQuery += 'sku = $1';
          productParams.push(update.sku);
        } else if (update.product_id) {
          productQuery += 'id = $1';
          productParams.push(update.product_id);
        } else {
          throw new Error('Either sku or product_id must be provided');
        }

        const productResult = await DatabaseManager.query(productQuery, productParams);
        if (productResult.rows.length === 0) {
          throw new Error(`Product not found: ${update.sku || update.product_id}`);
        }

        const productId = productResult.rows[0].id;

        // Get current inventory
        const currentInventory = await DatabaseManager.query(
          'SELECT quantity_in_stock FROM branch_inventory WHERE product_id = $1',
          [productId]
        );

        let newQuantity: number;
        const currentQty = currentInventory.rows[0]?.quantity_in_stock || 0;

        switch (update.adjustment_type) {
          case 'add':
            newQuantity = currentQty + update.quantity_adjustment;
            break;
          case 'subtract':
            newQuantity = currentQty - update.quantity_adjustment;
            break;
          case 'set':
            newQuantity = update.quantity_adjustment;
            break;
          default:
            throw new Error('Invalid adjustment_type');
        }

        // Ensure quantity doesn't go negative
        if (newQuantity < 0) {
          newQuantity = 0;
        }

        // Update or insert inventory record
        const upsertQuery = `
          INSERT INTO branch_inventory (product_id, quantity_in_stock, last_updated)
          VALUES ($1, $2, NOW())
          ON CONFLICT (product_id) 
          DO UPDATE SET 
            quantity_in_stock = $2,
            last_updated = NOW()
          RETURNING *
        `;

        const result = await DatabaseManager.query(upsertQuery, [productId, newQuantity]);

        // Log the inventory adjustment
        await DatabaseManager.query(`
          INSERT INTO inventory_adjustments 
          (product_id, adjustment_type, quantity_before, quantity_after, adjustment_amount, reason, reference_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          productId,
          update.adjustment_type,
          currentQty,
          newQuantity,
          update.quantity_adjustment,
          update.reason || 'Chain-core sync',
          update.reference_id || null
        ]);

        results.push({
          success: true,
          product_id: productId,
          sku: update.sku,
          old_quantity: currentQty,
          new_quantity: newQuantity,
          adjustment: update.quantity_adjustment
        });

      } catch (error) {
        results.push({
          success: false,
          sku: update.sku,
          product_id: update.product_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await DatabaseManager.query('COMMIT');

    res.json({
      success: true,
      data: {
        results,
        updated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    console.error('Error updating inventory:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update inventory'
    });
  }
});

// ============================================================================
// PRODUCT MANAGEMENT
// ============================================================================

// Get products with current stock levels
router.get('/products', async (req: Request, res: Response) => {
  try {
    const { category, active_only = 'true', page = '1', limit = '100' } = req.query;
    
    let query = `
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.name_ru,
        p.name_uz,
        p.description,
        p.price,
        p.cost,
        p.barcode,
        p.unit_of_measure,
        p.tax_rate,
        p.is_active,
        c.name as category_name,
        c.key as category_key,
        bi.quantity_in_stock,
        bi.min_stock_level,
        bi.max_stock_level,
        bi.last_updated as inventory_updated
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN branch_inventory bi ON p.id = bi.product_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (active_only === 'true') {
      query += ` AND p.is_active = true`;
    }

    if (category) {
      query += ` AND c.key = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += ` ORDER BY p.name`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string));
    params.push((parseInt(page as string) - 1) * parseInt(limit as string));

    const result = await DatabaseManager.query(query, params);

    res.json({
      success: true,
      data: {
        products: result.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.rows.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch products'
    });
  }
});

// Update product prices
router.put('/products/prices', async (req: Request, res: Response) => {
  try {
    const validatedData = PriceUpdateSchema.parse(req.body);
    const results: any[] = [];

    await DatabaseManager.query('BEGIN');

    for (const update of validatedData.updates) {
      try {
        // Find product by SKU or ID
        let productQuery = 'SELECT id, price, cost FROM products WHERE ';
        let productParams: any[] = [];
        
        if (update.sku) {
          productQuery += 'sku = $1';
          productParams.push(update.sku);
        } else if (update.product_id) {
          productQuery += 'id = $1';
          productParams.push(update.product_id);
        } else {
          throw new Error('Either sku or product_id must be provided');
        }

        const productResult = await DatabaseManager.query(productQuery, productParams);
        if (productResult.rows.length === 0) {
          throw new Error(`Product not found: ${update.sku || update.product_id}`);
        }

        const product = productResult.rows[0];
        const oldPrice = product.price;
        const oldCost = product.cost;

        // Update product price
        const updateQuery = `
          UPDATE products 
          SET price = $1, cost = COALESCE($2, cost), updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `;

        const result = await DatabaseManager.query(updateQuery, [
          update.price,
          update.cost || null,
          product.id
        ]);

        // Log price change
        await DatabaseManager.query(`
          INSERT INTO price_history 
          (product_id, old_price, new_price, old_cost, new_cost, effective_date, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          product.id,
          oldPrice,
          update.price,
          oldCost,
          update.cost || oldCost,
          update.effective_date || new Date().toISOString()
        ]);

        results.push({
          success: true,
          product_id: product.id,
          sku: update.sku,
          old_price: oldPrice,
          new_price: update.price,
          old_cost: oldCost,
          new_cost: update.cost || oldCost
        });

      } catch (error) {
        results.push({
          success: false,
          sku: update.sku,
          product_id: update.product_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await DatabaseManager.query('COMMIT');

    res.json({
      success: true,
      data: {
        results,
        updated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    console.error('Error updating prices:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update prices'
    });
  }
});

// Sync products from chain-core
router.post('/products/sync', async (req: Request, res: Response) => {
  try {
    const validatedData = ProductSyncSchema.parse(req.body);
    const results: any[] = [];

    await DatabaseManager.query('BEGIN');

    for (const product of validatedData.products) {
      try {
        // Upsert product
        const upsertQuery = `
          INSERT INTO products (
            sku, name, name_ru, name_uz, description, category_id, 
            brand, price, cost, barcode, unit_of_measure, tax_rate, is_active, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (sku) 
          DO UPDATE SET 
            name = $2,
            name_ru = $3,
            name_uz = $4,
            description = $5,
            category_id = $6,
            brand = $7,
            price = $8,
            cost = $9,
            barcode = $10,
            unit_of_measure = $11,
            tax_rate = $12,
            is_active = $13,
            updated_at = NOW()
          RETURNING *
        `;

        const result = await DatabaseManager.query(upsertQuery, [
          product.sku,
          product.name,
          product.name_ru || null,
          product.name_uz || null,
          product.description || null,
          product.category_id || null,
          product.brand || null,
          product.price,
          product.cost || null,
          product.barcode || null,
          product.unit_of_measure || 'pcs',
          product.tax_rate || 0,
          product.is_active !== false,
        ]);

        results.push({
          success: true,
          sku: product.sku,
          action: 'synced',
          product_id: result.rows[0].id
        });

      } catch (error) {
        results.push({
          success: false,
          sku: product.sku,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await DatabaseManager.query('COMMIT');

    res.json({
      success: true,
      data: {
        results,
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });

  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    console.error('Error syncing products:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to sync products'
    });
  }
});

// ============================================================================
// EMPLOYEE DATA
// ============================================================================

// Get employees data
router.get('/employees', async (req: Request, res: Response) => {
  try {
    const { status = 'active', role, page = '1', limit = '100' } = req.query;
    
    let query = `
      SELECT 
        id, employee_id, name, role, phone, email, 
        hire_date, salary, status, created_at, updated_at
      FROM employees
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    query += ` ORDER BY name`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string));
    params.push((parseInt(page as string) - 1) * parseInt(limit as string));

    const result = await DatabaseManager.query(query, params);

    res.json({
      success: true,
      data: {
        employees: result.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.rows.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch employees'
    });
  }
});

// ============================================================================
// TRANSACTION DATA
// ============================================================================

// Get transactions data
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const { 
      start_date, 
      end_date, 
      status = 'completed',
      employee_id,
      include_items = 'false',
      page = '1', 
      limit = '100' 
    } = req.query;
    
    let query = `
      SELECT 
        t.id,
        t.transaction_number,
        t.employee_id,
        e.name as employee_name,
        t.subtotal,
        t.tax_amount,
        t.total_amount,
        t.payment_method,
        t.status,
        t.created_at,
        t.completed_at
      FROM transactions t
      LEFT JOIN employees e ON t.employee_id = e.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (employee_id) {
      query += ` AND t.employee_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }

    query += ` ORDER BY t.created_at DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string));
    params.push((parseInt(page as string) - 1) * parseInt(limit as string));

    const result = await DatabaseManager.query(query, params);
    
    // Include transaction items if requested
    if (include_items === 'true' && result.rows.length > 0) {
      const transactionIds = result.rows.map((t: any) => t.id);
      const itemsQuery = `
        SELECT 
          ti.transaction_id,
          ti.product_id,
          p.sku,
          p.name as product_name,
          ti.quantity,
          ti.unit_price,
          ti.total_amount
        FROM transaction_items ti
        JOIN products p ON ti.product_id = p.id
        WHERE ti.transaction_id = ANY($1)
        ORDER BY ti.transaction_id, p.name
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
      result.rows.forEach((transaction: any) => {
        transaction.items = itemsByTransaction[transaction.id] || [];
      });
    }

    // Calculate summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(AVG(total_amount), 0) as average_transaction
      FROM transactions t
      WHERE t.status = 'completed'
    `;
    
    const summaryParams: any[] = [];
    let summaryParamIndex = 1;
    let summaryWhere = '';

    if (start_date) {
      summaryWhere += ` AND t.created_at >= $${summaryParamIndex}`;
      summaryParams.push(start_date);
      summaryParamIndex++;
    }

    if (end_date) {
      summaryWhere += ` AND t.created_at <= $${summaryParamIndex}`;
      summaryParams.push(end_date);
      summaryParamIndex++;
    }

    const summaryResult = await DatabaseManager.query(summaryQuery + summaryWhere, summaryParams);

    res.json({
      success: true,
      data: {
        transactions: result.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.rows.length
        },
        summary: summaryResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch transactions'
    });
  }
});

// ============================================================================
// SYSTEM STATUS
// ============================================================================

// Get branch status and statistics
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Get basic statistics
    const statsQueries = [
      'SELECT COUNT(*) as active_products FROM products WHERE is_active = true',
      'SELECT COUNT(*) as active_employees FROM employees WHERE status = \'active\'',
      'SELECT COUNT(*) as daily_transactions FROM transactions WHERE DATE(created_at) = CURRENT_DATE AND status = \'completed\'',
      'SELECT COALESCE(SUM(total_amount), 0) as daily_revenue FROM transactions WHERE DATE(created_at) = CURRENT_DATE AND status = \'completed\'',
      'SELECT COUNT(*) as low_stock_items FROM branch_inventory bi WHERE bi.quantity_in_stock <= bi.min_stock_level',
      'SELECT COALESCE(SUM(quantity_in_stock), 0) as total_inventory FROM branch_inventory'
    ];

    const results = await Promise.all(
      statsQueries.map(query => DatabaseManager.query(query))
    );

    const statistics = {
      active_products: parseInt(results[0].rows[0].active_products),
      active_employees: parseInt(results[1].rows[0].active_employees),
      daily_transactions: parseInt(results[2].rows[0].daily_transactions),
      daily_revenue: parseFloat(results[3].rows[0].daily_revenue),
      low_stock_items: parseInt(results[4].rows[0].low_stock_items),
      total_inventory_items: parseFloat(results[5].rows[0].total_inventory)
    };

    res.json({
      success: true,
      data: {
        system_status: 'healthy',
        branch_id: process.env.BRANCH_ID || 'UNKNOWN',
        timestamp: new Date().toISOString(),
        statistics
      }
    });

  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch branch status'
    });
  }
});

export default router;
