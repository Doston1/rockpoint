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
  managerName: z.string().optional(),
  manager: z.string().optional(), // For backward compatibility
  timezone: z.string().default('Asia/Tashkent'),
  currency: z.string().default('UZS'),
  taxRate: z.number().min(0).max(100).default(12),
  isActive: z.boolean().default(true),
  apiKey: z.string().optional(),
});

const updateBranchSchema = createBranchSchema.partial();

// Helper function to generate API key
const generateApiKey = (): string => {
  return 'br_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// GET /api/branches - Get all branches
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const query = `
    SELECT 
      id, name, code, address, phone, email, manager_name,
      timezone, currency, tax_rate, is_active, last_sync_at,
      api_endpoint, api_key, created_at, updated_at
    FROM branches 
    ORDER BY name ASC
  `;
  
  const result = await DatabaseManager.query(query);
  
  res.json({
    success: true,
    data: {
      branches: result.rows.map((branch: any) => ({
        ...branch,
        isActive: branch.is_active,
        managerName: branch.manager_name,
        taxRate: parseFloat(branch.tax_rate || '0'),
        lastSyncAt: branch.last_sync_at
      }))
    }
  });
}));

// GET /api/branches/:id - Get specific branch
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      id, name, code, address, phone, email, manager_name,
      timezone, currency, tax_rate, is_active, last_sync_at,
      api_endpoint, api_key, created_at, updated_at
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
  
  res.json({
    success: true,
    data: { 
      branch: {
        ...branch,
        isActive: branch.is_active,
        managerName: branch.manager_name,
        taxRate: parseFloat(branch.tax_rate || '0'),
        lastSyncAt: branch.last_sync_at
      }
    }
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
  
  // Generate API key if not provided
  const apiKey = validatedData.apiKey || generateApiKey();
  const managerName = validatedData.managerName || validatedData.manager;
  
  const insertQuery = `
    INSERT INTO branches (
      name, code, address, phone, email, manager_name,
      timezone, currency, tax_rate, is_active, api_key,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
    )
    RETURNING id, name, code, address, phone, email, manager_name,
             timezone, currency, tax_rate, is_active, last_sync_at,
             api_endpoint, api_key, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.name,
    validatedData.code,
    validatedData.address,
    validatedData.phone,
    validatedData.email,
    managerName,
    validatedData.timezone,
    validatedData.currency,
    validatedData.taxRate,
    validatedData.isActive,
    apiKey
  ]);
  
  const branch = result.rows[0];
  
  res.status(201).json({
    success: true,
    data: { 
      branch: {
        ...branch,
        isActive: branch.is_active,
        managerName: branch.manager_name,
        taxRate: parseFloat(branch.tax_rate || '0'),
        lastSyncAt: branch.last_sync_at
      }
    }
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
      let dbField = key;
      if (key === 'managerName') dbField = 'manager_name';
      else if (key === 'manager') dbField = 'manager_name';
      else if (key === 'isActive') dbField = 'is_active';
      else if (key === 'taxRate') dbField = 'tax_rate';
      else if (key === 'apiKey') dbField = 'api_key';
      
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
    RETURNING id, name, code, address, phone, email, manager_name,
             timezone, currency, tax_rate, is_active, last_sync_at,
             api_endpoint, api_key, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  const branch = result.rows[0];
  
  res.json({
    success: true,
    data: { 
      branch: {
        ...branch,
        isActive: branch.is_active,
        managerName: branch.manager_name,
        taxRate: parseFloat(branch.tax_rate || '0'),
        lastSyncAt: branch.last_sync_at
      }
    }
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
  
  // Get today's sales
  const todaySales = await DatabaseManager.query(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM transactions 
    WHERE branch_id = $1 
    AND DATE(created_at) = CURRENT_DATE 
    AND status = 'completed'
  `, [id]);
  
  // Get this month's sales
  const monthSales = await DatabaseManager.query(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM transactions 
    WHERE branch_id = $1 
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    AND status = 'completed'
  `, [id]);
  
  // Get total products count
  const productCount = await DatabaseManager.query(`
    SELECT COUNT(DISTINCT product_id) as count
    FROM branch_inventory 
    WHERE branch_id = $1
  `, [id]);
  
  // Get low stock items count
  const lowStockCount = await DatabaseManager.query(`
    SELECT COUNT(*) as count
    FROM branch_inventory 
    WHERE branch_id = $1 
    AND quantity_in_stock <= min_stock_level
  `, [id]);
  
  // Get recent transactions count (last 24 hours)
  const recentTransactions = await DatabaseManager.query(`
    SELECT COUNT(*) as count
    FROM transactions 
    WHERE branch_id = $1 
    AND created_at >= NOW() - INTERVAL '24 hours'
  `, [id]);
  
  res.json({
    success: true,
    data: {
      employeeCount: parseInt(employeeCount.rows[0].count),
      todaySales: parseFloat(todaySales.rows[0].total || '0'),
      monthSales: parseFloat(monthSales.rows[0].total || '0'),
      productCount: parseInt(productCount.rows[0]?.count || '0'),
      lowStockCount: parseInt(lowStockCount.rows[0]?.count || '0'),
      recentTransactions: parseInt(recentTransactions.rows[0].count),
    }
  });
}));

// GET /api/branches/:id/connection - Get branch connection status
router.get('/:id/connection', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Check if branch exists
  const branch = await DatabaseManager.query(
    'SELECT last_sync_at FROM branches WHERE id = $1',
    [id]
  );
  
  if (branch.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  const lastSync = branch.rows[0].last_sync_at;
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  // Consider connected if synced within last 5 minutes
  const isConnected = lastSync && new Date(lastSync) > fiveMinutesAgo;
  
  res.json({
    success: true,
    data: {
      isConnected,
      lastSync: lastSync,
      status: isConnected ? 'connected' : 'disconnected'
    }
  });
}));

// POST /api/branches/:id/sync - Trigger manual sync for branch
router.post('/:id/sync', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Check if branch exists
  const branch = await DatabaseManager.query(
    'SELECT id FROM branches WHERE id = $1 AND is_active = true',
    [id]
  );
  
  if (branch.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found or inactive'
    });
  }
  
  // Update last sync timestamp
  await DatabaseManager.query(
    'UPDATE branches SET last_sync_at = NOW() WHERE id = $1',
    [id]
  );
  
  // In a real implementation, this would trigger actual sync operations
  // For now, just return success
  res.json({
    success: true,
    message: 'Sync initiated successfully'
  });
}));

// GET /api/branches/connection-status - Get connection status for all branches
router.get('/connection-status', asyncHandler(async (req: Request, res: Response) => {
  const branches = await DatabaseManager.query(`
    SELECT id, name, code, last_sync_at, is_active
    FROM branches 
    ORDER BY name ASC
  `);
  
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  const connectionStatus = branches.rows.map((branch: any) => {
    const isConnected = branch.is_active && 
                       branch.last_sync_at && 
                       new Date(branch.last_sync_at) > fiveMinutesAgo;
    
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      isConnected,
      lastSync: branch.last_sync_at,
      status: isConnected ? 'connected' : 'disconnected'
    };
  });
  
  res.json({
    success: true,
    data: { branches: connectionStatus }
  });
}));

export default router;
