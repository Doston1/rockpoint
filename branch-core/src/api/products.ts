import { DatabaseManager } from '@/database/manager';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { RedisManager } from '@/services/redis';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

const router = Router();

// Validation schemas
const productSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

const barcodeSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required')
});

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  barcode: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  cost: z.number().min(0, 'Cost must be positive').optional(),
  quantity_in_stock: z.number().min(0, 'Stock quantity must be positive').optional(),
  low_stock_threshold: z.number().min(0, 'Low stock threshold must be positive').optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
  is_active: z.boolean().optional()
});

const updateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').optional(),
  barcode: z.string().optional(),
  price: z.number().min(0, 'Price must be positive').optional(),
  cost: z.number().min(0, 'Cost must be positive').optional(),
  quantity_in_stock: z.number().min(0, 'Stock quantity must be positive').optional(),
  low_stock_threshold: z.number().min(0, 'Low stock threshold must be positive').optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
  is_active: z.boolean().optional()
});

// GET /api/products - Get all products (NEW)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const allProductsQuery = `
    SELECT 
      id, name, barcode, price, cost, quantity_in_stock, 
      low_stock_threshold, category, brand, description, image_url, 
      is_active, created_at, updated_at
    FROM products 
    ORDER BY name ASC
  `;

  const result = await DatabaseManager.query(allProductsQuery);

  res.json({
    success: true,
    data: result.rows
  });
}));

// GET /api/products/search
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const { query, limit, offset } = productSearchSchema.parse(req.query);

  const searchQuery = `
    SELECT 
      id, name, barcode, price, cost, quantity_in_stock, 
      category, brand, description, image_url, 
      is_active, created_at, updated_at
    FROM products 
    WHERE 
      is_active = true 
      AND (
        name ILIKE $1 
        OR barcode ILIKE $1 
        OR description ILIKE $1
        OR brand ILIKE $1
      )
    ORDER BY name ASC
    LIMIT $2 OFFSET $3
  `;

  const searchPattern = `%${query}%`;
  const result = await DatabaseManager.query(searchQuery, [searchPattern, limit, offset]);

  res.json({
    success: true,
    data: {
      products: result.rows,
      total: result.rowCount,
      limit,
      offset
    }
  });
}));

// GET /api/products/autocomplete - Optimized for fast autocomplete responses
router.get('/autocomplete', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.query as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 8, 10); // Max 10 results for autocomplete

  if (!query || query.length < 2) {
    return res.json({
      success: true,
      data: { products: [] }
    });
  }

  // First, try exact name matches (higher priority)
  const exactQuery = `
    SELECT 
      id, name, barcode, price, quantity_in_stock, 
      category, brand, low_stock_threshold
    FROM products 
    WHERE 
      is_active = true 
      AND name ILIKE $1
    ORDER BY name ASC
    LIMIT $2
  `;

  const exactPattern = `${query}%`; // Starts with query
  const exactResult = await DatabaseManager.query(exactQuery, [exactPattern, limit]);

  // If we have enough exact matches, return them
  if (exactResult.rows.length >= limit) {
    return res.json({
      success: true,
      data: { products: exactResult.rows }
    });
  }

  // Otherwise, get partial matches to fill the rest
  const remaining = limit - exactResult.rows.length;
  
  if (remaining > 0) {
    let partialQuery: string;
    let partialParams: any[];
    
    if (exactResult.rows.length > 0) {
      // If we have exact matches, exclude them
      const excludeIds = exactResult.rows.map((r: any) => `'${r.id}'`).join(',');
      partialQuery = `
        SELECT 
          id, name, barcode, price, quantity_in_stock, 
          category, brand, low_stock_threshold
        FROM products 
        WHERE 
          is_active = true 
          AND (
            name ILIKE $1 
            OR barcode ILIKE $1
          )
          AND id NOT IN (${excludeIds})
        ORDER BY name ASC
        LIMIT $2
      `;
      const partialPattern = `%${query}%`;
      partialParams = [partialPattern, remaining];
    } else {
      // If no exact matches, just do the partial search
      partialQuery = `
        SELECT 
          id, name, barcode, price, quantity_in_stock, 
          category, brand, low_stock_threshold
        FROM products 
        WHERE 
          is_active = true 
          AND (
            name ILIKE $1 
            OR barcode ILIKE $1
          )
        ORDER BY name ASC
        LIMIT $2
      `;
      const partialPattern = `%${query}%`;
      partialParams = [partialPattern, remaining];
    }

    const partialResult = await DatabaseManager.query(partialQuery, partialParams);
    
    // Combine results
    const combinedResults = [...exactResult.rows, ...partialResult.rows];

    res.json({
      success: true,
      data: { products: combinedResults }
    });
  } else {
    res.json({
      success: true,
      data: { products: exactResult.rows }
    });
  }
}));

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = barcodeSchema.parse(req.params);

  // Try to get from cache first
  const cachedProduct = await RedisManager.getCachedProduct(barcode);
  if (cachedProduct) {
    return res.json({
      success: true,
      data: { product: cachedProduct, fromCache: true }
    });
  }

  const productQuery = `
    SELECT 
      id, name, barcode, price, cost, quantity_in_stock, 
      category, brand, description, image_url, 
      is_active, created_at, updated_at
    FROM products 
    WHERE barcode = $1 AND is_active = true
  `;

  const result = await DatabaseManager.query(productQuery, [barcode]);
  const product = result.rows[0];

  if (!product) {
    throw createError('Product not found', 404);
  }

  // Cache the product for future requests
  await RedisManager.cacheProduct(barcode, product);

  res.json({
    success: true,
    data: { product, fromCache: false }
  });
}));

// GET /api/products/categories
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const categoriesQuery = `
    SELECT DISTINCT category as name, COUNT(*) as product_count
    FROM products 
    WHERE is_active = true AND category IS NOT NULL AND category != ''
    GROUP BY category
    ORDER BY category ASC
  `;

  const result = await DatabaseManager.query(categoriesQuery);

  res.json({
    success: true,
    data: { categories: result.rows }
  });
}));

// GET /api/products/low-stock - Must come before /:id route
router.get('/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const threshold = parseInt(req.query.threshold as string) || 10;

  const lowStockQuery = `
    SELECT 
      id, name, barcode, price, cost, quantity_in_stock, 
      low_stock_threshold, category, brand, description, image_url,
      is_active, created_at, updated_at
    FROM products 
    WHERE 
      is_active = true 
      AND quantity_in_stock <= COALESCE(low_stock_threshold, $1)
    ORDER BY quantity_in_stock ASC
  `;

  const result = await DatabaseManager.query(lowStockQuery, [threshold]);

  res.json({
    success: true,
    data: result.rows
  });
}));

// GET /api/products/popular
router.get('/popular', asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;
  const limit = parseInt(req.query.limit as string) || 20;

  const popularQuery = `
    SELECT 
      p.id, p.name, p.barcode, p.price, p.category,
      SUM(ti.quantity) as total_sold,
      COUNT(DISTINCT ti.transaction_id) as transaction_count
    FROM products p
    JOIN transaction_items ti ON p.id = ti.product_id
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE 
      t.created_at >= NOW() - INTERVAL '${days} days'
      AND t.status = 'completed'
      AND p.is_active = true
    GROUP BY p.id, p.name, p.barcode, p.price, p.category
    ORDER BY total_sold DESC
    LIMIT $1
  `;

  const result = await DatabaseManager.query(popularQuery, [limit]);

  res.json({
    success: true,
    data: {
      products: result.rows,
      period: `${days} days`,
      limit
    }
  });
}));

// GET /api/products/category/:category
router.get('/category/:category', asyncHandler(async (req: Request, res: Response) => {
  const category = req.params.category;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const categoryQuery = `
    SELECT 
      id, name, barcode, price, cost, quantity_in_stock, 
      category, brand, description, image_url, 
      is_active, created_at, updated_at
    FROM products 
    WHERE category = $1 AND is_active = true
    ORDER BY name ASC
    LIMIT $2 OFFSET $3
  `;

  const result = await DatabaseManager.query(categoryQuery, [category, limit, offset]);

  res.json({
    success: true,
    data: {
      products: result.rows,
      category,
      total: result.rowCount,
      limit,
      offset
    }
  });
}));

// POST /api/products - Create new product (NEW)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createProductSchema.parse(req.body);

  const createQuery = `
    INSERT INTO products (
      name, barcode, price, cost, quantity_in_stock, 
      low_stock_threshold, category, brand, description, 
      image_url, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING id, name, barcode, price, cost, quantity_in_stock, 
             low_stock_threshold, category, brand, description, 
             image_url, is_active, created_at, updated_at
  `;

  const values = [
    validatedData.name,
    validatedData.barcode || null,
    validatedData.price,
    validatedData.cost || 0,
    validatedData.quantity_in_stock || 0,
    validatedData.low_stock_threshold || 10,
    validatedData.category || null,
    validatedData.brand || null,
    validatedData.description || null,
    validatedData.image_url || null,
    validatedData.is_active !== undefined ? validatedData.is_active : true
  ];

  const result = await DatabaseManager.query(createQuery, values);

  res.status(201).json({
    success: true,
    data: result.rows[0]
  });
}));

// PUT /api/products/:id - Update product (NEW)
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.id;
  const validatedData = updateProductSchema.parse(req.body);

  // Check if product exists
  const checkQuery = 'SELECT id FROM products WHERE id = $1';
  const checkResult = await DatabaseManager.query(checkQuery, [productId]);

  if (checkResult.rows.length === 0) {
    throw createError('Product not found', 404);
  }

  // Build dynamic update query
  const updateFields: string[] = [];
  const updateValues: any[] = [];
  let paramCount = 1;

  Object.entries(validatedData).forEach(([key, value]) => {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      updateValues.push(value);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw createError('No fields to update', 400);
  }

  updateFields.push(`updated_at = NOW()`);
  updateValues.push(productId);

  const updateQuery = `
    UPDATE products 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id, name, barcode, price, cost, quantity_in_stock, 
             low_stock_threshold, category, brand, description, 
             image_url, is_active, created_at, updated_at
  `;

  const result = await DatabaseManager.query(updateQuery, updateValues);

  // Clear product cache
  await RedisManager.del(`product:${productId}`);

  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// DELETE /api/products/:id - Delete product (NEW)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.id;

  // Check if product exists
  const checkQuery = 'SELECT id, name FROM products WHERE id = $1';
  const checkResult = await DatabaseManager.query(checkQuery, [productId]);

  if (checkResult.rows.length === 0) {
    throw createError('Product not found', 404);
  }

  // Check if product is used in any transactions
  const transactionCheckQuery = `
    SELECT COUNT(*) as usage_count 
    FROM transaction_items 
    WHERE product_id = $1
  `;
  const transactionResult = await DatabaseManager.query(transactionCheckQuery, [productId]);
  const usageCount = parseInt(transactionResult.rows[0].usage_count);

  if (usageCount > 0) {
    // If product is used in transactions, soft delete (mark as inactive)
    const softDeleteQuery = `
      UPDATE products 
      SET is_active = false, updated_at = NOW() 
      WHERE id = $1
    `;
    await DatabaseManager.query(softDeleteQuery, [productId]);

    res.json({
      success: true,
      message: 'Product deactivated (soft delete) due to existing transaction history'
    });
  } else {
    // If not used in transactions, hard delete
    const deleteQuery = 'DELETE FROM products WHERE id = $1';
    await DatabaseManager.query(deleteQuery, [productId]);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  }

  // Clear product cache
  await RedisManager.del(`product:${productId}`);
}));

// GET /api/products/:id - Must come after specific routes
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.id;

  const productQuery = `
    SELECT 
      id, name, barcode, price, cost, quantity_in_stock, 
      category, brand, description, image_url, 
      is_active, created_at, updated_at
    FROM products 
    WHERE id = $1
  `;

  const result = await DatabaseManager.query(productQuery, [productId]);
  const product = result.rows[0];

  if (!product) {
    throw createError('Product not found', 404);
  }

  res.json({
    success: true,
    data: { product }
  });
}));

// POST /api/products/:id/update-stock
router.post('/:id/update-stock', asyncHandler(async (req: Request, res: Response) => {
  const productId = req.params.id;
  const { quantity, operation, reason } = req.body;

  // Validate input
  if (!['add', 'subtract', 'set'].includes(operation)) {
    throw createError('Invalid operation. Must be add, subtract, or set', 400);
  }

  if (typeof quantity !== 'number' || quantity < 0) {
    throw createError('Quantity must be a positive number', 400);
  }

  await DatabaseManager.transaction(async (client) => {
    // Get current stock
    const stockQuery = 'SELECT quantity_in_stock, name FROM products WHERE id = $1';
    const stockResult = await client.query(stockQuery, [productId]);
    const product = stockResult.rows[0];

    if (!product) {
      throw createError('Product not found', 404);
    }

    let newQuantity;
    switch (operation) {
      case 'add':
        newQuantity = product.quantity_in_stock + quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, product.quantity_in_stock - quantity);
        break;
      case 'set':
        newQuantity = quantity;
        break;
      default:
        throw createError('Invalid operation', 400);
    }

    // Update stock
    await client.query(
      'UPDATE products SET quantity_in_stock = $1, updated_at = NOW() WHERE id = $2',
      [newQuantity, productId]
    );

    // Log stock change (if stock_movements table exists)
    try {
      await client.query(
        `INSERT INTO stock_movements 
         (product_id, old_quantity, new_quantity, change_quantity, operation, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [productId, product.quantity_in_stock, newQuantity, quantity, operation, reason || 'Manual adjustment']
      );
    } catch (error) {
      // If stock_movements table doesn't exist, just log the error but continue
      console.warn('Stock movements table not found, skipping stock history log');
    }

    // Clear product cache
    await RedisManager.del(`product:${productId}`);
  });

  res.json({
    success: true,
    message: 'Stock updated successfully'
  });
}));

export default router;
