import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createPromotionSchema = z.object({
  name: z.string().min(1, 'Promotion name is required'),
  description: z.string().optional(),
  type: z.enum(['percentage_discount', 'fixed_discount', 'buy_x_get_y', 'bulk_discount']),
  branch_id: z.string().uuid('Valid branch ID is required').optional(),
  product_id: z.string().uuid('Valid product ID is required').optional(),
  category_id: z.string().uuid('Valid category ID is required').optional(),
  discount_percentage: z.coerce.number().min(0).max(100, 'Discount percentage must be between 0 and 100').optional(),
  discount_amount: z.coerce.number().min(0, 'Discount amount must be non-negative').optional(),
  min_quantity: z.coerce.number().int().min(1, 'Minimum quantity must be at least 1').optional(),
  buy_quantity: z.coerce.number().int().min(1, 'Buy quantity must be at least 1').optional(),
  get_quantity: z.coerce.number().int().min(1, 'Get quantity must be at least 1').optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  is_active: z.boolean().default(true),
});

const updatePromotionSchema = z.object({
  name: z.string().min(1, 'Promotion name is required').optional(),
  description: z.string().optional(),
  type: z.enum(['percentage_discount', 'fixed_discount', 'buy_x_get_y', 'bulk_discount']).optional(),
  discount_percentage: z.coerce.number().min(0).max(100, 'Discount percentage must be between 0 and 100').optional(),
  discount_amount: z.coerce.number().min(0, 'Discount amount must be non-negative').optional(),
  min_quantity: z.coerce.number().int().min(1, 'Minimum quantity must be at least 1').optional(),
  buy_quantity: z.coerce.number().int().min(1, 'Buy quantity must be at least 1').optional(),
  get_quantity: z.coerce.number().int().min(1, 'Get quantity must be at least 1').optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  is_active: z.boolean().optional(),
});

// GET /api/promotions/branch/:branchId - Get promotions for specific branch
router.get('/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  const { active_only } = req.query;
  
  let query = `
    SELECT 
      p.id, p.name, p.description, p.type as promotion_type, 
      COALESCE(p.discount_percentage, p.discount_amount, 0) as value,
      p.branch_id, p.product_id, p.category_id, p.min_quantity as min_purchase_amount,
      p.buy_quantity, p.get_quantity, p.start_date, p.end_date,
      p.is_active, p.created_at, p.updated_at,
      pr.name as product_name, pr.sku as product_sku,
      c.name as category_name,
      b.name as branch_name
    FROM promotions p
    LEFT JOIN products pr ON p.product_id = pr.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branches b ON p.branch_id = b.id
    WHERE (p.branch_id = $1 OR p.branch_id IS NULL)
  `;
  
  const params: any[] = [branchId];
  
  if (active_only === 'true') {
    query += ` AND p.is_active = true AND p.start_date <= NOW() AND p.end_date >= NOW()`;
  }
  
  query += ` ORDER BY p.start_date DESC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      promotions: result.rows
    }
  });
}));

// GET /api/promotions - Get all promotions
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id, active_only } = req.query;
  
  let query = `
    SELECT 
      p.id, p.name, p.description, p.type as promotion_type, 
      COALESCE(p.discount_percentage, p.discount_amount, 0) as value,
      p.branch_id, p.product_id, p.category_id, p.min_quantity as min_purchase_amount,
      p.buy_quantity, p.get_quantity, p.start_date, p.end_date,
      p.is_active, p.created_at, p.updated_at,
      pr.name as product_name, pr.sku as product_sku,
      c.name as category_name,
      b.name as branch_name
    FROM promotions p
    LEFT JOIN products pr ON p.product_id = pr.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branches b ON p.branch_id = b.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (branch_id) {
    query += ` AND (p.branch_id = $${paramIndex} OR p.branch_id IS NULL)`;
    params.push(branch_id);
    paramIndex++;
  }
  
  if (active_only === 'true') {
    query += ` AND p.is_active = true AND p.start_date <= NOW() AND p.end_date >= NOW()`;
  }
  
  query += ` ORDER BY p.start_date DESC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      promotions: result.rows
    }
  });
}));

// GET /api/promotions/:id - Get specific promotion
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      p.id, p.name, p.description, p.type as promotion_type, 
      COALESCE(p.discount_percentage, p.discount_amount, 0) as value,
      p.branch_id, p.product_id, p.category_id, p.min_quantity as min_purchase_amount,
      p.buy_quantity, p.get_quantity, p.start_date, p.end_date,
      p.is_active, p.created_at, p.updated_at,
      pr.name as product_name, pr.sku as product_sku,
      c.name as category_name,
      b.name as branch_name
    FROM promotions p
    LEFT JOIN products pr ON p.product_id = pr.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branches b ON p.branch_id = b.id
    WHERE p.id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Promotion not found',
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({
    success: true,
    data: { promotion: result.rows[0] }
  });
}));

// POST /api/promotions/branch/:branchId - Create promotion for specific branch
router.post('/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  const validatedData = createPromotionSchema.parse({
    ...req.body,
    branch_id: branchId
  });
  
  // Check if branch exists
  const branchExists = await DatabaseManager.query(
    'SELECT id FROM branches WHERE id = $1',
    [branchId]
  );
  
  if (branchExists.rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  // Check if product exists (if specified)
  if (validatedData.product_id) {
    const productExists = await DatabaseManager.query(
      'SELECT id FROM products WHERE id = $1',
      [validatedData.product_id]
    );
    
    if (productExists.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product not found'
      });
    }
  }
  
  // Check if category exists (if specified)
  if (validatedData.category_id) {
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
  }
  
  const insertQuery = `
    INSERT INTO promotions (
      name, description, type, branch_id, product_id, category_id,
      discount_percentage, discount_amount, min_quantity, buy_quantity, get_quantity, 
      start_date, end_date, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
    )
    RETURNING id, name, description, type, branch_id, product_id, category_id,
             discount_percentage, discount_amount, min_quantity, buy_quantity, get_quantity, 
             start_date, end_date, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.name,
    validatedData.description,
    validatedData.type,
    validatedData.branch_id,
    validatedData.product_id,
    validatedData.category_id,
    validatedData.discount_percentage,
    validatedData.discount_amount,
    validatedData.min_quantity,
    validatedData.buy_quantity,
    validatedData.get_quantity,
    validatedData.start_date,
    validatedData.end_date,
    validatedData.is_active
  ]);
  
  res.status(201).json({
    success: true,
    data: { promotion: result.rows[0] }
  });
}));

// POST /api/promotions - Create promotion (chain-wide if no branch specified)
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createPromotionSchema.parse(req.body);
  
  // Check if branch exists (if specified)
  if (validatedData.branch_id) {
    const branchExists = await DatabaseManager.query(
      'SELECT id FROM branches WHERE id = $1',
      [validatedData.branch_id]
    );
    
    if (branchExists.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Branch not found'
      });
    }
  }
  
  // Check if product exists (if specified)
  if (validatedData.product_id) {
    const productExists = await DatabaseManager.query(
      'SELECT id FROM products WHERE id = $1',
      [validatedData.product_id]
    );
    
    if (productExists.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product not found'
      });
    }
  }
  
  // Check if category exists (if specified)
  if (validatedData.category_id) {
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
  }
  
  const insertQuery = `
    INSERT INTO promotions (
      name, description, type, branch_id, product_id, category_id,
      discount_percentage, discount_amount, min_quantity, buy_quantity, get_quantity, 
      start_date, end_date, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
    )
    RETURNING id, name, description, type, branch_id, product_id, category_id,
             discount_percentage, discount_amount, min_quantity, buy_quantity, get_quantity, 
             start_date, end_date, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.name,
    validatedData.description,
    validatedData.type,
    validatedData.branch_id,
    validatedData.product_id,
    validatedData.category_id,
    validatedData.discount_percentage,
    validatedData.discount_amount,
    validatedData.min_quantity,
    validatedData.buy_quantity,
    validatedData.get_quantity,
    validatedData.start_date,
    validatedData.end_date,
    validatedData.is_active
  ]);
  
  res.status(201).json({
    success: true,
    data: { promotion: result.rows[0] }
  });
}));

// PUT /api/promotions/:id - Update promotion
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updatePromotionSchema.parse(req.body);
  
  // Check if promotion exists
  const existingPromotion = await DatabaseManager.query(
    'SELECT id FROM promotions WHERE id = $1',
    [id]
  );
  
  if (existingPromotion.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Promotion not found'
    });
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
    UPDATE promotions 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, description, type, branch_id, product_id, category_id,
             discount_percentage, discount_amount, min_quantity, buy_quantity, get_quantity, 
             start_date, end_date, is_active, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  res.json({
    success: true,
    data: { promotion: result.rows[0] }
  });
}));

// DELETE /api/promotions/:id - Delete promotion
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Check if promotion exists
  const existingPromotion = await DatabaseManager.query(
    'SELECT id FROM promotions WHERE id = $1',
    [id]
  );
  
  if (existingPromotion.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Promotion not found'
    });
  }
  
  await DatabaseManager.query('DELETE FROM promotions WHERE id = $1', [id]);
  
  res.json({
    success: true,
    message: 'Promotion deleted successfully'
  });
}));

export default router;
