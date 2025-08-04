import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createInventoryItemSchema = z.object({
  product_id: z.string().uuid('Valid product ID is required'),
  branch_id: z.string().uuid('Valid branch ID is required'),
  quantity_in_stock: z.coerce.number().min(0, 'Quantity must be non-negative'),
  min_stock_level: z.coerce.number().min(0, 'Minimum stock must be non-negative').default(0),
  max_stock_level: z.coerce.number().min(0, 'Maximum stock must be non-negative').optional(),
  reorder_point: z.coerce.number().min(0, 'Reorder point must be non-negative').optional(),
});

const updateInventorySchema = z.object({
  quantity_in_stock: z.coerce.number().min(0, 'Quantity must be non-negative').optional(),
  min_stock_level: z.coerce.number().min(0, 'Minimum stock must be non-negative').optional(),
  max_stock_level: z.coerce.number().min(0, 'Maximum stock must be non-negative').optional(),
  reorder_point: z.coerce.number().min(0, 'Reorder point must be non-negative').optional(),
});

const adjustInventorySchema = z.object({
  adjustment_type: z.enum(['increase', 'decrease', 'set']),
  quantity: z.coerce.number().min(0, 'Quantity must be non-negative'),
  reason: z.string().min(1, 'Reason is required'),
});

// GET /api/inventory - Get inventory items
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id, product_id, low_stock } = req.query;
  
  let query = `
    SELECT 
      i.id, i.product_id, i.branch_id, i.quantity_in_stock, i.min_stock_level, 
      i.max_stock_level, i.reorder_point, i.last_counted_at, i.last_movement_at, 
      i.created_at, i.updated_at,
      p.name as product_name, p.sku, p.barcode, p.base_price,
      COALESCE(bpp.price, p.base_price) as branch_price,
      COALESCE(bpp.cost, p.cost) as branch_cost,
      bpp.is_available,
      b.name as branch_name,
      c.name as category_name
    FROM branch_inventory i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN branches b ON i.branch_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON i.branch_id = bpp.branch_id AND i.product_id = bpp.product_id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (branch_id) {
    query += ` AND i.branch_id = $${paramIndex}`;
    params.push(branch_id);
    paramIndex++;
  }
  
  if (product_id) {
    query += ` AND i.product_id = $${paramIndex}`;
    params.push(product_id);
    paramIndex++;
  }
  
  if (low_stock === 'true') {
    query += ` AND i.quantity_in_stock <= i.min_stock_level`;
  }
  
  query += ` ORDER BY p.name ASC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      inventory: result.rows.map((item: any) => ({
        ...item,
        is_low_stock: item.quantity_in_stock <= item.min_stock_level,
        stock_status: item.quantity_in_stock === 0 ? 'out_of_stock' : 
                     item.quantity_in_stock <= item.min_stock_level ? 'low_stock' : 'in_stock'
      }))
    }
  });
}));

// GET /api/inventory/branch/:branchId - Get inventory for specific branch
router.get('/branch/:branchId', asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;
  const { product_id, low_stock } = req.query;
  
  let query = `
    SELECT 
      i.id, i.product_id, i.branch_id, i.quantity_in_stock, i.min_stock_level, 
      i.max_stock_level, i.reorder_point, i.last_counted_at, i.last_movement_at, 
      i.created_at, i.updated_at,
      p.name as product_name, p.sku, p.barcode, p.base_price,
      COALESCE(bpp.price, p.base_price) as branch_price,
      COALESCE(bpp.cost, p.cost) as branch_cost,
      bpp.is_available,
      b.name as branch_name,
      c.name as category_name
    FROM branch_inventory i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN branches b ON i.branch_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON i.branch_id = bpp.branch_id AND i.product_id = bpp.product_id
    WHERE i.branch_id = $1
  `;
  
  const params: any[] = [branchId];
  let paramIndex = 2;
  
  if (product_id) {
    query += ` AND i.product_id = $${paramIndex}`;
    params.push(product_id);
    paramIndex++;
  }
  
  if (low_stock === 'true') {
    query += ` AND i.quantity_in_stock <= i.min_stock_level`;
  }
  
  query += ` ORDER BY p.name ASC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      inventory: result.rows.map((item: any) => ({
        ...item,
        is_low_stock: item.quantity_in_stock <= item.min_stock_level,
        stock_status: item.quantity_in_stock === 0 ? 'out_of_stock' : 
                     item.quantity_in_stock <= item.min_stock_level ? 'low_stock' : 'in_stock'
      }))
    }
  });
}));

// GET /api/inventory/:id - Get specific inventory item
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      i.id, i.product_id, i.branch_id, i.quantity_in_stock, i.min_stock_level, 
      i.max_stock_level, i.reorder_point, i.last_counted_at, i.last_movement_at, 
      i.created_at, i.updated_at,
      p.name as product_name, p.sku, p.barcode, p.base_price,
      COALESCE(bpp.price, p.base_price) as branch_price,
      COALESCE(bpp.cost, p.cost) as branch_cost,
      bpp.is_available,
      b.name as branch_name,
      c.name as category_name
    FROM branch_inventory i
    LEFT JOIN products p ON i.product_id = p.id
    LEFT JOIN branches b ON i.branch_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_product_pricing bpp ON i.branch_id = bpp.branch_id AND i.product_id = bpp.product_id
    WHERE i.id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
    });
  }
  
  const item = result.rows[0];
  
  res.json({
    success: true,
    data: { 
      inventory_item: {
        ...item,
        is_low_stock: item.quantity <= item.min_stock,
        stock_status: item.quantity === 0 ? 'out_of_stock' : 
                     item.quantity <= item.min_stock ? 'low_stock' : 'in_stock'
      }
    }
  });
}));

// POST /api/inventory - Create inventory item
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createInventoryItemSchema.parse(req.body);
  
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
  
  // Check if inventory item already exists
  const existingItem = await DatabaseManager.query(
    'SELECT id FROM branch_inventory WHERE product_id = $1 AND branch_id = $2',
    [validatedData.product_id, validatedData.branch_id]
  );
  
  if (existingItem.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Inventory item already exists for this product and branch'
    });
  }
  
  const insertQuery = `
    INSERT INTO branch_inventory (
      product_id, branch_id, quantity_in_stock, min_stock_level, max_stock_level, reorder_point,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, NOW(), NOW()
    )
    RETURNING id, product_id, branch_id, quantity_in_stock, min_stock_level, max_stock_level, 
             reorder_point, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.product_id,
    validatedData.branch_id,
    validatedData.quantity_in_stock,
    validatedData.min_stock_level,
    validatedData.max_stock_level,
    validatedData.reorder_point
  ]);
  
  res.status(201).json({
    success: true,
    data: { inventory_item: result.rows[0] }
  });
}));

// PUT /api/inventory/:id - Update inventory item
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updateInventorySchema.parse(req.body);
  
  // Check if inventory item exists
  const existingItem = await DatabaseManager.query(
    'SELECT id FROM branch_inventory WHERE id = $1',
    [id]
  );
  
  if (existingItem.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
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
  
  updateFields.push(`last_updated = NOW()`);
  values.push(id);
  
  const updateQuery = `
    UPDATE branch_inventory 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, product_id, branch_id, quantity_in_stock, min_stock_level, max_stock_level, 
             reorder_point, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  res.json({
    success: true,
    data: { inventory_item: result.rows[0] }
  });
}));

// PUT /api/inventory/branch/:branchId/product/:productId - Update inventory for specific branch and product
router.put('/branch/:branchId/product/:productId', asyncHandler(async (req: Request, res: Response) => {
  const { branchId, productId } = req.params;
  const validatedData = updateInventorySchema.parse(req.body);
  
  // Check if inventory item exists
  const existingItem = await DatabaseManager.query(
    'SELECT id FROM branch_inventory WHERE branch_id = $1 AND product_id = $2',
    [branchId, productId]
  );
  
  if (existingItem.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found for this branch and product'
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
  values.push(branchId, productId);
  
  const updateQuery = `
    UPDATE branch_inventory 
    SET ${updateFields.join(', ')}
    WHERE branch_id = $${paramIndex} AND product_id = $${paramIndex + 1}
    RETURNING id, product_id, branch_id, quantity_in_stock, min_stock_level, max_stock_level, 
             reorder_point, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  res.json({
    success: true,
    data: { inventory_item: result.rows[0] }
  });
}));

// POST /api/inventory/:id/adjust - Adjust inventory quantity
router.post('/:id/adjust', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { adjustment_type, quantity, reason } = adjustInventorySchema.parse(req.body);
  
  // Get current inventory item
  const currentItem = await DatabaseManager.query(
    'SELECT * FROM branch_inventory WHERE id = $1',
    [id]
  );
  
  if (currentItem.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
    });
  }
  
  const current = currentItem.rows[0];
  let newQuantity = current.quantity_in_stock;
  
  switch (adjustment_type) {
    case 'increase':
      newQuantity += quantity;
      break;
    case 'decrease':
      newQuantity = Math.max(0, current.quantity_in_stock - quantity);
      break;
    case 'set':
      newQuantity = quantity;
      break;
  }
  
  // Update inventory
  const updateResult = await DatabaseManager.query(
    'UPDATE branch_inventory SET quantity_in_stock = $1, last_movement_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *',
    [newQuantity, id]
  );
  
  // Log the stock movement
  await DatabaseManager.query(`
    INSERT INTO stock_movements (
      branch_id, product_id, movement_type, quantity, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
  `, [
    current.branch_id, 
    current.product_id, 
    'adjustment',
    newQuantity - current.quantity_in_stock,
    reason
  ]);
  
  res.json({
    success: true,
    data: { 
      inventory_item: updateResult.rows[0],
      adjustment: {
        previous_quantity: current.quantity_in_stock,
        new_quantity: newQuantity,
        adjustment_type,
        reason
      }
    }
  });
}));

// GET /api/inventory/:id/history - Get stock movement history
router.get('/:id/history', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // First get the branch_id and product_id for this inventory item
  const inventoryItem = await DatabaseManager.query(
    'SELECT branch_id, product_id FROM branch_inventory WHERE id = $1',
    [id]
  );
  
  if (inventoryItem.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
    });
  }
  
  const { branch_id, product_id } = inventoryItem.rows[0];
  
  const query = `
    SELECT 
      sm.id, sm.movement_type, sm.quantity, sm.notes, sm.created_at,
      e.name as employee_name
    FROM stock_movements sm
    LEFT JOIN employees e ON sm.employee_id = e.id
    WHERE sm.branch_id = $1 AND sm.product_id = $2
    ORDER BY sm.created_at DESC
    LIMIT 50
  `;
  
  const result = await DatabaseManager.query(query, [branch_id, product_id]);
  
  res.json({
    success: true,
    data: { movements: result.rows }
  });
}));

// DELETE /api/inventory/:id - Delete inventory item
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(
    'DELETE FROM branch_inventory WHERE id = $1 RETURNING id',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Inventory item deleted successfully'
  });
}));

export default router;
