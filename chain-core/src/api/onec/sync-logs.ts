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
// Note: Specific routes MUST come before parameterized routes like /:id
// ============================================================================

// GET /api/1c/sync-logs/summary - Get sync logs summary statistics
router.get('/summary', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { days = 30, start_date, end_date } = req.query;
  
  let dateFilter = '';
  const params: any[] = [];
  
  if (start_date && end_date) {
    dateFilter = 'WHERE started_at BETWEEN $1 AND $2';
    params.push(start_date, end_date);
  } else {
    dateFilter = `WHERE started_at >= NOW() - INTERVAL '${Number(days)} days'`;
  }
  
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
    ${dateFilter}
    GROUP BY sync_type, direction
    ORDER BY sync_type, direction
  `;
  
  const result = await DatabaseManager.query(summaryQuery, params);
  
  // Calculate totals
  const stats = {
    total_syncs: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_syncs), 0),
    successful_syncs: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.successful_syncs), 0),
    completed_syncs: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.successful_syncs), 0), // Alias for tests
    failed_syncs: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.failed_syncs), 0),
    in_progress_syncs: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.in_progress_syncs), 0),
    total_records: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_records || 0), 0),
    total_processed: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.total_processed || 0), 0),
    by_type: result.rows
  };
  
  res.json({
    success: true,
    data: {
      stats,
      period: { days: Number(days), start_date, end_date }
    }
  });
}));

// DELETE /api/1c/sync-logs/cleanup - Cleanup old sync logs
router.delete('/cleanup', requirePermission('admin:write'), asyncHandler(async (req: Request, res: Response) => {
  const { older_than_days = 90, status, sync_type } = req.query;
  
  let deleteQuery = `
    DELETE FROM onec_sync_logs
    WHERE started_at < NOW() - INTERVAL '${Number(older_than_days)} days'
  `;
  
  const params: any[] = [];
  
  if (status) {
    params.push(status);
    deleteQuery += ` AND status = $${params.length}`;
  }
  
  if (sync_type) {
    params.push(sync_type);
    deleteQuery += ` AND sync_type = $${params.length}`;
  }
  
  const result = await DatabaseManager.query(deleteQuery, params);
  
  res.json({
    success: true,
    data: {
      deleted_count: result.rowCount,
      message: `Deleted ${result.rowCount} sync log entries`
    }
  });
}));

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
      error_message, started_at, completed_at, metadata,
      CASE 
        WHEN completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
        ELSE 
          EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
      END as duration_ms,
      CASE 
        WHEN records_total > 0 THEN 
          ROUND((records_processed::decimal / records_total::decimal) * 100, 2)
        ELSE 0
      END as completion_percentage
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
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as count FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || 0);
  
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

// POST /api/1c/sync-logs - Create new sync log entry
router.post('/', requirePermission('admin:write'), asyncHandler(async (req: Request, res: Response) => {
  const syncLogSchema = z.object({
    sync_type: z.enum(['products', 'categories', 'branches', 'employees', 'transactions', 'customers']),
    direction: z.enum(['import', 'export', 'bidirectional']),
    records_total: z.number().int().min(0).optional(),
    metadata: z.object({}).optional()
  });
  
  const validatedData = syncLogSchema.parse(req.body);
  
  const insertQuery = `
    INSERT INTO onec_sync_logs (
      sync_type, direction, status, records_total, records_processed,
      started_at, metadata
    ) VALUES ($1, $2, 'in_progress', $3, 0, NOW(), $4)
    RETURNING id, sync_type, direction, status, started_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.sync_type,
    validatedData.direction,
    validatedData.records_total || 0,
    JSON.stringify(validatedData.metadata || {})
  ]);
  
  res.status(201).json({
    success: true,
    data: {
      sync_log: result.rows[0],
      message: 'Sync log created successfully'
    }
  });
}));

// GET /api/1c/sync-logs/:id - Get specific sync log details (MUST come after specific routes)
router.get('/:id', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      id, sync_type, direction, status, records_total, records_processed,
      error_message, started_at, completed_at, metadata,
      CASE 
        WHEN completed_at IS NOT NULL THEN 
          ROUND(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)
        ELSE 
          ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)
      END as duration_ms,
      CASE 
        WHEN records_total > 0 THEN 
          ROUND((records_processed::decimal / records_total::decimal) * 100, 2)
        ELSE 0
      END as completion_percentage,
      CASE 
        WHEN records_total > 0 AND completed_at IS NOT NULL THEN 
          ROUND(records_processed::decimal / GREATEST(EXTRACT(EPOCH FROM (completed_at - started_at)), 1), 2)
        ELSE 0
      END as records_per_second
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
  
  const syncLog = result.rows[0];
  
  // Convert string values to numbers
  if (syncLog.duration_ms) {
    syncLog.duration_ms = parseInt(syncLog.duration_ms);
  }
  if (syncLog.records_per_second) {
    syncLog.records_per_second = parseFloat(syncLog.records_per_second);
  }
  
  // Add success rate calculation
  if (syncLog.records_total > 0) {
    syncLog.success_rate = syncLog.records_processed / syncLog.records_total;
  } else {
    syncLog.success_rate = 1.0;
  }
  
  res.json({
    success: true,
    data: {
      sync_log: syncLog
    }
  });
}));

// DELETE /api/1c/sync-logs/:id - Delete specific sync log
router.delete('/:id', requirePermission('admin:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const deleteQuery = 'DELETE FROM onec_sync_logs WHERE id = $1';
  const result = await DatabaseManager.query(deleteQuery, [id]);
  
  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      error: 'Sync log not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: 'Sync log deleted successfully'
    }
  });
}));

// DELETE /api/1c/sync-logs - Bulk delete sync logs with filters
router.delete('/', requirePermission('admin:write'), asyncHandler(async (req: Request, res: Response) => {
  const { older_than_days, status, sync_type } = req.query;
  
  if (!older_than_days && !status && !sync_type) {
    return res.status(400).json({
      success: false,
      error: 'At least one filter parameter is required (older_than_days, status, or sync_type)'
    });
  }
  
  let deleteQuery = 'DELETE FROM onec_sync_logs WHERE 1=1';
  const params: any[] = [];
  
  if (older_than_days) {
    deleteQuery += ` AND started_at < NOW() - INTERVAL '${Number(older_than_days)} days'`;
  }
  
  if (status) {
    params.push(status);
    deleteQuery += ` AND status = $${params.length}`;
  }
  
  if (sync_type) {
    params.push(sync_type);
    deleteQuery += ` AND sync_type = $${params.length}`;
  }
  
  const result = await DatabaseManager.query(deleteQuery, params);
  
  res.json({
    success: true,
    data: {
      deleted_count: result.rowCount,
      message: `Deleted ${result.rowCount} sync log entries`
    }
  });
}));

export default router;
