import { Request, Response, Router } from 'express';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';
import { BranchApiService } from '../services/branchApi';

const router = Router();

// Get all branch servers
router.get('/branch-servers', asyncHandler(async (req: Request, res: Response) => {
  const { status, network_type } = req.query;
  
  let query = `
    SELECT 
      bs.*,
      b.name as branch_name,
      b.code as branch_code
    FROM branch_servers bs
    LEFT JOIN branches b ON bs.branch_id = b.id
    WHERE bs.is_active = true
  `;
  
  const params: any[] = [];
  
  if (status) {
    params.push(status);
    query += ` AND bs.status = $${params.length}`;
  }
  
  if (network_type) {
    params.push(network_type);
    query += ` AND bs.network_type = $${params.length}`;
  }
  
  query += ' ORDER BY b.name ASC, bs.server_name ASC';
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows,
    total: result.rows.length
  });
}));

// Get branch server by ID
router.get('/branch-servers/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      bs.*,
      b.name as branch_name,
      b.code as branch_code
    FROM branch_servers bs
    LEFT JOIN branches b ON bs.branch_id = b.id
    WHERE bs.id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch server not found'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Create or update branch server
router.post('/branch-servers', asyncHandler(async (req: Request, res: Response) => {
  const {
    branch_id,
    server_name,
    ip_address,
    port,
    api_port,
    websocket_port,
    vpn_ip_address,
    public_ip_address,
    network_type,
    server_info,
    api_key,
    outbound_api_key
  } = req.body;
  
  // Validate required fields
  if (!branch_id || !server_name || !ip_address || !port) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: branch_id, server_name, ip_address, port'
    });
  }
  
  const query = `
    INSERT INTO branch_servers (
      branch_id, server_name, ip_address, port, api_port, websocket_port,
      vpn_ip_address, public_ip_address, network_type, server_info, api_key, outbound_api_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (branch_id, server_name) 
    DO UPDATE SET
      ip_address = EXCLUDED.ip_address,
      port = EXCLUDED.port,
      api_port = EXCLUDED.api_port,
      websocket_port = EXCLUDED.websocket_port,
      vpn_ip_address = EXCLUDED.vpn_ip_address,
      public_ip_address = EXCLUDED.public_ip_address,
      network_type = EXCLUDED.network_type,
      server_info = EXCLUDED.server_info,
      api_key = EXCLUDED.api_key,
      outbound_api_key = EXCLUDED.outbound_api_key,
      updated_at = NOW()
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [
    branch_id, server_name, ip_address, port, api_port || port,
    websocket_port || (port + 1), vpn_ip_address, public_ip_address,
    network_type || 'lan', server_info ? JSON.stringify(server_info) : null, 
    api_key, outbound_api_key
  ]);
  
  res.json({
    success: true,
    data: result.rows[0],
    message: 'Branch server configuration saved successfully'
  });
}));

// Update branch server status
router.patch('/branch-servers/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, response_time_ms, server_info } = req.body;
  
  const query = `
    UPDATE branch_servers 
    SET 
      status = $2,
      last_ping = NOW(),
      response_time_ms = $3,
      server_info = COALESCE($4, server_info),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [
    id, status, response_time_ms, server_info ? JSON.stringify(server_info) : null
  ]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch server not found'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Delete branch server
router.delete('/branch-servers/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    UPDATE branch_servers 
    SET is_active = false, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Branch server not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Branch server deleted successfully'
  });
}));

// Get network settings
router.get('/settings', asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;
  
  let query = 'SELECT * FROM network_settings WHERE 1=1';
  const params: any[] = [];
  
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  
  query += ' ORDER BY category ASC, setting_key ASC';
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

// Update network setting
router.patch('/settings/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { setting_value, description } = req.body;
  
  if (!setting_value) {
    return res.status(400).json({
      success: false,
      error: 'setting_value is required'
    });
  }
  
  const query = `
    UPDATE network_settings 
    SET 
      setting_value = $2,
      description = COALESCE($3, description),
      updated_at = NOW()
    WHERE setting_key = $1 AND is_system = false
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [
    key, setting_value, description
  ]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Network setting not found or is a system setting'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Test connection to branch server
router.post('/branch-servers/:id/test-connection', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  console.log(`🧪 Testing connection to branch server ID: ${id}`);
  
  // Get branch server details
  const serverQuery = 'SELECT * FROM branch_servers WHERE id = $1';
  const serverResult = await DatabaseManager.query(serverQuery, [id]);
  
  if (serverResult.rows.length === 0) {
    console.log(`❌ Branch server not found for ID: ${id}`);
    return res.status(404).json({
      success: false,
      error: 'Branch server not found'
    });
  }
  
  const server = serverResult.rows[0];
  console.log(`📋 Found branch server: ${JSON.stringify(server, null, 2)}`);
  
  try {
    // Use the new BranchApiService to test connection
    console.log(`🔗 Calling BranchApiService.testConnection for branch_id: ${server.branch_id}`);
    const result = await BranchApiService.testConnection(server.branch_id);
    
    // Update server status based on test result
    const newStatus = result.success ? 'online' : 'error';
    const actualResponseTime = result.success && typeof result.data === 'object' && result.data.response_time_ms 
      ? result.data.response_time_ms 
      : null;
    
    const updateQuery = `
      UPDATE branch_servers 
      SET 
        status = $2,
        last_ping = NOW(),
        response_time_ms = $3,
        updated_at = NOW()
      WHERE id = $1
    `;
    
    await DatabaseManager.query(updateQuery, [
      id, newStatus, actualResponseTime
    ]);
    
    res.json({
      success: result.success,
      data: {
        status: newStatus,
        response_time_ms: actualResponseTime,
        message: result.success ? 'Connection test successful' : `Connection test failed: ${result.error}`,
        authenticated: result.success && result.status !== 401,
        api_key_configured: !!server.outbound_api_key,
        server_name: server.server_name,
        branch_name: server.branch_name || 'Unknown',
        error_details: result.success ? null : result.error
      }
    });
    
  } catch (error: any) {
    // Update server status to error
    const updateQuery = `
      UPDATE branch_servers 
      SET 
        status = 'error',
        last_ping = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `;
    
    await DatabaseManager.query(updateQuery, [id]);
    
    res.json({
      success: false,
      data: {
        status: 'error',
        response_time_ms: null,
        message: `Connection test failed: ${error.message}`,
        authenticated: false,
        api_key_configured: !!server.outbound_api_key,
        server_name: server.server_name,
        branch_name: server.branch_name || 'Unknown',
        error_details: error.message
      }
    });
  }
}));

// Get connection health logs
router.get('/health-logs', asyncHandler(async (req: Request, res: Response) => {
  const { limit = 50, source_type, target_type } = req.query;
  
  let query = `
    SELECT * FROM connection_health_logs
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (source_type) {
    params.push(source_type);
    query += ` AND source_type = $${params.length}`;
  }
  
  if (target_type) {
    params.push(target_type);
    query += ` AND target_type = $${params.length}`;
  }
  
  query += ` ORDER BY checked_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

// Sync data to all or specific branches
router.post('/sync-to-branches', asyncHandler(async (req: Request, res: Response) => {
  const { sync_type, data, branch_ids } = req.body;
  
  if (!sync_type || !data) {
    return res.status(400).json({
      success: false,
      error: 'sync_type and data are required'
    });
  }
  
  // Get target branches
  let branchQuery = `
    SELECT DISTINCT bs.branch_id, b.name as branch_name, b.code as branch_code
    FROM branch_servers bs
    JOIN branches b ON bs.branch_id = b.id
    WHERE bs.is_active = true AND bs.status = 'online'
  `;
  
  const params: any[] = [];
  if (branch_ids && branch_ids.length > 0) {
    branchQuery += ` AND bs.branch_id = ANY($1)`;
    params.push(branch_ids);
  }
  
  const branchesResult = await DatabaseManager.query(branchQuery, params);
  
  if (branchesResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'No active online branches found'
    });
  }
  
  // Sync to all target branches
  const syncPromises = branchesResult.rows.map((branch: any) => 
    BranchApiService.syncToBranch(branch.branch_id, sync_type, data)
  );
  
  const results = await Promise.all(syncPromises);
  
  // Prepare summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  res.json({
    success: true,
    data: {
      sync_type,
      total_branches: results.length,
      successful_syncs: successful.length,
      failed_syncs: failed.length,
      results: results.map(result => ({
        branch_id: result.branchId,
        success: result.success,
        error: result.error,
        status: result.status
      }))
    }
  });
}));

export default router;
