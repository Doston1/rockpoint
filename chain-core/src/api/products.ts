import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  name_en: z.string().optional(),
  name_ru: z.string().optional(),
  name_uz: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  category_id: z.string().uuid('Valid category ID is required').optional(),
  category_name: z.string().optional(), // Accept category name instead of ID
  base_price: z.coerce.number().min(0, 'Price must be non-negative'),
  cost: z.coerce.number().min(0, 'Cost must be non-negative').optional(),
  description: z.string().optional(),
  description_en: z.string().optional(),
  description_ru: z.string().optional(),
  description_uz: z.string().optional(),
  brand: z.string().optional(),
  unit_of_measure: z.string().default('pcs'),
  tax_rate: z.coerce.number().min(0).max(100).default(0).transform(val => val > 1 ? val / 100 : val),
  image_url: z.string().optional(),
  attributes: z.record(z.any()).optional(),
  onec_id: z.string().optional(),
  is_active: z.boolean().default(true),
  selected_branches: z.array(z.string().uuid()).optional(), // Array of branch IDs
});

const updateProductSchema = createProductSchema.partial();

// GET /api/products - Get all products
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { category_id, is_active, search, branch_id } = req.query;
  
  let query = `
    SELECT 
      p.id, p.name, p.name_en, p.name_ru, p.name_uz, p.sku, p.barcode, p.category_id, 
      p.base_price, p.cost, p.description, p.description_en, p.description_ru, p.description_uz,
      p.brand, p.unit_of_measure, p.tax_rate, p.image_url, p.attributes, p.onec_id,
      p.created_at, p.updated_at,
      c.name as category_name, c.name_ru as category_name_ru, c.name_uz as category_name_uz
  `;
  
  // Add branch pricing fields if branch_id is provided
  if (branch_id) {
    query += `,
      COALESCE(bpp.price, p.base_price) as branch_price,
      COALESCE(bpp.cost, p.cost) as branch_cost,
      COALESCE(bpp.is_available, true) as is_available_in_branch,
      COALESCE(bpp.is_available, true) as is_active
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1`;
  } else {
    query += `,
      p.is_active
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id`;
  }
  
  query += `
    WHERE p.is_active = true
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  // Add branch_id as first parameter if provided
  if (branch_id) {
    params.push(branch_id);
    paramIndex++;
  }
  
  if (category_id) {
    query += ` AND p.category_id = $${paramIndex}`;
    params.push(category_id);
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
    SELECT id, key, name, name_en, name_ru, name_uz, description, description_ru, description_uz, 
           parent_id, sort_order, onec_id, is_active, created_at, updated_at
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
  const { key, name, name_en, name_ru, name_uz, description, description_ru, description_uz, parent_id, sort_order, onec_id } = z.object({
    key: z.string().min(1, 'Category key is required'),
    name: z.string().min(1, 'Category name is required'),
    name_en: z.string().optional(),
    name_ru: z.string().optional(),
    name_uz: z.string().optional(),
    description: z.string().optional(),
    description_ru: z.string().optional(),
    description_uz: z.string().optional(),
    parent_id: z.string().uuid().optional(),
    sort_order: z.number().default(0),
    onec_id: z.string().optional(),
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
    INSERT INTO categories (key, name, name_en, name_ru, name_uz, description, description_ru, description_uz, 
                           parent_id, sort_order, onec_id, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())
    RETURNING id, key, name, name_en, name_ru, name_uz, description, description_ru, description_uz, 
             parent_id, sort_order, onec_id, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    key, name, name_en, name_ru, name_uz, description, description_ru, description_uz, 
    parent_id, sort_order, onec_id
  ]);
  
  res.status(201).json({
    success: true,
    data: { category: result.rows[0] }
  });
}));

// PUT /api/products/categories/:id - Update category
router.put('/categories/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { key, name, name_en, name_ru, name_uz, description, description_ru, description_uz, parent_id, sort_order, is_active, onec_id } = z.object({
    key: z.string().min(1, 'Category key is required').optional(),
    name: z.string().min(1, 'Category name is required').optional(),
    name_en: z.string().optional(),
    name_ru: z.string().optional(),
    name_uz: z.string().optional(),
    description: z.string().optional(),
    description_ru: z.string().optional(),
    description_uz: z.string().optional(),
    parent_id: z.string().uuid().optional(),
    sort_order: z.number().optional(),
    is_active: z.boolean().optional(),
    onec_id: z.string().optional(),
  }).parse(req.body);
  
  // Check if category exists
  const existingCategory = await DatabaseManager.query(
    'SELECT id FROM categories WHERE id = $1',
    [id]
  );
  
  if (existingCategory.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Category not found'
    });
  }
  
  // Check if key already exists (if being updated)
  if (key) {
    const existingKey = await DatabaseManager.query(
      'SELECT id FROM categories WHERE key = $1 AND id != $2',
      [key, id]
    );
    
    if (existingKey.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Category key already exists'
      });
    }
  }
  
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramIndex = 1;
  
  const fieldMappings = {
    key: 'key',
    name: 'name',
    name_en: 'name_en',
    name_ru: 'name_ru',
    name_uz: 'name_uz',
    description: 'description',
    description_ru: 'description_ru',
    description_uz: 'description_uz',
    parent_id: 'parent_id',
    sort_order: 'sort_order',
    is_active: 'is_active',
    onec_id: 'onec_id'
  };
  
  for (const [frontendKey, dbKey] of Object.entries(fieldMappings)) {
    const value = req.body[frontendKey];
    if (value !== undefined) {
      updateFields.push(`${dbKey} = $${paramIndex}`);
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
    UPDATE categories 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, key, name, name_en, name_ru, name_uz, description, description_ru, description_uz, 
             parent_id, sort_order, onec_id, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  res.json({
    success: true,
    data: { category: result.rows[0] }
  });
}));

// DELETE /api/products/categories/:id - Delete category
router.delete('/categories/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Check if category exists
  const existingCategory = await DatabaseManager.query(
    'SELECT id, name, key FROM categories WHERE id = $1',
    [id]
  );
  
  if (existingCategory.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Category not found'
    });
  }
  
  const category = existingCategory.rows[0];
  
  // Check if category has products
  const productsCount = await DatabaseManager.query(
    'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
    [id]
  );
  
  if (productsCount.rows[0].count > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete category that has products assigned to it'
    });
  }
  
  // Soft delete - deactivate instead of hard delete
  const result = await DatabaseManager.query(
    'UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, name, key',
    [id]
  );
  
  res.json({
    success: true,
    message: `Category "${category.name}" deactivated successfully`,
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
  
  // Resolve category ID from name if category_name is provided instead of category_id
  let categoryId = validatedData.category_id;
  if (!categoryId && validatedData.category_name) {
    const categoryResult = await DatabaseManager.query(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) OR LOWER(name_ru) = LOWER($1) OR LOWER(name_uz) = LOWER($1) AND is_active = true',
      [validatedData.category_name.trim()]
    );
    
    if (categoryResult.rows.length > 0) {
      categoryId = categoryResult.rows[0].id;
    } else {
      return res.status(400).json({
        success: false,
        error: `Category '${validatedData.category_name}' not found`
      });
    }
  }
  
  // Verify category exists if provided
  if (categoryId) {
    const categoryExists = await DatabaseManager.query(
      'SELECT id FROM categories WHERE id = $1 AND is_active = true',
      [categoryId]
    );
    
    if (categoryExists.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Category not found'
      });
    }
  }
  
  const insertQuery = `
    INSERT INTO products (
      name, name_en, name_ru, name_uz, sku, barcode, category_id, base_price, cost, 
      description, description_en, description_ru, description_uz, brand, unit_of_measure, 
      tax_rate, image_url, attributes, onec_id, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
    )
    RETURNING id, name, name_en, name_ru, name_uz, sku, barcode, category_id, base_price, cost, 
             description, description_en, description_ru, description_uz, brand, unit_of_measure, 
             tax_rate, image_url, attributes, onec_id, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.name,
    validatedData.name_en,
    validatedData.name_ru,
    validatedData.name_uz,
    validatedData.sku,
    validatedData.barcode,
    categoryId, // Use resolved category ID
    validatedData.base_price,
    validatedData.cost,
    validatedData.description,
    validatedData.description_en,
    validatedData.description_ru,
    validatedData.description_uz,
    validatedData.brand,
    validatedData.unit_of_measure,
    validatedData.tax_rate,
    validatedData.image_url,
    validatedData.attributes ? JSON.stringify(validatedData.attributes) : null,
    validatedData.onec_id,
    validatedData.is_active
  ]);
  
  // Get category name for response
  let product = result.rows[0];
  if (categoryId) {
    const categoryResult = await DatabaseManager.query(
      'SELECT name, name_ru, name_uz FROM categories WHERE id = $1',
      [categoryId]
    );
    
    product = {
      ...product,
      category_name: categoryResult.rows[0]?.name,
      category_name_ru: categoryResult.rows[0]?.name_ru,
      category_name_uz: categoryResult.rows[0]?.name_uz
    };
  }
  
  // Distribute product to ALL branches
  try {
    // Get all active branches
    const allBranchesQuery = `
      SELECT id FROM branches WHERE is_active = true
    `;
    const allBranchesResult = await DatabaseManager.query(allBranchesQuery);
    const allBranches = allBranchesResult.rows.map((row: any) => row.id);
    
    const selectedBranches = validatedData.selected_branches || [];
    
    // Add product to each branch with appropriate availability status
    for (const branchId of allBranches) {
      const isAvailable = selectedBranches.includes(branchId);
      
      await DatabaseManager.query(`
        INSERT INTO branch_product_pricing (branch_id, product_id, price, cost, is_available, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (branch_id, product_id) 
        DO UPDATE SET 
          price = EXCLUDED.price,
          cost = EXCLUDED.cost,
          is_available = EXCLUDED.is_available,
          updated_at = NOW()
      `, [branchId, product.id, validatedData.base_price, validatedData.cost || 0, isAvailable]);
      
      // Also add to branch_inventory if it doesn't exist
      await DatabaseManager.query(`
        INSERT INTO branch_inventory (branch_id, product_id, quantity_in_stock, min_stock_level, max_stock_level, reorder_point, created_at, updated_at)
        VALUES ($1, $2, 0, 0, NULL, NULL, NOW(), NOW())
        ON CONFLICT (branch_id, product_id) DO NOTHING
      `, [branchId, product.id]);
    }
    
    const availableBranchesCount = selectedBranches.length;
    const unavailableBranchesCount = allBranches.length - availableBranchesCount;
    
    console.log(`Product ${product.id} distributed to ALL ${allBranches.length} branches:`);
    console.log(`  ✅ Available in: ${availableBranchesCount} branches`);
    console.log(`  ❌ Not available in: ${unavailableBranchesCount} branches`);
  } catch (error) {
    console.error('Error distributing product to branches:', error);
    // Don't fail the entire operation, just log the error
  }
  
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
  
  // Resolve category ID from name if category_name is provided
  let categoryId = validatedData.category_id;
  if (!categoryId && validatedData.category_name) {
    const categoryResult = await DatabaseManager.query(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) OR LOWER(name_en) = LOWER($1) AND is_active = true',
      [validatedData.category_name.trim()]
    );
    
    if (categoryResult.rows.length > 0) {
      categoryId = categoryResult.rows[0].id;
    } else {
      return res.status(400).json({
        success: false,
        error: `Category '${validatedData.category_name}' not found`
      });
    }
  }
  
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramIndex = 1;
  
  // Map frontend fields to database fields
  const fieldMappings = {
    name: 'name',
    name_en: 'name_en',
    name_ru: 'name_ru',
    name_uz: 'name_uz',
    sku: 'sku',
    barcode: 'barcode',
    base_price: 'base_price',
    cost: 'cost',
    description: 'description',
    description_en: 'description_en',
    description_ru: 'description_ru',
    description_uz: 'description_uz',
    brand: 'brand',
    unit_of_measure: 'unit_of_measure',
    tax_rate: 'tax_rate',
    image_url: 'image_url',
    attributes: 'attributes',
    onec_id: 'onec_id',
    is_active: 'is_active'
  };
  
  for (const [frontendKey, dbKey] of Object.entries(fieldMappings)) {
    const value = validatedData[frontendKey as keyof typeof validatedData];
    if (value !== undefined) {
      updateFields.push(`${dbKey} = $${paramIndex}`);
      if (frontendKey === 'attributes' && value) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
      paramIndex++;
    }
  }
  
  // Add category_id if resolved from category_name
  if (categoryId) {
    updateFields.push(`category_id = $${paramIndex}`);
    values.push(categoryId);
    paramIndex++;
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
    RETURNING id, name, name_en, name_ru, name_uz, sku, barcode, category_id, base_price, cost, 
             description, description_en, description_ru, description_uz, brand, unit_of_measure, 
             tax_rate, image_url, attributes, onec_id, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  // Get category name for response
  let product = result.rows[0];
  if (product.category_id) {
    const categoryResult = await DatabaseManager.query(
      'SELECT name, name_ru, name_uz FROM categories WHERE id = $1',
      [product.category_id]
    );
    
    product = {
      ...product,
      category_name: categoryResult.rows[0]?.name,
      category_name_ru: categoryResult.rows[0]?.name_ru,
      category_name_uz: categoryResult.rows[0]?.name_uz
    };
  }
  
  res.json({
    success: true,
    data: { product }
  });
}));

// DELETE /api/products/:id - Delete product (complete deletion from all branches)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Check if product exists
  const existingProduct = await DatabaseManager.query(
    'SELECT id, name, sku FROM products WHERE id = $1',
    [id]
  );
  
  if (existingProduct.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  const product = existingProduct.rows[0];
  
  try {
    // Start transaction to ensure all deletions happen atomically
    await DatabaseManager.query('BEGIN');
    
    // 1. Delete from branch inventory (stock records)
    const inventoryResult = await DatabaseManager.query(
      'DELETE FROM branch_inventory WHERE product_id = $1',
      [id]
    );
    
    // 2. Delete from branch product pricing
    const pricingResult = await DatabaseManager.query(
      'DELETE FROM branch_product_pricing WHERE product_id = $1',
      [id]
    );
    
    // 3. Delete from transaction items (historical sales records) - optional, you may want to keep these
    // Uncomment if you want to delete historical transaction data:
    // await DatabaseManager.query(
    //   'DELETE FROM transaction_items WHERE product_id = $1',
    //   [id]
    // );
    
    // 4. Delete from price sync status tracking
    await DatabaseManager.query(
      'DELETE FROM branch_product_price_sync_status WHERE product_id = $1',
      [id]
    );
    
    // 5. Delete any stock movements
    await DatabaseManager.query(
      'DELETE FROM stock_movements WHERE product_id = $1',
      [id]
    );
    
    // 6. Finally, delete from main products table
    const productResult = await DatabaseManager.query(
      'DELETE FROM products WHERE id = $1',
      [id]
    );
    
    // Commit transaction
    await DatabaseManager.query('COMMIT');
    
    console.log(`Product ${product.name} (${product.sku}) completely deleted from all systems`);
    console.log(`- Inventory records deleted: ${inventoryResult.rowCount}`);
    console.log(`- Pricing records deleted: ${pricingResult.rowCount}`);
    
    res.json({
      success: true,
      message: `Product "${product.name}" completely removed from all branches and systems`,
      details: {
        product_name: product.name,
        sku: product.sku,
        inventory_records_deleted: inventoryResult.rowCount,
        pricing_records_deleted: pricingResult.rowCount
      }
    });
    
  } catch (error) {
    // Rollback transaction on error
    await DatabaseManager.query('ROLLBACK');
    console.error('Error deleting product:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete product completely. No changes were made.'
    });
  }
}));

// DELETE /api/products/:id/soft - Soft delete product (deactivate but keep data)
router.delete('/:id/soft', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(
    'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, name, sku',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }
  
  const product = result.rows[0];
  
  // Also deactivate in branch pricing (but keep records)
  await DatabaseManager.query(
    'UPDATE branch_product_pricing SET is_available = false, updated_at = NOW() WHERE product_id = $1',
    [id]
  );
  
  res.json({
    success: true,
    message: `Product "${product.name}" deactivated successfully (data preserved)`,
    details: {
      product_name: product.name,
      sku: product.sku,
      deletion_type: 'soft_delete'
    }
  });
}));

export default router;
