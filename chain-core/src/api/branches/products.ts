import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const stockUpdateSchema = z.object({
  product_id: z.string().uuid(),
  quantity_in_stock: z.number().min(0),
  min_stock_level: z.number().min(0).optional(),
  max_stock_level: z.number().min(0).optional(),
  last_counted_at: z.string().optional()
});

const stockSearchSchema = z.object({
  product_id: z.string().uuid().optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().optional()
});

const pricingUpdateSchema = z.object({
  product_id: z.string(),
  price: z.number().positive(),
  cost: z.number().positive().optional(),
  effective_from: z.string().optional()
});

const bulkPricingUpdateSchema = z.object({
  updates: z.array(pricingUpdateSchema).min(1)
});

// ============================================================================
// PRODUCT INFORMATION ENDPOINTS
// ============================================================================

/**
 * GET /api/branch-api/products/search
 * Search products with filters
 */
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { 
    query: searchQuery,
    category,
    limit = 50
  } = req.query;
  
  let whereClause = 'WHERE p.is_active = true';
  const params: any[] = [branchServer.branchId];
  let paramIndex = 2;
  
  if (searchQuery) {
    whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`;
    params.push(`%${searchQuery}%`);
    paramIndex++;
  }
  
  if (category) {
    whereClause += ` AND c.key = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }
  
  const query = `
    SELECT 
      p.id, p.onec_id, p.name, p.sku, p.barcode, p.description,
      p.category_id, p.is_active, p.created_at, p.updated_at,
      p.base_price, 
      c.name as category_name, c.key as category_key,
      bpp.price, bpp.cost, bpp.is_available,
      bi.quantity_in_stock,
      bi.min_stock_level, bi.max_stock_level
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
    LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = $1
    ${whereClause}
    ORDER BY p.name ASC
    LIMIT $${paramIndex}
  `;
  
  params.push(Number(limit));
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

/**
 * GET /api/branch-api/products/low-stock
 * Get products with low stock levels in this branch
 */
router.get('/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { urgency } = req.query;
  
  let thresholdCondition = '';
  if (urgency === 'critical') {
    thresholdCondition = 'AND bi.quantity_in_stock = 0';
  } else {
    thresholdCondition = 'AND bi.quantity_in_stock <= bi.min_stock_level';
  }
  
  const query = `
    SELECT 
      bi.product_id,
      bi.quantity_in_stock,
      bi.min_stock_level,
      bi.max_stock_level,
      bi.last_counted_at,
      bi.updated_at,
      p.name as product_name,
      p.sku,
      p.barcode,
      p.onec_id,
      c.name as category_name,
      bpp.price,
      bpp.is_available
    FROM branch_inventory bi
    JOIN products p ON bi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON bi.product_id = bpp.product_id AND bi.branch_id = bpp.branch_id
    WHERE bi.branch_id = $1 
      AND p.is_active = true
      AND bi.min_stock_level > 0
      ${thresholdCondition}
    ORDER BY 
      CASE 
        WHEN bi.min_stock_level > 0 THEN (bi.quantity_in_stock::float / bi.min_stock_level)
        ELSE bi.quantity_in_stock
      END ASC
  `;
  
  const result = await DatabaseManager.query(query, [branchServer.branchId]);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

/**
 * GET /api/branch-api/products/categories
 * Get product categories
 */
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const query = `
    SELECT 
      c.id, c.name, c.key, c.description,
      c.parent_id, c.is_active,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
    WHERE c.is_active = true
    GROUP BY c.id, c.name, c.key, c.description, c.parent_id, c.is_active
    ORDER BY c.name ASC
  `;
  
  const result = await DatabaseManager.query(query);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

/**
 * GET /api/branch-api/products/:productId
 * Get specific product details with branch-specific pricing and stock
 */
router.get('/:productId', asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const branchServer = req.branchServer!;
  
  const query = `
    SELECT 
      p.id, p.name, p.sku, p.barcode, p.description,
      p.category_id, p.is_active, p.attributes,
      p.created_at, p.updated_at,
      p.onec_id,
      c.name as category_name,
      bpp.price as branch_price, bpp.cost, bpp.is_available,
      bpp.updated_at as pricing_updated_at,
      bi.quantity_in_stock, bi.min_stock_level, bi.max_stock_level,
      bi.updated_at as stock_updated_at
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $2
    LEFT JOIN branch_inventory bi ON p.id = bi.product_id AND bi.branch_id = $2
            WHERE p.id::text = $1 OR p.sku = $1 OR p.barcode = $1 OR p.onec_id = $1
  `;
  
  const result = await DatabaseManager.query(query, [productId, branchServer.branchId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product not found'
    });
  }
  
  const product = result.rows[0];
  
  res.json({
    success: true,
    data: {
      ...product,
      stock_info: {
        quantity_in_stock: product.quantity_in_stock || 0,
        minimum_stock: product.minimum_stock,
        maximum_stock: product.maximum_stock,
        stock_updated_at: product.stock_updated_at
      },
      pricing: {
        branch_price: product.branch_price,
        cost: product.cost,
        is_available: product.is_available,
        pricing_updated_at: product.pricing_updated_at
      }
    }
  });
}));

/**
 * GET /api/branch-api/products/stock/cross-branch
 * Search for product stock across all branches
 */
router.get('/stock/cross-branch', asyncHandler(async (req: Request, res: Response) => {
  const { product_id, min_stock } = req.query;
  const branchServer = req.branchServer!;
  
  if (!product_id) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'product_id parameter is required'
    });
  }
  
  let query = `
    SELECT 
      bi.product_id,
      bi.quantity_in_stock as quantity_in_stock,
      bi.min_stock_level as minimum_stock,
      bi.max_stock_level as maximum_stock,
      bi.last_counted_at,
      bi.updated_at as stock_updated_at,
      b.id as branch_id,
      b.code as branch_code,
      b.name as branch_name,
      b.address as branch_address,
      bpp.price,
      bpp.is_available
    FROM branch_inventory bi
    JOIN branches b ON bi.branch_id = b.id
    JOIN products p ON bi.product_id = p.id
    LEFT JOIN branch_product_pricing bpp ON bi.product_id = bpp.product_id AND bi.branch_id = bpp.branch_id
    WHERE (p.id::text = $1 OR p.sku = $1 OR p.barcode = $1 OR p.onec_id = $1) AND b.is_active = true
  `;
  
  const params: any[] = [product_id];
  
  if (min_stock) {
    query += ` AND bi.quantity_in_stock >= $2`;
    params.push(Number(min_stock));
  }
  
  query += ` ORDER BY b.name, bi.quantity_in_stock DESC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

/**
 * GET /api/branch-api/products/categories
 * Get product categories
 */
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const query = `
    SELECT 
      c.id, c.name, c.key, c.description,
      c.parent_id, c.is_active,
      COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
    WHERE c.is_active = true
    GROUP BY c.id, c.name, c.key, c.description, c.parent_id, c.is_active
    ORDER BY c.name ASC
  `;
  
  const result = await DatabaseManager.query(query);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

/**
 * POST /api/branch-api/products/pricing/update
 * Update product pricing for branch
 */
router.post('/pricing/update', asyncHandler(async (req: Request, res: Response) => {
  const pricingData = pricingUpdateSchema.parse(req.body);
  const branchServer = req.branchServer!;
  
  // Verify product exists
  const productResult = await DatabaseManager.query(
    'SELECT id, name FROM products WHERE id::text = $1 OR onec_id = $1',
    [pricingData.product_id]
  );
  
  if (productResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      code: 'PRODUCT_NOT_FOUND',
      message: 'Product not found'
    });
  }
  
  const product = productResult.rows[0];
  
  // Update or insert pricing record
  const upsertResult = await DatabaseManager.query(`
    INSERT INTO branch_product_pricing (
      branch_id, product_id, price, cost, is_available, updated_at
    ) VALUES (
      $1, $2, $3, $4, true, NOW()
    )
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET
      price = $3,
      cost = COALESCE($4, branch_product_pricing.cost),
      is_available = true,
      updated_at = NOW()
    RETURNING price, cost, is_available
  `, [
    branchServer.branchId,
    product.id,
    pricingData.price,
    pricingData.cost
  ]);
  
  res.json({
    success: true,
    data: {
      product_id: pricingData.product_id,
      price: pricingData.price,
      cost: pricingData.cost,
      updated_pricing: upsertResult.rows[0]
    }
  });
}));

/**
 * POST /api/branch-api/products/pricing/bulk-update
 * Bulk update product pricing
 */
router.post('/pricing/bulk-update', asyncHandler(async (req: Request, res: Response) => {
  const bulkData = bulkPricingUpdateSchema.parse(req.body);
  const branchServer = req.branchServer!;
  
  let updatedCount = 0;
  let failedCount = 0;
  const results = [];
  
  for (const update of bulkData.updates) {
    try {
      // Verify product exists
      const productResult = await DatabaseManager.query(
        'SELECT id, name FROM products WHERE id::text = $1 OR onec_id = $1',
        [update.product_id]
      );
      
      if (productResult.rows.length === 0) {
        failedCount++;
        results.push({
          product_id: update.product_id,
          success: false,
          error: 'Product not found'
        });
        continue;
      }
      
      const product = productResult.rows[0];
      
      // Update pricing
      await DatabaseManager.query(`
        INSERT INTO branch_product_pricing (
          branch_id, product_id, price, cost, is_available, updated_at
        ) VALUES (
          $1, $2, $3, $4, true, NOW()
        )
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET
          price = $3,
          cost = COALESCE($4, branch_product_pricing.cost),
          is_available = true,
          updated_at = NOW()
      `, [
        branchServer.branchId,
        product.id,
        update.price,
        update.cost
      ]);
      
      updatedCount++;
      results.push({
        product_id: update.product_id,
        success: true,
        price: update.price,
        cost: update.cost
      });
      
    } catch (error) {
      failedCount++;
      results.push({
        product_id: update.product_id,
        success: false,
        error: (error as Error).message
      });
    }
  }
  
  res.json({
    success: true,
    data: {
      updated_count: updatedCount,
      failed_count: failedCount,
      results
    }
  });
}));

/**
 * GET /api/branches/products/stock/search
 * Search for product stock across all branches
 */
router.get('/stock/search', asyncHandler(async (req: Request, res: Response) => {
  const searchCriteria = stockSearchSchema.parse(req.query);
  const branchServer = req.branchServer!;
  
  if (!searchCriteria.product_id && !searchCriteria.barcode && !searchCriteria.sku && !searchCriteria.name) {
    return res.status(400).json({
      success: false,
      error: 'At least one search criteria must be provided (product_id, barcode, sku, or name)'
    });
  }
  
  let productQuery = `
    SELECT id, name, sku, barcode 
    FROM products 
    WHERE 1=1
  `;
  
  const productParams: any[] = [];
  
  if (searchCriteria.product_id) {
    productParams.push(searchCriteria.product_id);
    productQuery += ` AND id = $${productParams.length}`;
  }
  
  if (searchCriteria.barcode) {
    productParams.push(searchCriteria.barcode);
    productQuery += ` AND barcode = $${productParams.length}`;
  }
  
  if (searchCriteria.sku) {
    productParams.push(searchCriteria.sku);
    productQuery += ` AND sku = $${productParams.length}`;
  }
  
  if (searchCriteria.name) {
    productParams.push(`%${searchCriteria.name}%`);
    productQuery += ` AND name ILIKE $${productParams.length}`;
  }
  
  const productResult = await DatabaseManager.query(productQuery, productParams);
  
  if (productResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  // Get stock info across all branches for the found product(s)
  const productIds = productResult.rows.map((p: any) => p.id);
  
  const stockQuery = `
    SELECT 
      bi.product_id,
      bi.quantity_in_stock,
      bi.min_stock_level,
      bi.max_stock_level,
      bi.last_counted_at,
      bi.updated_at as stock_updated_at,
      b.id as branch_id,
      b.code as branch_code,
      b.name as branch_name,
      b.address as branch_address,
      bpp.price,
      bpp.is_available
    FROM branch_inventory bi
    JOIN branches b ON bi.branch_id = b.id
    LEFT JOIN branch_product_pricing bpp ON bi.product_id = bpp.product_id AND bi.branch_id = bpp.branch_id
    WHERE bi.product_id = ANY($1) AND b.is_active = true
    ORDER BY b.name, bi.quantity_in_stock DESC
  `;
  
  const stockResult = await DatabaseManager.query(stockQuery, [productIds]);
  
  // Group results by product
  const productStockMap = new Map();
  
  productResult.rows.forEach((product: any) => {
    productStockMap.set(product.id, {
      product,
      branches: []
    });
  });
  
  stockResult.rows.forEach((stockInfo: any) => {
    const productData = productStockMap.get(stockInfo.product_id);
    if (productData) {
      productData.branches.push({
        branch_id: stockInfo.branch_id,
        branch_code: stockInfo.branch_code,
        branch_name: stockInfo.branch_name,
        branch_address: stockInfo.branch_address,
        current_stock: stockInfo.quantity_in_stock,
        minimum_stock: stockInfo.min_stock_level,
        maximum_stock: stockInfo.max_stock_level,
        price: stockInfo.price,
        is_available: stockInfo.is_available,
        last_counted_at: stockInfo.last_counted_at,
        stock_updated_at: stockInfo.stock_updated_at
      });
    }
  });
  
  res.json({
    success: true,
    data: {
      results: Array.from(productStockMap.values()),
      requesting_branch: branchServer.branchCode,
      total_products: productResult.rows.length,
      total_branch_locations: stockResult.rows.length
    }
  });
}));

/**
 * GET /api/branches/products/pricing/updates
 * Get recent pricing updates for products
 */
router.get('/pricing/updates', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { 
    since,
    page = 1, 
    limit = 100 
  } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      bpp.product_id,
      bpp.price,
      bpp.cost,
      bpp.is_available,
      bpp.updated_at,
      p.name as product_name,
      p.sku,
      p.barcode,
      c.name as category_name
    FROM branch_product_pricing bpp
    JOIN products p ON bpp.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE bpp.branch_id = $1
  `;
  
  const params: any[] = [branchServer.branchId];
  
  if (since) {
    params.push(since);
    query += ` AND bpp.updated_at >= $${params.length}`;
  }
  
  // Get total count
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY bpp.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      pricing_updates: result.rows,
      branch_code: branchServer.branchCode,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// ============================================================================
// INVENTORY MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * PUT /api/branches/products/:productId/stock
 * Update stock level for a specific product in this branch
 */
router.put('/:productId/stock', asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const stockData = stockUpdateSchema.parse(req.body);
  const branchServer = req.branchServer!;
  
  // Verify product exists
  const productResult = await DatabaseManager.query(
    'SELECT id, name FROM products WHERE id = $1',
    [stockData.product_id]
  );
  
  if (productResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  if (productId !== stockData.product_id) {
    return res.status(400).json({
      success: false,
      error: 'Product ID in URL does not match product ID in body'
    });
  }
  
  // Get current stock for comparison
  const currentStockResult = await DatabaseManager.query(
    'SELECT quantity_in_stock FROM branch_inventory WHERE product_id = $1 AND branch_id = $2',
    [stockData.product_id, branchServer.branchId]
  );
  
  const previousStock = currentStockResult.rows[0]?.quantity_in_stock || 0;
  
  // Update or insert stock record
  const upsertResult = await DatabaseManager.query(`
    INSERT INTO branch_inventory (
      branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level, 
      last_counted_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, NOW()
    )
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET
      quantity_in_stock = $3,
      min_stock_level = COALESCE($4, branch_inventory.min_stock_level),
      max_stock_level = COALESCE($5, branch_inventory.max_stock_level),
      last_counted_at = COALESCE($6, branch_inventory.last_counted_at),
      updated_at = NOW()
    RETURNING quantity_in_stock, min_stock_level, max_stock_level
  `, [
    branchServer.branchId,
    stockData.product_id,
    stockData.quantity_in_stock,
    stockData.min_stock_level,
    stockData.max_stock_level,
    stockData.last_counted_at || new Date().toISOString()
  ]);
  
  // Create stock movement record if stock changed
  const stockChange = stockData.quantity_in_stock - previousStock;
  if (stockChange !== 0) {
    await DatabaseManager.query(`
      INSERT INTO stock_movements (
        branch_id, product_id, movement_type, quantity, reason, created_at
      ) VALUES (
        $1, $2, $3, $4, 'Manual stock update', NOW()
      )
    `, [
      branchServer.branchId,
      stockData.product_id,
      stockChange > 0 ? 'adjustment_in' : 'adjustment_out',
      Math.abs(stockChange)
    ]);
  }
  
  res.json({
    success: true,
    data: {
      message: 'Stock updated successfully',
      product_id: stockData.product_id,
      product_name: productResult.rows[0].name,
      branch_code: branchServer.branchCode,
      previous_stock: previousStock,
      new_stock: stockData.quantity_in_stock,
      stock_change: stockChange,
      updated_stock_info: upsertResult.rows[0]
    }
  });
}));

/**
 * GET /api/branches/products/inventory/low-stock
 * Get products with low stock levels in this branch
 */
router.get('/inventory/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { threshold } = req.query;
  
  const query = `
    SELECT 
      bi.product_id,
      bi.quantity_in_stock,
      bi.min_stock_level as minimum_stock,
      bi.max_stock_level as maximum_stock,
      bi.last_counted_at,
      bi.updated_at,
      p.name as product_name,
      p.sku,
      p.barcode,
      c.name as category_name,
      bpp.price,
      bpp.is_available
    FROM branch_inventory bi
    JOIN products p ON bi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON bi.product_id = bpp.product_id AND bi.branch_id = bpp.branch_id
    WHERE bi.branch_id = $1 
      AND p.is_active = true
      AND (
        (bi.min_stock_level > 0 AND bi.quantity_in_stock <= bi.min_stock_level)
        OR (bi.min_stock_level IS NULL AND bi.quantity_in_stock <= $2)
      )
    ORDER BY 
      CASE 
        WHEN bi.min_stock_level > 0 THEN (bi.quantity_in_stock::float / bi.min_stock_level)
        ELSE bi.quantity_in_stock
      END ASC
  `;
  
  const defaultThreshold = threshold ? Number(threshold) : 10;
  const result = await DatabaseManager.query(query, [branchServer.branchId, defaultThreshold]);
  
  res.json({
    success: true,
    data: {
      low_stock_products: result.rows,
      branch_code: branchServer.branchCode,
      threshold_used: defaultThreshold,
      total_low_stock_items: result.rows.length
    }
  });
}));

export default router;
