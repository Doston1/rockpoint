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
    WHERE is_active = true
    GROUP BY category
    ORDER BY category ASC
  `;

  const result = await DatabaseManager.query(categoriesQuery);

  res.json({
    success: true,
    data: { categories: result.rows }
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

// GET /api/products/:id
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

    // Log stock change
    await client.query(
      `INSERT INTO stock_movements 
       (product_id, old_quantity, new_quantity, change_quantity, operation, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [productId, product.quantity_in_stock, newQuantity, quantity, operation, reason || 'Manual adjustment']
    );

    // Clear product cache
    await RedisManager.del(`product:${productId}`);
  });

  res.json({
    success: true,
    message: 'Stock updated successfully'
  });
}));

// GET /api/products/low-stock
router.get('/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const threshold = parseInt(req.query.threshold as string) || 10;

  const lowStockQuery = `
    SELECT 
      id, name, barcode, price, quantity_in_stock, 
      category, brand, low_stock_threshold
    FROM products 
    WHERE 
      is_active = true 
      AND quantity_in_stock <= COALESCE(low_stock_threshold, $1)
    ORDER BY quantity_in_stock ASC
  `;

  const result = await DatabaseManager.query(lowStockQuery, [threshold]);

  res.json({
    success: true,
    data: {
      products: result.rows,
      count: result.rowCount,
      threshold
    }
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

export default router;
