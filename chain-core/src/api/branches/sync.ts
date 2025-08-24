import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { asyncHandler } from '../../middleware/errorHandler';
import { completeBranchSyncLog, createBranchSyncLog } from './auth';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const syncRequestSchema = z.object({
  sync_type: z.enum(['full', 'products', 'employees', 'inventory']),
  last_sync_at: z.string().optional(), // For incremental syncs  
  since: z.string().optional(), // For incremental syncs
  incremental: z.boolean().default(false),
  force: z.boolean().default(false) // Force sync even if recent sync exists
});

const healthCheckSchema = z.object({
  status: z.string().optional(),
  last_activity: z.string().optional(),
  system_info: z.object({
    version: z.string().optional(),
    uptime: z.number().optional(),
    cpu_usage: z.number().optional(),
    memory_usage: z.number().optional(),
    disk_space: z.number().optional()
  }).optional(),
  server_info: z.object({
    version: z.string().optional(),
    uptime: z.number().optional(),
    cpu_usage: z.number().optional(),
    memory_usage: z.number().optional(),
    disk_space: z.number().optional()
  }).optional(),
  database_status: z.object({
    connected: z.boolean(),
    last_query_time: z.number().optional()
  }).optional(),
  network_info: z.object({
    ping_ms: z.number().optional(),
    bandwidth_mbps: z.number().optional()
  }).optional(),
  last_sync: z.string().optional()
});

// ============================================================================
// SYNC STATUS AND HEALTH ENDPOINTS
// ============================================================================

/**
 * POST /api/branches/sync/health
 * Report branch health status to chain-core
 */
router.post('/health', asyncHandler(async (req: Request, res: Response) => {
  const healthData = healthCheckSchema.parse(req.body);
  const branchServer = req.branchServer!;
  
  // Determine status from healthData.status or database connection
  const serverStatus = healthData.status || (healthData.database_status?.connected ? 'online' : 'error');
  const healthStatus = healthData.status === 'online' || healthData.database_status?.connected ? 'healthy' : 'unhealthy';
  
  // Update branch server status and health info
  await DatabaseManager.query(`
    UPDATE branch_servers 
    SET 
      status = $1,
      last_ping = NOW(),
      server_info = $2,
      updated_at = NOW()
    WHERE id = $3
  `, [
    serverStatus,
    JSON.stringify({
      ...healthData.server_info,
      ...healthData.system_info,
      network_info: healthData.network_info
    }),
    branchServer.id
  ]);
  
  // Store health log - temporarily disabled for testing
  /*
  await DatabaseManager.query(`
    INSERT INTO connection_health_logs (
      source_type, source_id, target_type, target_id, 
      connection_status, response_time_ms, error_message, checked_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, NOW()
    )
  `, [
    'branch_core',
    branchServer.branchId,
    'chain_core',
    branchServer.id,
    healthStatus === 'healthy' ? 'success' : 'error',
    healthData.database_status?.last_query_time || healthData.network_info?.ping_ms || 0,
    healthStatus === 'healthy' ? null : 'Health check failed'
  ]);
  */
  
  res.json({
    success: true,
    data: {
      message: 'Health status updated successfully',
      branch_code: branchServer.branchCode,
      server_name: branchServer.serverName,
      status: healthData.status || serverStatus,
      system_info: healthData.system_info,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/branches/sync/health
 * Get current branch health status
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  
  // Get current branch server status
  const result = await DatabaseManager.query(`
    SELECT 
      bs.status,
          bs.last_ping,
      bs.server_info,
      b.code as branch_code,
      b.name as branch_name
    FROM branch_servers bs
    JOIN branches b ON bs.branch_id = b.id
    WHERE bs.id = $1
  `, [branchServer.id]);
  
  const serverData = result.rows[0];
  
  res.json({
    success: true,
    data: {
      branch_code: serverData.branch_code,
      branch_name: serverData.branch_name,
      status: serverData.status || 'unknown',
      last_update: serverData.last_ping,
      system_info: serverData.server_info || {},
      network_info: {
        last_ping: serverData.last_ping,
        connection_status: serverData.status
      }
    }
  });
}));

/**
 * GET /api/branches/sync/status
 * Get branch sync status and recent sync logs
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { limit = 10 } = req.query;
  
  // Get recent sync logs
  const syncLogsResult = await DatabaseManager.query(`
    SELECT 
      id, sync_type, direction, status, records_processed, records_failed,
      error_message, started_at, completed_at,
      EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
    FROM branch_sync_logs
    WHERE branch_id = $1
    ORDER BY started_at DESC
    LIMIT $2
  `, [branchServer.branchId, Number(limit)]);
  
  // Get branch server status
  const serverStatusResult = await DatabaseManager.query(`
    SELECT 
      bs.status, bs.last_ping, bs.response_time_ms, bs.server_info,
      b.name as branch_name, b.code as branch_code
    FROM branch_servers bs
    JOIN branches b ON bs.branch_id = b.id
    WHERE bs.id = $1
  `, [branchServer.id]);
  
  // Get sync statistics
  const syncStatsResult = await DatabaseManager.query(`
    SELECT 
      sync_type,
      COUNT(*) as total_syncs,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_syncs,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
      MAX(completed_at) as last_sync_time
    FROM branch_sync_logs
    WHERE branch_id = $1 AND started_at >= NOW() - INTERVAL '30 days'
    GROUP BY sync_type
  `, [branchServer.branchId]);
  
  res.json({
    success: true,
    data: {
      branch_info: {
        branch_id: branchServer.branchId,
        branch_code: branchServer.branchCode,
        server_name: branchServer.serverName,
        server_id: branchServer.id
      },
      server_status: serverStatusResult.rows[0] || null,
      recent_sync_logs: syncLogsResult.rows,
      sync_statistics: syncStatsResult.rows,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/branches/sync/logs/:syncId
 * Get detailed information about a specific sync operation
 */
router.get('/logs/:syncId', asyncHandler(async (req: Request, res: Response) => {
  const { syncId } = req.params;
  const branchServer = req.branchServer!;
  
  const result = await DatabaseManager.query(`
    SELECT 
      id, sync_type, direction, status, records_processed, records_failed,
      error_message, started_at, completed_at,
      EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
    FROM branch_sync_logs
    WHERE id = $1 AND branch_id = $2
  `, [syncId, branchServer.branchId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Sync log not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      sync_log: result.rows[0],
      branch_code: branchServer.branchCode
    }
  });
}));

// ============================================================================
// SYNC REQUEST ENDPOINTS
// ============================================================================

/**
 * POST /api/branches/sync/request
 * Request data sync from chain-core
 */
router.post('/request', asyncHandler(async (req: Request, res: Response) => {
  const syncRequest = syncRequestSchema.parse(req.body);
  const branchServer = req.branchServer!;
  
  // Check if recent sync exists (unless forced)
  if (!syncRequest.force) {
    const recentSyncResult = await DatabaseManager.query(`
      SELECT id, started_at 
      FROM branch_sync_logs
      WHERE branch_id = $1 
        AND sync_type = $2 
        AND direction = 'outbound'
        AND status IN ('in_progress', 'completed')
        AND started_at >= NOW() - INTERVAL '1 hour'
      ORDER BY started_at DESC
      LIMIT 1
    `, [branchServer.branchId, syncRequest.sync_type]);
    
    if (recentSyncResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Recent sync operation found. Use force=true to override.',
        data: {
          recent_sync_id: recentSyncResult.rows[0].id,
          recent_sync_time: recentSyncResult.rows[0].started_at
        }
      });
    }
  }
  
  const syncId = await createBranchSyncLog(
    branchServer.branchId,
    syncRequest.sync_type,
    'to_branch',
    0 // Will be updated based on sync type
  );
  
  let syncData = {};
  let recordCount = 0;
  
  try {
    switch (syncRequest.sync_type) {
      case 'products':
      case 'full':
        // Get products data
        const productsQuery = `
          SELECT 
            p.id, p.name, p.sku, p.barcode, p.description,
            p.category_id, p.is_active, p.attributes, p.updated_at,
            c.name as category_name,
            bpp.price, bpp.cost, bpp.is_available,
            bpp.updated_at as pricing_updated_at
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
          WHERE p.is_active = true
          ${syncRequest.since ? 'AND (p.updated_at >= $2 OR bpp.updated_at >= $2)' : ''}
          ORDER BY p.updated_at DESC
        `;
        
        const productsParams = [branchServer.branchId];
        if (syncRequest.since) {
          productsParams.push(syncRequest.since);
        }
        
        const productsResult = await DatabaseManager.query(productsQuery, productsParams);
        syncData = { ...syncData, products: productsResult.rows };
        recordCount += productsResult.rows.length;
        
        if (syncRequest.sync_type === 'products') break;
        // Fall through for full sync
        
      case 'employees':
        // Get employees data
        const employeesQuery = `
          SELECT 
            id, employee_id, name, role, phone, email,
            hire_date, salary, status, updated_at
          FROM employees
          WHERE branch_id = $1 AND status = 'active'
          ${syncRequest.since ? 'AND updated_at >= $2' : ''}
          ORDER BY updated_at DESC
        `;
        
        const employeesParams = [branchServer.branchId];
        if (syncRequest.since) {
          employeesParams.push(syncRequest.since);
        }
        
        const employeesResult = await DatabaseManager.query(employeesQuery, employeesParams);
        syncData = { ...syncData, employees: employeesResult.rows };
        recordCount += employeesResult.rows.length;
        
        if (syncRequest.sync_type === 'employees') break;
        // Fall through for full sync
        
      case 'inventory':
        // Get inventory data
        const inventoryQuery = `
          SELECT 
            bi.product_id, bi.quantity_in_stock, bi.min_stock_level, bi.max_stock_level,
            bi.last_counted_at, bi.updated_at,
            p.name as product_name, p.sku, p.barcode
          FROM branch_inventory bi
          JOIN products p ON bi.product_id = p.id
          WHERE bi.branch_id = $1
          ${syncRequest.since ? 'AND bi.updated_at >= $2' : ''}
          ORDER BY bi.updated_at DESC
        `;
        
        const inventoryParams = [branchServer.branchId];
        if (syncRequest.since) {
          inventoryParams.push(syncRequest.since);
        }
        
        const inventoryResult = await DatabaseManager.query(inventoryQuery, inventoryParams);
        syncData = { ...syncData, inventory: inventoryResult.rows };
        recordCount += inventoryResult.rows.length;
        
        break;
        
      default:
        throw new Error(`Unsupported sync type: ${syncRequest.sync_type}`);
    }
    
    // Update sync log with record count
    await DatabaseManager.query(`
      UPDATE branch_sync_logs 
      SET records_processed = $1, status = 'completed', completed_at = NOW()
      WHERE id = $2
    `, [recordCount, syncId]);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        sync_type: syncRequest.sync_type,
        status: 'initiated',
        incremental: Boolean(syncRequest.since),
        branch_code: branchServer.branchCode,
        records_count: recordCount,
        sync_data: syncData,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    await completeBranchSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

/**
 * GET /api/branches/sync/updates/:dataType
 * Get incremental updates for specific data types
 */
router.get('/updates/:dataType', asyncHandler(async (req: Request, res: Response) => {
  const { dataType } = req.params;
  const branchServer = req.branchServer!;
  const { since, limit = 100 } = req.query;
  
  if (!since) {
    return res.status(400).json({
      success: false,
      error: 'since parameter is required for incremental updates'
    });
  }
  
  let query = '';
  const params: any[] = [branchServer.branchId, since];
  
  switch (dataType) {
    case 'products':
      query = `
        SELECT 
          p.id, p.name, p.sku, p.barcode, p.description,
          p.category_id, p.is_active, p.updated_at,
          bpp.price, bpp.cost, bpp.is_available,
          bpp.updated_at as pricing_updated_at
        FROM products p
        LEFT JOIN branch_product_pricing bpp ON p.id = bpp.product_id AND bpp.branch_id = $1
        WHERE (p.updated_at >= $2 OR bpp.updated_at >= $2)
        ORDER BY GREATEST(p.updated_at, COALESCE(bpp.updated_at, p.updated_at)) DESC
        LIMIT $3
      `;
      params.push(Number(limit));
      break;
      
    case 'employees':
      query = `
        SELECT 
          id, employee_id, name, role, phone, email,
          hire_date, salary, status, updated_at
        FROM employees
        WHERE branch_id = $1 AND updated_at >= $2
        ORDER BY updated_at DESC
        LIMIT $3
      `;
      params.push(Number(limit));
      break;
      
    case 'inventory':
      query = `
        SELECT 
          bi.product_id, bi.current_stock, bi.minimum_stock, bi.maximum_stock,
          bi.last_counted_at, bi.updated_at,
          p.name as product_name, p.sku, p.barcode
        FROM branch_inventory bi
        JOIN products p ON bi.product_id = p.id
        WHERE bi.branch_id = $1 AND bi.updated_at >= $2
        ORDER BY bi.updated_at DESC
        LIMIT $3
      `;
      params.push(Number(limit));
      break;
      
    default:
      return res.status(400).json({
        success: false,
        error: `Unsupported data type: ${dataType}`
      });
  }
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      data_type: dataType,
      branch_code: branchServer.branchCode,
      since,
      records_count: result.rows.length,
      updates: result.rows,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/branches/sync/ping
 * Simple ping endpoint for connectivity testing
 */
router.post('/ping', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const startTime = Date.now();
  const { sequence = 1 } = req.body;
  
  // Update last ping time
  await DatabaseManager.query(`
    UPDATE branch_servers 
    SET last_ping = NOW(), status = 'online'
    WHERE id = $1
  `, [branchServer.id]);
  
  const responseTime = Date.now() - startTime;
  
  res.json({
    success: true,
    data: {
      pong: true,
      message: 'Pong',
      branch_code: branchServer.branchCode,
      server_name: branchServer.serverName,
      server_time: new Date().toISOString(),
      response_time_ms: responseTime,
      round_trip_ms: responseTime,
      sequence: sequence,
      timestamp: new Date().toISOString()
    }
  });
}));

// ============================================================================
// GET /status/:syncId - Get specific sync status
// ============================================================================
router.get('/status/:syncId', asyncHandler(async (req: Request, res: Response) => {
  const { syncId } = req.params;
  const branchServer = req.branchServer!;
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(syncId)) {
    return res.status(404).json({
      success: false,
      code: 'SYNC_NOT_FOUND',
      message: 'Sync record not found'
    });
  }
  
  const result = await DatabaseManager.query(`
    SELECT 
      id, sync_type, direction, status, records_processed, records_failed,
      error_message, started_at, completed_at,
      EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
    FROM branch_sync_logs
    WHERE id = $1 AND branch_id = $2
  `, [syncId, branchServer.branchId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      code: 'SYNC_NOT_FOUND',
      message: 'Sync record not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      sync_id: result.rows[0].id,
      status: result.rows[0].status,
      sync_type: result.rows[0].sync_type,
      direction: result.rows[0].direction,
      records_processed: result.rows[0].records_processed,
      records_failed: result.rows[0].records_failed,
      error_message: result.rows[0].error_message,
      started_at: result.rows[0].started_at,
      completed_at: result.rows[0].completed_at,
      duration_seconds: result.rows[0].duration_seconds,
      progress: result.rows[0].status === 'completed' ? 100 : result.rows[0].status === 'failed' ? 0 : 50
    }
  });
}));

// ============================================================================
// GET /history - Get sync history with filtering and pagination
// ============================================================================
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { sync_type, status, page = 1, limit = 50 } = req.query;
  
  let query = `
    SELECT 
      id, sync_type, direction, status, records_processed, records_failed,
      error_message, started_at, completed_at,
      EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
    FROM branch_sync_logs
    WHERE branch_id = $1
  `;
  
  const params = [branchServer.branchId];
  let paramIndex = 2;
  
  if (sync_type) {
    query += ` AND sync_type = $${paramIndex}`;
    params.push(sync_type as string);
    paramIndex++;
  }
  
  if (status) {
    query += ` AND status = $${paramIndex}`;
    params.push(status as string);
    paramIndex++;
  }
  
  query += ` ORDER BY started_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit as string, ((Number(page) - 1) * Number(limit)).toString());
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: result.rows.length
    }
  });
}));

// ============================================================================
// GET /metrics - Get sync metrics and statistics
// ============================================================================
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { include_breakdown } = req.query;
  
  // Get overall metrics
  const metricsResult = await DatabaseManager.query(`
    SELECT 
      COUNT(*)::int as total_syncs,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as successful_syncs,
      COUNT(CASE WHEN status = 'failed' THEN 1 END)::int as failed_syncs,
      COUNT(CASE WHEN status IN ('started', 'in_progress') THEN 1 END)::int as active_syncs,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as average_sync_time,
      MAX(CASE WHEN status = 'completed' THEN started_at END) as last_successful_sync
    FROM branch_sync_logs
    WHERE branch_id = $1
  `, [branchServer.branchId]);
  
  let metrics = metricsResult.rows[0];
  
  // Get breakdown by sync type if requested
  if (include_breakdown === 'true') {
    const breakdownResult = await DatabaseManager.query(`
      SELECT 
        sync_type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM branch_sync_logs
      WHERE branch_id = $1
      GROUP BY sync_type
    `, [branchServer.branchId]);
    
    metrics.by_sync_type = breakdownResult.rows;
  }
  
  res.json({
    success: true,
    data: metrics
  });
}));

// ============================================================================
// POST /complete/:syncId - Mark sync as completed or failed
// ============================================================================
router.post('/complete/:syncId', asyncHandler(async (req: Request, res: Response) => {
  const { syncId } = req.params;
  const branchServer = req.branchServer!;
  const { status, records_processed, records_failed, error_message } = req.body;
  
  // Validate sync exists and belongs to this branch
  const existingSync = await DatabaseManager.query(`
    SELECT id, status FROM branch_sync_logs
    WHERE id = $1 AND branch_id = $2
  `, [syncId, branchServer.branchId]);
  
  if (existingSync.rows.length === 0) {
    return res.status(404).json({
      success: false,
      code: 'SYNC_NOT_FOUND',
      message: 'Sync record not found'
    });
  }
  
  // Update sync status
  await DatabaseManager.query(`
    UPDATE branch_sync_logs 
    SET 
      status = $1, 
      records_processed = COALESCE($2, records_processed),
      records_failed = COALESCE($3, records_failed),
      error_message = $4,
      completed_at = NOW()
    WHERE id = $5
  `, [status, records_processed, records_failed, error_message, syncId]);
  
  res.json({
    success: true,
    data: {
      sync_id: syncId,
      status: status,
      records_processed: records_processed,
      records_failed: records_failed,
      error_message: error_message,
      completed_at: new Date().toISOString()
    }
  });
}));

export default router;
