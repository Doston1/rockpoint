import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  code: z.string().min(1, 'Branch code is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  manager: z.string().optional(),
  timezone: z.string().default('UTC'),
  currency: z.string().default('USD'),
});

const updateBranchSchema = createBranchSchema.partial();

// GET /api/branches - Get all branches
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = `
    SELECT 
      id, name, code, address, phone, email, manager_name as manager,
      timezone, currency, is_active as status, created_at, updated_at
    FROM branches 
    ORDER BY name ASC
  `;
  
  const result = await DatabaseManager.query(query);
  
  res.json({
    success: true,
    data: {
      branches: result.rows.map((branch: any) => ({
        ...branch,
        status: branch.status ? 'active' : 'inactive'
      }))
    }
  });
}));

// GET /api/branches/:id - Get specific branch
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      id, name, code, address, phone, email, manager_name as manager,
      timezone, currency, is_active as status, created_at, updated_at
    FROM branches 
    WHERE id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  const branch = result.rows[0];
  branch.status = branch.status ? 'active' : 'inactive';
  
  res.json({
    success: true,
    data: { branch }
  });
}));

// POST /api/branches - Create new branch
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createBranchSchema.parse(req.body);
  
  // Check if branch code already exists
  const existingBranch = await DatabaseManager.query(
    'SELECT id FROM branches WHERE code = $1',
    [validatedData.code]
  );
  
  if (existingBranch.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Branch code already exists'
    });
  }
  
  const insertQuery = `
    INSERT INTO branches (
      chain_id, name, code, address, phone, email, manager_name,
      timezone, currency, is_active, created_at, updated_at
    ) VALUES (
      (SELECT id FROM chains LIMIT 1), $1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW()
    )
    RETURNING id, name, code, address, phone, email, manager_name as manager,
             timezone, currency, is_active as status, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.name,
    validatedData.code,
    validatedData.address,
    validatedData.phone,
    validatedData.email,
    validatedData.manager,
    validatedData.timezone,
    validatedData.currency
  ]);
  
  const branch = result.rows[0];
  branch.status = branch.status ? 'active' : 'inactive';
  
  res.status(201).json({
    success: true,
    data: { branch }
  });
}));

// PUT /api/branches/:id - Update branch
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updateBranchSchema.parse(req.body);
  
  // Check if branch exists
  const existingBranch = await DatabaseManager.query(
    'SELECT id FROM branches WHERE id = $1',
    [id]
  );
  
  if (existingBranch.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(validatedData)) {
    if (value !== undefined) {
      const dbField = key === 'manager' ? 'manager_name' : key;
      updateFields.push(`${dbField} = $${paramIndex}`);
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
    UPDATE branches 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, code, address, phone, email, manager_name as manager,
             timezone, currency, is_active as status, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  const branch = result.rows[0];
  branch.status = branch.status ? 'active' : 'inactive';
  
  res.json({
    success: true,
    data: { branch }
  });
}));

// DELETE /api/branches/:id - Delete branch (soft delete)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(
    'UPDATE branches SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Branch deactivated successfully'
  });
}));

// GET /api/branches/:id/stats - Get branch statistics
router.get('/:id/stats', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get employee count
  const employeeCount = await DatabaseManager.query(
    'SELECT COUNT(*) as count FROM employees WHERE branch_id = $1 AND status = $2',
    [id, 'active']
  );
  
  // Get today's sales (placeholder)
  const todaySales = await DatabaseManager.query(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM transactions 
    WHERE branch_id = $1 
    AND DATE(created_at) = CURRENT_DATE 
    AND status = 'completed'
  `, [id]);
  
  res.json({
    success: true,
    data: {
      employeeCount: parseInt(employeeCount.rows[0].count),
      todaySales: parseFloat(todaySales.rows[0].total || '0'),
      // Add more statistics as needed
    }
  });
}));

export default router;
