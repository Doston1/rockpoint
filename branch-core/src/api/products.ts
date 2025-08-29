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
  is_active: z.boolean().optional(),
  // Translation fields
  name_ru: z.string().optional(),
  name_uz: z.string().optional(),
  description_ru: z.string().optional(),
  description_uz: z.string().optional()
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

// Helper function to get localized field names
const getLocalizedFields = (language: string = 'en') => {
  let nameField: string;
  let descField: string;
  
  switch (language) {
    case 'ru':
      nameField = 'COALESCE(p.name_ru, p.name) as name';
      descField = 'COALESCE(p.description_ru, p.description) as description';
      break;
    case 'uz':
      nameField = 'COALESCE(p.name_uz, p.name) as name';
      descField = 'COALESCE(p.description_uz, p.description) as description';
      break;
    default:
      nameField = 'p.name';
      descField = 'p.description';
      break;
  }
  
  return { nameField, descField };
};

// Helper function to get localized category field
const getLocalizedCategoryField = (language: string = 'en') => {
  switch (language) {
    case 'ru':
      return 'COALESCE(c.name_ru, c.name_en, p.category) as category';
    case 'uz':
      return 'COALESCE(c.name_uz, c.name_en, p.category) as category';
    default:
      return 'COALESCE(c.name_en, p.category) as category';
  }
};

// GET /api/products - Get all products (NEW)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { limit = 50, offset = 0, category } = req.query;
  const language = (req.query.language as string) || 'en';
  
  const { nameField, descField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);
  
  let query = `
    SELECT 
      p.id, p.sku, ${nameField}, ${descField}, p.barcode, p.price, p.cost, p.quantity_in_stock, 
      ${categoryField}, p.brand, p.image_url, p.is_active, p.created_at, p.updated_at,
      p.low_stock_threshold
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE p.is_active = true
  `;
  
  const params: any[] = [Number(limit), Number(offset)];
  
  if (category && category !== 'all') {
    query += ` AND p.category = $3`;
    params.push(category);
    query += ` ORDER BY p.name ASC LIMIT $1 OFFSET $2`;
  } else {
    query += ` ORDER BY p.name ASC LIMIT $1 OFFSET $2`;
  }

  const result = await DatabaseManager.query(query, params);

  res.json({
    success: true,
    data: {
      products: result.rows,
      total: result.rowCount,
      limit: Number(limit),
      offset: Number(offset)
    }
  });
}));

// GET /api/products/search
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const { query, limit = 20, offset = 0 } = req.query;
  const language = (req.query.language as string) || 'en';
  
  const { nameField, descField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);
  
  const searchQuery = `
    SELECT 
      p.id, p.sku, ${nameField}, ${descField}, p.barcode, p.price, p.cost, p.quantity_in_stock, 
      ${categoryField}, p.brand, p.image_url, p.is_active, p.created_at, p.updated_at,
      p.low_stock_threshold
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE 
      p.is_active = true 
      AND (
        p.name ILIKE $1 
        OR p.sku ILIKE $1 
        OR p.barcode ILIKE $1 
        OR p.description ILIKE $1
        OR p.brand ILIKE $1
        OR p.category ILIKE $1
      )
    ORDER BY p.name ASC
    LIMIT $2 OFFSET $3
  `;

  const searchPattern = `%${query}%`;
  const result = await DatabaseManager.query(searchQuery, [searchPattern, Number(limit), Number(offset)]);

  res.json({
    success: true,
    data: {
      products: result.rows,
      total: result.rowCount,
      limit: Number(limit),
      offset: Number(offset)
    }
  });
}));

// GET /api/products/autocomplete - Optimized for fast autocomplete responses
router.get('/autocomplete', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.query as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 8, 10); // Max 10 results for autocomplete
  const language = (req.query.language as string) || 'en';
  
  const { nameField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);

  if (!query || query.length < 2) {
    return res.json({
      success: true,
      data: { products: [] }
    });
  }

  // First, try exact name matches (higher priority)
  const exactQuery = `
    SELECT 
      p.id, p.sku, ${nameField}, p.barcode, p.price, p.quantity_in_stock, 
      ${categoryField}, p.brand, p.low_stock_threshold
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE 
      p.is_active = true 
      AND (p.name ILIKE $1 OR p.sku ILIKE $1)
    ORDER BY p.name ASC
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
          p.id, p.sku, ${nameField}, p.barcode, p.price, p.quantity_in_stock, 
          ${categoryField}, p.brand, p.low_stock_threshold
        FROM products p
        LEFT JOIN categories c ON p.category = c.key
        WHERE 
          p.is_active = true 
          AND (
            p.name ILIKE $1 
            OR p.sku ILIKE $1 
            OR p.barcode ILIKE $1
          )
          AND p.id NOT IN (${excludeIds})
        ORDER BY p.name ASC
        LIMIT $2
      `;
      const partialPattern = `%${query}%`;
      partialParams = [partialPattern, remaining];
    } else {
      // If no exact matches, just do the partial search
      partialQuery = `
        SELECT 
          p.id, p.sku, ${nameField}, p.barcode, p.price, p.quantity_in_stock, 
          ${categoryField}, p.brand, p.low_stock_threshold
        FROM products p
        LEFT JOIN categories c ON p.category = c.key
        WHERE 
          p.is_active = true 
          AND (
            p.name ILIKE $1 
            OR p.sku ILIKE $1 
            OR p.barcode ILIKE $1
          )
        ORDER BY p.name ASC
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
  const language = (req.query.language as string) || 'en';
  
  const { nameField, descField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);
  
  const productQuery = `
    SELECT 
      p.id, p.sku, ${nameField}, ${descField}, p.barcode, p.price, p.cost, p.quantity_in_stock, 
      ${categoryField}, p.brand, p.image_url, p.is_active, p.created_at, p.updated_at,
      p.low_stock_threshold
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE p.barcode = $1 AND p.is_active = true
  `;

  const result = await DatabaseManager.query(productQuery, [barcode]);
  const product = result.rows[0];

  if (!product) {
    throw createError('Product not found', 404);
  }

  res.json({
    success: true,
    data: { product, fromCache: false }
  });
}));

// GET /api/products/by-ids - Get products by array of IDs
router.get('/by-ids', asyncHandler(async (req: Request, res: Response) => {
  const idsParam = req.query.ids as string;
  const language = (req.query.language as string) || 'en';
  
  if (!idsParam) {
    throw createError('Product IDs are required', 400);
  }
  
  const productIds = idsParam.split(',').filter(id => id.trim().length > 0);
  
  if (productIds.length === 0) {
    res.json({
      success: true,
      data: { products: [] }
    });
    return;
  }
  
  const { nameField, descField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);
  
  // Create placeholders for the IN clause
  const placeholders = productIds.map((_, index) => `$${index + 1}`).join(',');
  
  const productQuery = `
    SELECT 
      p.id, p.sku, ${nameField}, ${descField}, p.barcode, p.price, p.cost, p.quantity_in_stock, 
      ${categoryField}, p.brand, p.image_url, p.is_active, p.created_at, p.updated_at,
      p.low_stock_threshold
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE p.id IN (${placeholders}) AND p.is_active = true
    ORDER BY p.name_en
  `;

  const result = await DatabaseManager.query(productQuery, productIds);

  res.json({
    success: true,
    data: { products: result.rows }
  });
}));

// Categories endpoints
// GET /api/products/categories
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const language = (req.query.language as string) || 'en';
  
  let categoryNameField: string;
  let orderByField: string;
  
  switch (language) {
    case 'ru':
      categoryNameField = 'COALESCE(c.name_ru, c.name_en, p.category) as name';
      orderByField = 'COALESCE(c.name_ru, c.name_en, p.category)';
      break;
    case 'uz':
      categoryNameField = 'COALESCE(c.name_uz, c.name_en, p.category) as name';
      orderByField = 'COALESCE(c.name_uz, c.name_en, p.category)';
      break;
    default:
      categoryNameField = 'COALESCE(c.name_en, p.category) as name';
      orderByField = 'COALESCE(c.name_en, p.category)';
      break;
  }

  const categoriesQuery = `
    SELECT DISTINCT 
      p.category as key,
      ${categoryNameField},
      COUNT(*) as product_count
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE p.is_active = true AND p.category IS NOT NULL AND p.category != ''
    GROUP BY p.category, c.name_en, c.name_ru, c.name_uz
    ORDER BY ${orderByField} ASC
  `;

  const result = await DatabaseManager.query(categoriesQuery);

  res.json({
    success: true,
    data: { categories: result.rows }
  });
}));

// POST /api/products/categories - Create new category
router.post('/categories', asyncHandler(async (req: Request, res: Response) => {
  const { name_en, name_ru, name_uz } = req.body;

  // Validate required fields
  if (!name_en || !name_ru || !name_uz) {
    throw createError('All language names are required (name_en, name_ru, name_uz)', 400);
  }

  // Create category key from English name (lowercase, replace spaces with hyphens)
  const key = name_en.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const createCategoryQuery = `
    INSERT INTO categories (key, name_en, name_ru, name_uz, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING id, key, name_en, name_ru, name_uz, created_at, updated_at
  `;

  try {
    const result = await DatabaseManager.query(createCategoryQuery, [key, name_en, name_ru, name_uz]);

    res.status(201).json({
      success: true,
      data: { category: result.rows[0] }
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      throw createError('Category with this name already exists', 409);
    }
    throw error;
  }
}));

// GET /api/products/low-stock - Must come before /:id route
router.get('/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const threshold = parseInt(req.query.threshold as string) || 10;
  const language = (req.query.language as string) || 'en';
  
  const { nameField, descField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);

  const lowStockQuery = `
    SELECT 
      p.id, p.sku, ${nameField}, p.barcode, p.price, p.cost, p.quantity_in_stock, 
      p.low_stock_threshold, ${categoryField}, p.brand, ${descField}, p.image_url,
      p.is_active, p.created_at, p.updated_at
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE 
      p.is_active = true 
      AND p.quantity_in_stock <= COALESCE(p.low_stock_threshold, $1)
    ORDER BY p.quantity_in_stock ASC
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
  const { category } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  const language = (req.query.language as string) || 'en';
  
  const { nameField, descField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);
  
  const query = `
    SELECT 
      p.id, p.sku, ${nameField}, ${descField}, p.barcode, p.price, p.cost, p.quantity_in_stock, 
      ${categoryField}, p.brand, p.image_url, p.is_active, p.created_at, p.updated_at,
      p.low_stock_threshold
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE p.category = $1 AND p.is_active = true
    ORDER BY p.name ASC
    LIMIT $2 OFFSET $3
  `;

  const result = await DatabaseManager.query(query, [category, Number(limit), Number(offset)]);

  res.json({
    success: true,
    data: {
      products: result.rows,
      total: result.rowCount,
      limit: Number(limit),
      offset: Number(offset)
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
      image_url, is_active, name_ru, name_uz, description_ru, description_uz,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
    RETURNING id, name, barcode, price, cost, quantity_in_stock, 
             low_stock_threshold, category, brand, description, 
             image_url, is_active, name_ru, name_uz, description_ru, description_uz,
             created_at, updated_at
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
    validatedData.is_active !== undefined ? validatedData.is_active : true,
    validatedData.name_ru || null,
    validatedData.name_uz || null,
    validatedData.description_ru || null,
    validatedData.description_uz || null
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
  const language = (req.query.language as string) || 'en';
  
  const { nameField, descField } = getLocalizedFields(language);
  const categoryField = getLocalizedCategoryField(language);

  const productQuery = `
    SELECT 
      p.id, p.sku, ${nameField}, ${descField}, p.barcode, p.price, p.cost, p.quantity_in_stock, 
      ${categoryField}, p.brand, p.image_url, p.is_active, p.created_at, p.updated_at,
      p.low_stock_threshold
    FROM products p
    LEFT JOIN categories c ON p.category = c.key
    WHERE p.id = $1
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
