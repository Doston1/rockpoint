import axios from 'axios';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const branchSchema = z.object({
  code: z.string().min(1, 'Branch code is required'),
  name: z.string().min(1, 'Branch name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  manager_name: z.string().optional(),
  timezone: z.string().default('Asia/Tashkent'),
  currency: z.string().default('UZS'),
  tax_rate: z.number().min(0).max(100).default(12),
  is_active: z.boolean().default(true),
  api_endpoint: z.string().url().optional(),
  api_key: z.string().optional(),
  network_status: z.enum(['online', 'offline', 'error']).default('offline')
});

const updateBranchSchema = branchSchema.partial();

const branchServerSchema = z.object({
  branch_code: z.string().min(1),
  server_name: z.string().min(1),
  ip_address: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  api_port: z.number().int().min(1).max(65535).optional(),
  websocket_port: z.number().int().min(1).max(65535).optional(),
  vpn_ip_address: z.string().optional(),
  public_ip_address: z.string().optional(),
  network_type: z.enum(['local', 'vpn', 'internet']).default('local'),
  server_info: z.record(z.any()).optional(),
  api_key: z.string().optional(),
  outbound_api_key: z.string().optional(),
  status: z.enum(['online', 'offline', 'error']).default('offline'),
  is_active: z.boolean().default(true)
});

// ============================================================================
// BRANCH MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/branches - Get all branches
router.get('/', requirePermission('branches:read'), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 100, is_active, network_status, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      b.id, b.code, b.name, b.address, b.phone, b.email,
          b.manager_name, b.timezone, b.currency, b.tax_rate,
          b.is_active, b.api_endpoint, b.network_status,
          b.last_sync_at, b.created_at, b.updated_at,
      COUNT(DISTINCT bs.id) as server_count,
      COUNT(DISTINCT e.id) as employee_count,
      COUNT(DISTINCT bi.id) as product_count
    FROM branches b
    LEFT JOIN branch_servers bs ON b.id = bs.branch_id AND bs.is_active = true
    LEFT JOIN employees e ON b.id = e.branch_id AND e.status = 'active'
    LEFT JOIN branch_inventory bi ON b.id = bi.branch_id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (is_active !== undefined) {
    params.push(is_active === 'true');
    query += ` AND b.is_active = $${params.length}`;
  }
  
  if (network_status) {
    params.push(network_status);
    query += ` AND b.network_status = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (b.name ILIKE $${params.length} OR b.code ILIKE $${params.length})`;
  }
  
  query += ` GROUP BY b.id`;
  
  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(DISTINCT b.id) as count 
    FROM branches b 
    WHERE 1=1 ${params.map((_, i) => {
      if (is_active !== undefined && i === 0) return ` AND b.is_active = $${i + 1}`;
      if (network_status && ((is_active !== undefined && i === 1) || (is_active === undefined && i === 0))) return ` AND b.network_status = $${i + 1}`;
      if (search) return ` AND (b.name ILIKE $${i + 1} OR b.code ILIKE $${i + 1})`;
      return '';
    }).join('')}
  `;
  
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY b.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      branches: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/branches/:code - Get specific branch
router.get('/:code', requirePermission('branches:read'), asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const { include_servers, include_employees, include_inventory } = req.query;
  
  const query = `
    SELECT 
      b.id, b.code, b.name, b.address, b.phone, b.email,
      b.manager_name, b.timezone, b.currency, b.tax_rate,
      b.is_active, b.api_endpoint, b.network_status,
      b.last_sync_at, b.created_at, b.updated_at
    FROM branches b
    WHERE b.code = $1
  `;
  
  const result = await DatabaseManager.query(query, [code]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  const branch = result.rows[0];
  
  // Include servers if requested
  if (include_servers === 'true') {
    const serversResult = await DatabaseManager.query(`
      SELECT 
        id, server_name, ip_address, port, api_port, websocket_port,
        vpn_ip_address, public_ip_address, network_type, status,
        server_info, is_active, last_ping_at, created_at, updated_at
      FROM branch_servers
      WHERE branch_id = $1
      ORDER BY server_name ASC
    `, [branch.id]);
    
    branch.servers = serversResult.rows;
  }
  
  // Include employees if requested
  if (include_employees === 'true') {
    const employeesResult = await DatabaseManager.query(`
      SELECT 
        id, employee_id, name, role, phone, email,
        hire_date, salary, status, onec_id,
        created_at, updated_at
      FROM employees
      WHERE branch_id = $1
      ORDER BY name ASC
    `, [branch.id]);
    
    branch.employees = employeesResult.rows;
  }
  
  // Include inventory summary if requested
  if (include_inventory === 'true') {
    const inventoryResult = await DatabaseManager.query(`
      SELECT 
        COUNT(*) as total_products,
        SUM(quantity_in_stock) as total_stock,
        SUM(CASE WHEN quantity_in_stock <= min_stock_level THEN 1 ELSE 0 END) as low_stock_items,
        SUM(CASE WHEN quantity_in_stock = 0 THEN 1 ELSE 0 END) as out_of_stock_items
      FROM branch_inventory bi
      WHERE bi.branch_id = $1
    `, [branch.id]);
    
    branch.inventory_summary = inventoryResult.rows[0];
  }
  
  res.json({
    success: true,
    data: {
      branch
    }
  });
}));

// POST /api/1c/branches - Create or update branches
router.post('/', requirePermission('branches:write'), asyncHandler(async (req: Request, res: Response) => {
  const branches = z.array(branchSchema).parse(req.body);
  
  const syncId = await createSyncLog('branches', 'import', branches.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const branchData of branches) {
      try {
        // Check if branch exists
        const existingResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1',
          [branchData.code]
        );
        
        let branchId;
        if (existingResult.rows.length > 0) {
          // Update existing branch
          branchId = existingResult.rows[0].id;
          await DatabaseManager.query(`
            UPDATE branches SET
              code = $1, name = $2, address = $3, phone = $4, email = $5,
              manager_name = $6, timezone = $7, currency = $8, tax_rate = $9,
              is_active = $10, api_endpoint = $11, network_status = $12,
              updated_at = NOW()
            WHERE id = $13
          `, [
            branchData.code, branchData.name, branchData.address, branchData.phone, branchData.email,
            branchData.manager_name, branchData.timezone, branchData.currency, branchData.tax_rate,
            branchData.is_active, branchData.api_endpoint, branchData.network_status,
            branchId
          ]);
        } else {
          // Create new branch
          const insertResult = await DatabaseManager.query(`
            INSERT INTO branches (
              code, name, address, phone, email, manager_name,
              timezone, currency, tax_rate, is_active, api_endpoint,
              network_status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
            ) RETURNING id
          `, [
            branchData.code, branchData.name, branchData.address, branchData.phone, branchData.email,
            branchData.manager_name, branchData.timezone, branchData.currency, branchData.tax_rate,
            branchData.is_active, branchData.api_endpoint, branchData.network_status
          ]);
          branchId = insertResult.rows[0].id;
        }
        
        results.push({
          code: branchData.code,
          success: true,
          action: existingResult.rows.length > 0 ? 'updated' : 'created',
          branch_id: branchId
        });
        
      } catch (error) {
        results.push({
          code: branchData.code,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// PUT /api/1c/branches/:code - Update specific branch
router.put('/:code', requirePermission('branches:write'), asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const branchData = updateBranchSchema.parse(req.body);
  
  const result = await DatabaseManager.query(`
    UPDATE branches SET
      code = COALESCE($1, code),
      name = COALESCE($2, name),
      address = COALESCE($3, address),
      phone = COALESCE($4, phone),
      email = COALESCE($5, email),
      manager_name = COALESCE($6, manager_name),
      timezone = COALESCE($7, timezone),
      currency = COALESCE($8, currency),
      tax_rate = COALESCE($9, tax_rate),
      is_active = COALESCE($10, is_active),
      api_endpoint = COALESCE($11, api_endpoint),
      network_status = COALESCE($12, network_status),
      updated_at = NOW()
    WHERE code = $13
    RETURNING id, name
  `, [
    branchData.code, branchData.name, branchData.address, branchData.phone, branchData.email,
    branchData.manager_name, branchData.timezone, branchData.currency, branchData.tax_rate,
    branchData.is_active, branchData.api_endpoint, branchData.network_status,
    code
  ]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: 'Branch updated successfully',
      branch_id: result.rows[0].id,
      branch_name: result.rows[0].name
    }
  });
}));

// GET /api/1c/branches/:code/status - Get branch health status
router.get('/:code/status', requirePermission('branches:read'), asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  
  // Get branch basic info
  const branchResult = await DatabaseManager.query(`
    SELECT id, name, network_status, api_endpoint, last_sync_at
    FROM branches 
    WHERE code = $1
  `, [code]);
  
  if (branchResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  const branch = branchResult.rows[0];
  
  // Get server status
  const serversResult = await DatabaseManager.query(`
    SELECT 
      server_name, status, last_ping_at, network_type,
      ip_address, port, api_port
    FROM branch_servers
    WHERE branch_id = $1 AND is_active = true
    ORDER BY server_name ASC
  `, [branch.id]);
  
  // Get last connection health logs
  const healthLogsResult = await DatabaseManager.query(`
    SELECT 
      endpoint, status, response_time_ms, error_message, checked_at
    FROM connection_health_logs
    WHERE branch_id = $1
    ORDER BY checked_at DESC
    LIMIT 10
  `, [branch.id]);
  
  // Check if branch API is reachable
  let apiStatus = 'unknown';
  let apiResponseTime = null;
  
  if (branch.api_endpoint) {
    try {
      const startTime = Date.now();
      await axios.get(`${branch.api_endpoint}/api/health`, {
        timeout: 5000
      });
      apiResponseTime = Date.now() - startTime;
      apiStatus = 'online';
    } catch (error) {
      apiStatus = 'offline';
    }
  }
  
  res.json({
    success: true,
    data: {
      branch: {
        id: branch.id,
        name: branch.name,
        code: code,
        network_status: branch.network_status,
        last_sync_at: branch.last_sync_at
      },
      api_status: apiStatus,
      api_response_time_ms: apiResponseTime,
      servers: serversResult.rows,
      recent_health_checks: healthLogsResult.rows
    }
  });
}));

// ============================================================================
// BRANCH SERVERS MANAGEMENT ENDPOINTS  
// ============================================================================

// GET /api/1c/branches/:code/servers - Get branch servers
router.get('/:code/servers', requirePermission('branches:read'), asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  
  const result = await DatabaseManager.query(`
    SELECT 
      bs.id, bs.server_name, bs.ip_address, bs.port, bs.api_port, bs.websocket_port,
      bs.vpn_ip_address, bs.public_ip_address, bs.network_type, bs.status,
      bs.server_info, bs.is_active, bs.last_ping_at, bs.created_at, bs.updated_at,
      b.name as branch_name, b.code as branch_code
    FROM branch_servers bs
    JOIN branches b ON bs.branch_id = b.id
    WHERE b.code = $1
    ORDER BY bs.server_name ASC
  `, [code]);
  
  res.json({
    success: true,
    data: {
      servers: result.rows
    }
  });
}));

// POST /api/1c/branches/:code/servers - Add server to branch
router.post('/:code/servers', requirePermission('branches:write'), asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  const serverData = branchServerSchema.parse({ ...req.body, branch_code: code });
  
  // Get branch ID
  const branchResult = await DatabaseManager.query(
    'SELECT id FROM branches WHERE code = $1',
    [code]
  );
  
  if (branchResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  const branchId = branchResult.rows[0].id;
  
  // Check if server already exists
  const existingServer = await DatabaseManager.query(
    'SELECT id FROM branch_servers WHERE branch_id = $1 AND server_name = $2',
    [branchId, serverData.server_name]
  );
  
  if (existingServer.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Server with this name already exists for this branch'
    });
  }
  
  const result = await DatabaseManager.query(`
    INSERT INTO branch_servers (
      branch_id, server_name, ip_address, port, api_port, websocket_port,
      vpn_ip_address, public_ip_address, network_type, server_info,
      api_key, outbound_api_key, status, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
    ) RETURNING id, server_name
  `, [
    branchId, serverData.server_name, serverData.ip_address, serverData.port,
    serverData.api_port, serverData.websocket_port, serverData.vpn_ip_address,
    serverData.public_ip_address, serverData.network_type, JSON.stringify(serverData.server_info || {}),
    serverData.api_key, serverData.outbound_api_key, serverData.status, serverData.is_active
  ]);
  
  res.status(201).json({
    success: true,
    data: {
      message: 'Server added successfully',
      server_id: result.rows[0].id,
      server_name: result.rows[0].server_name
    }
  });
}));

// DELETE /api/1c/branches/:code - Deactivate branch
router.delete('/:code', requirePermission('branches:write'), asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;
  
  const result = await DatabaseManager.query(`
    UPDATE branches 
    SET is_active = false, updated_at = NOW()
    WHERE code = $1
    RETURNING id, name
  `, [code]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Branch "${result.rows[0].name}" has been deactivated`,
      branch_id: result.rows[0].id
    }
  });
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createSyncLog(syncType: string, direction: string, totalRecords: number): Promise<string> {
  const result = await DatabaseManager.query(`
    INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
    VALUES ($1, $2, 'in_progress', $3, NOW())
    RETURNING id
  `, [syncType, direction, totalRecords]);
  
  return result.rows[0].id;
}

async function completeSyncLog(
  syncId: string, 
  status: string, 
  recordsProcessed: number, 
  errorMessage?: string
): Promise<void> {
  await DatabaseManager.query(`
    UPDATE onec_sync_logs 
    SET status = $1, records_processed = $2, error_message = $3, completed_at = NOW()
    WHERE id = $4
  `, [status, recordsProcessed, errorMessage, syncId]);
}

export default router;
