import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  name_ru: z.string().optional(),
  name_uz: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  category_id: z.string().uuid('Valid category ID is required'),
  base_price: z.number().min(0, 'Price must be non-negative'),
  cost: z.number().min(0, 'Cost must be non-negative').optional(),
  description: z.string().optional(),
  description_ru: z.string().optional(),
  description_uz: z.string().optional(),
  brand: z.string().optional(),
  unit_of_measure: z.string().default('pcs'),
  tax_rate: z.number().min(0).max(1).default(0),
  image_url: z.string().optional(),
  is_active: z.boolean().default(true),
});

const updateProductSchema = createProductSchema.partial();

// GET /api/products - Get all products
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { category_id, is_active, search } = req.query;
  
  let query = `
    SELECT 
      p.id, p.name, p.name_ru, p.name_uz, p.sku, p.barcode, p.category_id, 
      p.base_price, p.cost, p.description, p.description_ru, p.description_uz,
      p.brand, p.unit_of_measure, p.tax_rate, p.image_url, p.is_active, 
      p.created_at, p.updated_at,
      c.name as category_name, c.name_ru as category_name_ru, c.name_uz as category_name_uz
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (category_id) {
    query += ` AND p.category_id = $${paramIndex}`;
    params.push(category_id);
    paramIndex++;
  }
  
  if (is_active !== undefined) {
    query += ` AND p.is_active = $${paramIndex}`;
    params.push(is_active === 'true');
    paramIndex++;
  }
  
  if (search) {
    query += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }
  
  query += ` ORDER BY p.name ASC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      products: result.rows
    }
  });
}));

// GET /api/products/categories - Get all categories
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  const query = `
    SELECT id, key, name, name_ru, name_uz, description, description_ru, description_uz, 
           parent_id, sort_order, is_active, created_at, updated_at
    FROM categories
    WHERE is_active = true
    ORDER BY sort_order ASC, name ASC
  `;
  
  const result = await DatabaseManager.query(query);
  
  res.json({
    success: true,
    data: { categories: result.rows }
  });
}));

// POST /api/products/categories - Create new category
router.post('/categories', asyncHandler(async (req: Request, res: Response) => {
  const { key, name, name_ru, name_uz, description, description_ru, description_uz, parent_id, sort_order } = z.object({
    key: z.string().min(1, 'Category key is required'),
    name: z.string().min(1, 'Category name is required'),
    name_ru: z.string().optional(),
    name_uz: z.string().optional(),
    description: z.string().optional(),
    description_ru: z.string().optional(),
    description_uz: z.string().optional(),
    parent_id: z.string().uuid().optional(),
    sort_order: z.number().default(0),
  }).parse(req.body);
  
  // Check if category key already exists
  const existingCategory = await DatabaseManager.query(
    'SELECT id FROM categories WHERE key = $1',
    [key]
  );
  
  if (existingCategory.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Category key already exists'
    });
  }
  
  const insertQuery = `
    INSERT INTO categories (key, name, name_ru, name_uz, description, description_ru, description_uz, 
                           parent_id, sort_order, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
    RETURNING id, key, name, name_ru, name_uz, description, description_ru, description_uz, 
             parent_id, sort_order, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    key, name, name_ru, name_uz, description, description_ru, description_uz, 
    parent_id, sort_order
  ]);
  
  res.status(201).json({
    success: true,
    data: { category: result.rows[0] }
  });
}));

// GET /api/products/:id - Get specific product
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      p.id, p.name, p.name_ru, p.name_uz, p.sku, p.barcode, p.category_id, 
      p.base_price, p.cost, p.description, p.description_ru, p.description_uz,
      p.brand, p.unit_of_measure, p.tax_rate, p.image_url, p.is_active, 
      p.created_at, p.updated_at,
      c.name as category_name, c.name_ru as category_name_ru, c.name_uz as category_name_uz
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  res.json({
    success: true,
    data: { product: result.rows[0] }
  });
}));

// GET /api/products/by-sku/:sku - Get product by SKU
router.get('/by-sku/:sku', asyncHandler(async (req: Request, res: Response) => {
  const { sku } = req.params;
  
  const query = `
    SELECT 
      p.id, p.name, p.name_ru, p.name_uz, p.sku, p.barcode, p.category_id, 
      p.base_price, p.cost, p.description, p.description_ru, p.description_uz,
      p.brand, p.unit_of_measure, p.tax_rate, p.image_url, p.is_active, 
      p.created_at, p.updated_at,
      c.name as category_name, c.name_ru as category_name_ru, c.name_uz as category_name_uz
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.sku = $1
  `;
  
  const result = await DatabaseManager.query(query, [sku]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  res.json({
    success: true,
    data: { product: result.rows[0] }
  });
}));

// GET /api/products/by-barcode/:barcode - Get product by barcode
router.get('/by-barcode/:barcode', asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.params;
  
  const query = `
    SELECT 
      p.id, p.name, p.name_ru, p.name_uz, p.sku, p.barcode, p.category_id, 
      p.base_price, p.cost, p.description, p.description_ru, p.description_uz,
      p.brand, p.unit_of_measure, p.tax_rate, p.image_url, p.is_active, 
      p.created_at, p.updated_at,
      c.name as category_name, c.name_ru as category_name_ru, c.name_uz as category_name_uz
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.barcode = $1
  `;
  
  const result = await DatabaseManager.query(query, [barcode]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  res.json({
    success: true,
    data: { product: result.rows[0] }
  });
}));

// POST /api/products - Create new product
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createProductSchema.parse(req.body);
  
  // Check if SKU already exists
  const existingSku = await DatabaseManager.query(
    'SELECT id FROM products WHERE sku = $1',
    [validatedData.sku]
  );
  
  if (existingSku.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'SKU already exists'
    });
  }
  
  // Check if barcode already exists (if provided)
  if (validatedData.barcode) {
    const existingBarcode = await DatabaseManager.query(
      'SELECT id FROM products WHERE barcode = $1',
      [validatedData.barcode]
    );
    
    if (existingBarcode.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Barcode already exists'
      });
    }
  }
  
  // Verify category exists
  const categoryExists = await DatabaseManager.query(
    'SELECT id FROM categories WHERE id = $1',
    [validatedData.category_id]
  );
  
  if (categoryExists.rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Category not found'
    });
  }
  
  const insertQuery = `
    INSERT INTO products (
      name, name_ru, name_uz, sku, barcode, category_id, base_price, cost, 
      description, description_ru, description_uz, brand, unit_of_measure, 
      tax_rate, image_url, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
    )
    RETURNING id, name, name_ru, name_uz, sku, barcode, category_id, base_price, cost, 
             description, description_ru, description_uz, brand, unit_of_measure, 
             tax_rate, image_url, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.name,
    validatedData.name_ru,
    validatedData.name_uz,
    validatedData.sku,
    validatedData.barcode,
    validatedData.category_id,
    validatedData.base_price,
    validatedData.cost,
    validatedData.description,
    validatedData.description_ru,
    validatedData.description_uz,
    validatedData.brand,
    validatedData.unit_of_measure,
    validatedData.tax_rate,
    validatedData.image_url,
    validatedData.is_active
  ]);
  
  // Get category name for response
  const categoryResult = await DatabaseManager.query(
    'SELECT name, name_ru, name_uz FROM categories WHERE id = $1',
    [validatedData.category_id]
  );
  
  const product = {
    ...result.rows[0],
    category_name: categoryResult.rows[0]?.name,
    category_name_ru: categoryResult.rows[0]?.name_ru,
    category_name_uz: categoryResult.rows[0]?.name_uz
  };
  
  res.status(201).json({
    success: true,
    data: { product }
  });
}));

// PUT /api/products/:id - Update product
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updateProductSchema.parse(req.body);
  
  // Check if product exists
  const existingProduct = await DatabaseManager.query(
    'SELECT id FROM products WHERE id = $1',
    [id]
  );
  
  if (existingProduct.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  // Check if SKU already exists (if being updated)
  if (validatedData.sku) {
    const existingSku = await DatabaseManager.query(
      'SELECT id FROM products WHERE sku = $1 AND id != $2',
      [validatedData.sku, id]
    );
    
    if (existingSku.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'SKU already exists'
      });
    }
  }
  
  // Check if barcode already exists (if being updated)
  if (validatedData.barcode) {
    const existingBarcode = await DatabaseManager.query(
      'SELECT id FROM products WHERE barcode = $1 AND id != $2',
      [validatedData.barcode, id]
    );
    
    if (existingBarcode.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Barcode already exists'
      });
    }
  }
  
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(validatedData)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No fields to update'
    });
  }
  
  updateFields.push(`updated_at = NOW()`);
  values.push(id);
  
  const updateQuery = `
    UPDATE products 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, name_ru, name_uz, sku, barcode, category_id, base_price, cost, 
             description, description_ru, description_uz, brand, unit_of_measure, 
             tax_rate, image_url, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  // Get category name for response
  const categoryResult = await DatabaseManager.query(
    'SELECT name, name_ru, name_uz FROM categories WHERE id = $1',
    [result.rows[0].category_id]
  );
  
  const product = {
    ...result.rows[0],
    category_name: categoryResult.rows[0]?.name,
    category_name_ru: categoryResult.rows[0]?.name_ru,
    category_name_uz: categoryResult.rows[0]?.name_uz
  };
  
  res.json({
    success: true,
    data: { product }
  });
}));

// DELETE /api/products/:id - Delete product (soft delete)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(
    'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Product deactivated successfully'
  });
}));

export default router;
