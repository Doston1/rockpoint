import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// ============================================================================
// SYNC LOGS MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/sync-logs - Get OneC sync logs with filtering
router.get('/', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 50, 
    sync_type,
    direction,
    status,
    start_date,
    end_date
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      id, sync_type, direction, status, records_total, records_processed,
      error_message, started_at, completed_at,
      CASE 
        WHEN completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (completed_at - started_at))
        ELSE 
          EXTRACT(EPOCH FROM (NOW() - started_at))
      END as duration_seconds
    FROM onec_sync_logs
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (sync_type) {
    params.push(sync_type);
    query += ` AND sync_type = $${params.length}`;
  }
  
  if (direction) {
    params.push(direction);
    query += ` AND direction = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  
  if (start_date) {
    params.push(start_date);
    query += ` AND started_at >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND started_at <= $${params.length}`;
  }
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY started_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      sync_logs: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/sync-logs/:id - Get specific sync log details
router.get('/:id', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      id, sync_type, direction, status, records_total, records_processed,
      error_message, started_at, completed_at,
      CASE 
        WHEN completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (completed_at - started_at))
        ELSE 
          EXTRACT(EPOCH FROM (NOW() - started_at))
      END as duration_seconds,
      CASE 
        WHEN records_total > 0 THEN 
          ROUND((records_processed::decimal / records_total::decimal) * 100, 2)
        ELSE 0
      END as completion_percentage
    FROM onec_sync_logs
    WHERE id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Sync log not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      sync_log: result.rows[0]
    }
  });
}));

// GET /api/1c/sync-logs/summary - Get sync logs summary statistics
router.get('/summary', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { days = 30 } = req.query;
  
  const summaryQuery = `
    SELECT 
      sync_type,
      direction,
      COUNT(*) as total_syncs,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_syncs,
      SUM(records_total) as total_records,
      SUM(records_processed) as total_processed,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
      MAX(started_at) as last_sync_at
    FROM onec_sync_logs
    WHERE started_at >= NOW() - INTERVAL '${Number(days)} days'
    GROUP BY sync_type, direction
    ORDER BY sync_type, direction
  `;
  
  const recentQuery = `
    SELECT 
      id, sync_type, direction, status, records_total, records_processed,
      started_at, completed_at,
      EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) as duration_seconds
    FROM onec_sync_logs
    WHERE started_at >= NOW() - INTERVAL '24 hours'
    ORDER BY started_at DESC
    LIMIT 20
  `;
  
  const [summaryResult, recentResult] = await Promise.all([
    DatabaseManager.query(summaryQuery),
    DatabaseManager.query(recentQuery)
  ]);
  
  res.json({
    success: true,
    data: {
      summary_period_days: Number(days),
      sync_summary: summaryResult.rows,
      recent_syncs: recentResult.rows
    }
  });
}));

// GET /api/1c/sync-logs/status - Get current sync status
router.get('/status', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  // Get currently running syncs
  const runningQuery = `
    SELECT 
      id, sync_type, direction, records_total, records_processed,
      started_at,
      EXTRACT(EPOCH FROM (NOW() - started_at)) as running_duration_seconds,
      CASE 
        WHEN records_total > 0 THEN 
          ROUND((records_processed::decimal / records_total::decimal) * 100, 2)
        ELSE 0
      END as completion_percentage
    FROM onec_sync_logs
    WHERE status = 'in_progress'
    ORDER BY started_at ASC
  `;
  
  // Get last 10 completed syncs
  const lastSyncsQuery = `
    SELECT 
      id, sync_type, direction, status, records_total, records_processed,
      started_at, completed_at,
      EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
    FROM onec_sync_logs
    WHERE status IN ('completed', 'failed')
    ORDER BY completed_at DESC
    LIMIT 10
  `;
  
  // Get system health metrics
  const healthQuery = `
    SELECT 
      COUNT(CASE WHEN status = 'failed' AND started_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as failed_last_24h,
      COUNT(CASE WHEN status = 'completed' AND started_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as completed_last_24h,
      COUNT(CASE WHEN status = 'in_progress' AND started_at <= NOW() - INTERVAL '2 hours' THEN 1 END) as stuck_syncs,
      MAX(CASE WHEN status = 'completed' THEN completed_at END) as last_successful_sync
    FROM onec_sync_logs
  `;
  
  const [runningResult, lastSyncsResult, healthResult] = await Promise.all([
    DatabaseManager.query(runningQuery),
    DatabaseManager.query(lastSyncsQuery),
    DatabaseManager.query(healthQuery)
  ]);
  
  const health = healthResult.rows[0];
  const healthStatus = health.stuck_syncs > 0 ? 'warning' : 
                     health.failed_last_24h > health.completed_last_24h ? 'error' : 'healthy';
  
  res.json({
    success: true,
    data: {
      system_status: healthStatus,
      running_syncs: runningResult.rows,
      recent_syncs: lastSyncsResult.rows,
      health_metrics: {
        failed_last_24h: parseInt(health.failed_last_24h),
        completed_last_24h: parseInt(health.completed_last_24h),
        stuck_syncs: parseInt(health.stuck_syncs),
        last_successful_sync: health.last_successful_sync
      }
    }
  });
}));

// DELETE /api/1c/sync-logs/cleanup - Cleanup old sync logs
router.delete('/cleanup', requirePermission('admin:write'), asyncHandler(async (req: Request, res: Response) => {
  const { older_than_days = 90 } = req.query;
  
  const result = await DatabaseManager.query(`
    DELETE FROM onec_sync_logs 
    WHERE started_at < NOW() - INTERVAL '${Number(older_than_days)} days'
    AND status IN ('completed', 'failed')
    RETURNING COUNT(*) as deleted_count
  `);
  
  res.json({
    success: true,
    data: {
      message: `Cleaned up sync logs older than ${older_than_days} days`,
      deleted_count: result.rowCount
    }
  });
}));

// ============================================================================
// SETTINGS MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/settings - Get 1C integration settings
router.get('/settings', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const result = await DatabaseManager.query(`
    SELECT 
      key, value, data_type, description, category,
      is_sensitive, updated_at
    FROM system_settings
    WHERE category = '1c_integration' OR category = 'onec_integration'
    ORDER BY category, key
  `);
  
  res.json({
    success: true,
    data: {
      settings: result.rows.map((setting: any) => ({
        key: setting.key,
        value: setting.is_sensitive ? '***' : setting.value,
        data_type: setting.data_type,
        description: setting.description,
        category: setting.category,
        is_sensitive: setting.is_sensitive,
        updated_at: setting.updated_at
      }))
    }
  });
}));

// PUT /api/1c/settings - Update 1C integration settings
router.put('/settings', requirePermission('admin:write'), asyncHandler(async (req: Request, res: Response) => {
  const { settings } = z.object({
    settings: z.array(z.object({
      key: z.string(),
      value: z.any(),
      data_type: z.enum(['string', 'number', 'boolean', 'json']).optional(),
      description: z.string().optional()
    }))
  }).parse(req.body);
  
  await DatabaseManager.query('BEGIN');
  
  try {
    const results = [];
    
    for (const setting of settings) {
      // Validate setting key belongs to 1C integration
      if (!setting.key.startsWith('onec_') && !setting.key.startsWith('1c_')) {
        throw new Error(`Invalid setting key: ${setting.key}. Must start with 'onec_' or '1c_'`);
      }
      
      // Convert value based on data type
      let processedValue = setting.value;
      if (setting.data_type === 'json') {
        processedValue = JSON.stringify(setting.value);
      } else if (setting.data_type === 'boolean') {
        processedValue = Boolean(setting.value).toString();
      } else if (setting.data_type === 'number') {
        processedValue = Number(setting.value).toString();
      } else {
        processedValue = String(setting.value);
      }
      
      const result = await DatabaseManager.query(`
        INSERT INTO system_settings (key, value, data_type, description, category, updated_at)
        VALUES ($1, $2, $3, $4, 'onec_integration', NOW())
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = $2,
          data_type = COALESCE($3, system_settings.data_type),
          description = COALESCE($4, system_settings.description),
          updated_at = NOW()
        RETURNING key, data_type
      `, [
        setting.key, 
        processedValue, 
        setting.data_type || 'string',
        setting.description
      ]);
      
      results.push({
        key: setting.key,
        updated: true,
        data_type: result.rows[0].data_type
      });
    }
    
    await DatabaseManager.query('COMMIT');
    
    res.json({
      success: true,
      data: {
        message: 'Settings updated successfully',
        updated_settings: results
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    throw error;
  }
}));

// GET /api/1c/settings/:key - Get specific setting
router.get('/settings/:key', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  
  // Validate setting key belongs to 1C integration
  if (!key.startsWith('onec_') && !key.startsWith('1c_')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid setting key. Must start with "onec_" or "1c_"'
    });
  }
  
  const result = await DatabaseManager.query(`
    SELECT 
      key, value, data_type, description, category,
      is_sensitive, created_at, updated_at
    FROM system_settings
    WHERE key = $1
  `, [key]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Setting not found'
    });
  }
  
  const setting = result.rows[0];
  
  res.json({
    success: true,
    data: {
      setting: {
        key: setting.key,
        value: setting.is_sensitive ? '***' : setting.value,
        data_type: setting.data_type,
        description: setting.description,
        category: setting.category,
        is_sensitive: setting.is_sensitive,
        created_at: setting.created_at,
        updated_at: setting.updated_at
      }
    }
  });
}));

// ============================================================================
// API KEYS MANAGEMENT ENDPOINTS
// ============================================================================

// GET /api/1c/api-keys - Get API keys for 1C integration (admin only)
router.get('/api-keys', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const result = await DatabaseManager.query(`
    SELECT 
      id, name, description, permissions, is_active,
      usage_count, last_used_at, expires_at, created_at, updated_at
    FROM api_keys
    WHERE name ILIKE '%1c%' OR name ILIKE '%onec%' OR description ILIKE '%1c%' OR description ILIKE '%onec%'
    ORDER BY created_at DESC
  `);
  
  res.json({
    success: true,
    data: {
      api_keys: result.rows.map((key: any) => ({
        ...key,
        key_hash: '***' // Never expose the actual key
      }))
    }
  });
}));

// POST /api/1c/api-keys - Create API key for 1C integration (admin only)
router.post('/api-keys', requirePermission('admin:write'), asyncHandler(async (req: Request, res: Response) => {
  const { name, description, permissions, expires_at } = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    permissions: z.array(z.string()).default([
      'products:read', 'products:write',
      'inventory:read', 'inventory:write',
      'transactions:read', 'transactions:write',
      'employees:read', 'employees:write',
      'customers:read', 'customers:write'
    ]),
    expires_at: z.string().optional()
  }).parse(req.body);
  
  // Generate API key
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let apiKey = 'rp_onec_'; // Prefix for RockPoint OneC integration
  
  for (let i = 0; i < 32; i++) {
    apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const result = await DatabaseManager.query(`
    INSERT INTO api_keys (
      name, description, key_hash, permissions, expires_at, 
      is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, true, NOW(), NOW()
    ) RETURNING id, name, permissions, expires_at
  `, [
    name, 
    description, 
    apiKey, // Store the key directly for simplicity (in production, hash it)
    JSON.stringify(permissions),
    expires_at
  ]);
  
  res.status(201).json({
    success: true,
    data: {
      message: 'API key created successfully',
      api_key_info: result.rows[0],
      api_key: apiKey, // Only returned on creation
      warning: 'Store this API key securely. It will not be shown again.'
    }
  });
}));

export default router;
