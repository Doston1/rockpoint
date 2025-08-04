import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createBranchPricingSchema = z.object({
  branch_id: z.string().uuid('Valid branch ID is required'),
  product_id: z.string().uuid('Valid product ID is required'),
  price: z.coerce.number().min(0, 'Price must be non-negative'),
  cost: z.coerce.number().min(0, 'Cost must be non-negative').optional(),
  is_available: z.boolean().default(true),
  min_quantity_discount: z.coerce.number().min(0).optional(),
  bulk_price: z.coerce.number().min(0).optional(),
  discount_percentage: z.coerce.number().min(0).max(100).optional(),
  effective_from: z.string().datetime().optional(),
  effective_until: z.string().datetime().optional(),
});

const updateBranchPricingSchema = createBranchPricingSchema.partial().omit({
  branch_id: true,
  product_id: true,
});

// GET /api/branch-pricing - Get all branch pricing
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id, product_id } = req.query;
  
  let query = `
    SELECT 
      bpp.id, bpp.branch_id, bpp.product_id, bpp.price, bpp.cost, bpp.is_available,
      bpp.min_quantity_discount, bpp.bulk_price, bpp.discount_percentage,
      bpp.effective_from, bpp.effective_until, bpp.created_at, bpp.updated_at,
      p.name as product_name, p.sku, p.base_price,
      b.name as branch_name
    FROM branch_product_pricing bpp
    LEFT JOIN products p ON bpp.product_id = p.id
    LEFT JOIN branches b ON bpp.branch_id = b.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (branch_id) {
    query += ` AND bpp.branch_id = $${paramIndex}`;
    params.push(branch_id);
    paramIndex++;
  }
  
  if (product_id) {
    query += ` AND bpp.product_id = $${paramIndex}`;
    params.push(product_id);
    paramIndex++;
  }
  
  query += ` ORDER BY b.name, p.name`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      branch_pricing: result.rows
    }
  });
}));

// GET /api/branch-pricing/branch/:branchId - Get pricing for specific branch
router.get('/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  
  const query = `
    SELECT 
      bpp.id, bpp.branch_id, bpp.product_id, bpp.price, bpp.cost, bpp.is_available,
      bpp.min_quantity_discount, bpp.bulk_price, bpp.discount_percentage,
      bpp.effective_from, bpp.effective_until, bpp.created_at, bpp.updated_at,
      p.name as product_name, p.sku, p.base_price,
      b.name as branch_name
    FROM branch_product_pricing bpp
    LEFT JOIN products p ON bpp.product_id = p.id
    LEFT JOIN branches b ON bpp.branch_id = b.id
    WHERE bpp.branch_id = $1
    ORDER BY p.name
  `;
  
  const result = await DatabaseManager.query(query, [branchId]);
  
  res.json({
    success: true,
    data: {
      branch_pricing: result.rows
    }
  });
}));

// GET /api/branch-pricing/product/:productId - Get pricing for specific product across branches
router.get('/product/:productId', asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  
  const query = `
    SELECT 
      bpp.id, bpp.branch_id, bpp.product_id, bpp.price, bpp.cost, bpp.is_available,
      bpp.min_quantity_discount, bpp.bulk_price, bpp.discount_percentage,
      bpp.effective_from, bpp.effective_until, bpp.created_at, bpp.updated_at,
      p.name as product_name, p.sku, p.base_price,
      b.name as branch_name
    FROM branch_product_pricing bpp
    LEFT JOIN products p ON bpp.product_id = p.id
    LEFT JOIN branches b ON bpp.branch_id = b.id
    WHERE bpp.product_id = $1
    ORDER BY b.name
  `;
  
  const result = await DatabaseManager.query(query, [productId]);
  
  res.json({
    success: true,
    data: {
      branch_pricing: result.rows
    }
  });
}));

// POST /api/branch-pricing - Create branch pricing
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createBranchPricingSchema.parse(req.body);
  
  // Check if branch exists
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
  
  // Check if product exists
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
  
  // Check if pricing already exists
  const existingPricing = await DatabaseManager.query(
    'SELECT id FROM branch_product_pricing WHERE branch_id = $1 AND product_id = $2',
    [validatedData.branch_id, validatedData.product_id]
  );
  
  if (existingPricing.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Branch pricing already exists for this product'
    });
  }
  
  const insertQuery = `
    INSERT INTO branch_product_pricing (
      branch_id, product_id, price, cost, is_available, min_quantity_discount,
      bulk_price, discount_percentage, effective_from, effective_until,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
    )
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.branch_id,
    validatedData.product_id,
    validatedData.price,
    validatedData.cost,
    validatedData.is_available,
    validatedData.min_quantity_discount,
    validatedData.bulk_price,
    validatedData.discount_percentage,
    validatedData.effective_from,
    validatedData.effective_until
  ]);
  
  res.status(201).json({
    success: true,
    data: { branch_pricing: result.rows[0] }
  });
}));

// PUT /api/branch-pricing/:id - Update branch pricing
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updateBranchPricingSchema.parse(req.body);
  
  // Check if pricing exists
  const existingPricing = await DatabaseManager.query(
    'SELECT id FROM branch_product_pricing WHERE id = $1',
    [id]
  );
  
  if (existingPricing.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch pricing not found'
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
    UPDATE branch_product_pricing 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  res.json({
    success: true,
    data: { branch_pricing: result.rows[0] }
  });
}));

// DELETE /api/branch-pricing/:id - Delete branch pricing
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Check if pricing exists
  const existingPricing = await DatabaseManager.query(
    'SELECT id FROM branch_product_pricing WHERE id = $1',
    [id]
  );
  
  if (existingPricing.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch pricing not found'
    });
  }
  
  await DatabaseManager.query('DELETE FROM branch_product_pricing WHERE id = $1', [id]);
  
  res.json({
    success: true,
    message: 'Branch pricing deleted successfully'
  });
}));

export default router;
