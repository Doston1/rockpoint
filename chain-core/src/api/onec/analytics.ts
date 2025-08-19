import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// ============================================================================
// SYSTEM ANALYTICS ENDPOINTS
// ============================================================================

// GET /api/1c/analytics - Get comprehensive system analytics
router.get('/', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '30d' } = req.query;
  
  let dateFilter = "WHERE created_at >= NOW() - INTERVAL '30 days'";
  switch (period) {
    case '7d':
      dateFilter = "WHERE created_at >= NOW() - INTERVAL '7 days'";
      break;
    case '1d':
      dateFilter = "WHERE created_at >= NOW() - INTERVAL '1 day'";
      break;
    case '90d':
      dateFilter = "WHERE created_at >= NOW() - INTERVAL '90 days'";
      break;
    case '1y':
      dateFilter = "WHERE created_at >= NOW() - INTERVAL '1 year'";
      break;
  }
  
  // Product Analytics
  const productAnalytics = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total_products,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
      COUNT(CASE WHEN onec_id IS NOT NULL THEN 1 END) as synced_with_onec,
      AVG(price) as avg_price,
      SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END) as products_with_price
    FROM products
    ${dateFilter.replace('created_at', 'created_at')}
  `);
  
  // Transaction Analytics
  const transactionAnalytics = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as avg_transaction_value,
      COUNT(DISTINCT customer_id) as unique_customers,
      COUNT(DISTINCT employee_id) as active_employees
    FROM transactions
    ${dateFilter.replace('created_at', 'transaction_date')}
  `);
  
  // Inventory Analytics
  const inventoryAnalytics = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total_inventory_items,
      SUM(quantity) as total_stock_units,
      COUNT(CASE WHEN quantity <= reorder_level THEN 1 END) as low_stock_items,
      COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items,
      SUM(quantity * cost_price) as total_inventory_value
    FROM inventory
  `);
  
  // Branch Analytics
  const branchAnalytics = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total_branches,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active_branches,
      COUNT(CASE WHEN server_id IS NOT NULL THEN 1 END) as branches_with_servers,
      AVG(CASE WHEN last_sync_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (NOW() - last_sync_at)) / 3600 
      END) as avg_hours_since_last_sync
    FROM branches
  `);
  
  // Employee Analytics
  const employeeAnalytics = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total_employees,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active_employees,
      COUNT(DISTINCT branch_id) as branches_with_employees,
      COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_employees,
      COUNT(CASE WHEN role = 'manager' THEN 1 END) as manager_employees,
      COUNT(CASE WHEN role = 'cashier' THEN 1 END) as cashier_employees
    FROM employees
  `);
  
  // Sync Performance Analytics
  const syncAnalytics = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total_syncs,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
      AVG(CASE WHEN status = 'completed' THEN 
        EXTRACT(EPOCH FROM (completed_at - started_at)) 
      END) as avg_sync_duration_seconds,
      SUM(records_processed) as total_records_processed
    FROM onec_sync_logs
    ${dateFilter.replace('created_at', 'started_at')}
  `);
  
  res.json({
    success: true,
    data: {
      period,
      analytics: {
        products: productAnalytics.rows[0],
        transactions: transactionAnalytics.rows[0],
        inventory: inventoryAnalytics.rows[0],
        branches: branchAnalytics.rows[0],
        employees: employeeAnalytics.rows[0],
        sync_performance: syncAnalytics.rows[0]
      }
    }
  });
}));

// GET /api/1c/analytics/trends - Get time-series trend data
router.get('/trends', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    metric = 'transactions', 
    period = '7d',
    group_by = 'day'
  } = req.query;
  
  let intervalClause = "DATE_TRUNC('day', transaction_date)";
  let periodClause = "WHERE transaction_date >= NOW() - INTERVAL '7 days'";
  
  // Set grouping based on parameter
  switch (group_by) {
    case 'hour':
      intervalClause = "DATE_TRUNC('hour', transaction_date)";
      break;
    case 'week':
      intervalClause = "DATE_TRUNC('week', transaction_date)";
      break;
    case 'month':
      intervalClause = "DATE_TRUNC('month', transaction_date)";
      break;
  }
  
  // Set period based on parameter
  switch (period) {
    case '1d':
      periodClause = "WHERE transaction_date >= NOW() - INTERVAL '1 day'";
      break;
    case '30d':
      periodClause = "WHERE transaction_date >= NOW() - INTERVAL '30 days'";
      break;
    case '90d':
      periodClause = "WHERE transaction_date >= NOW() - INTERVAL '90 days'";
      break;
    case '1y':
      periodClause = "WHERE transaction_date >= NOW() - INTERVAL '1 year'";
      break;
  }
  
  let query = '';
  
  switch (metric) {
    case 'transactions':
      query = `
        SELECT 
          ${intervalClause} as period,
          COUNT(*) as count,
          SUM(total_amount) as total_amount,
          AVG(total_amount) as avg_amount,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM transactions
        ${periodClause}
        GROUP BY ${intervalClause}
        ORDER BY period ASC
      `;
      break;
      
    case 'products':
      query = `
        SELECT 
          ${intervalClause.replace('transaction_date', 'created_at')} as period,
          COUNT(*) as count,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
          AVG(price) as avg_price
        FROM products
        ${periodClause.replace('transaction_date', 'created_at')}
        GROUP BY ${intervalClause.replace('transaction_date', 'created_at')}
        ORDER BY period ASC
      `;
      break;
      
    case 'sync_operations':
      query = `
        SELECT 
          ${intervalClause.replace('transaction_date', 'started_at')} as period,
          COUNT(*) as total_syncs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
          SUM(records_processed) as records_processed,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
        FROM onec_sync_logs
        ${periodClause.replace('transaction_date', 'started_at')}
        GROUP BY ${intervalClause.replace('transaction_date', 'started_at')}
        ORDER BY period ASC
      `;
      break;
      
    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid metric. Available: transactions, products, sync_operations'
      });
  }
  
  const result = await DatabaseManager.query(query);
  
  res.json({
    success: true,
    data: {
      metric,
      period,
      group_by,
      trends: result.rows
    }
  });
}));

// GET /api/1c/analytics/performance - Get system performance metrics
router.get('/performance', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  // Database performance metrics
  const dbPerformance = await DatabaseManager.query(`
    SELECT 
      schemaname,
      tablename,
      n_tup_ins as inserts,
      n_tup_upd as updates,
      n_tup_del as deletes,
      n_live_tup as live_tuples,
      n_dead_tup as dead_tuples,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    AND tablename IN ('products', 'transactions', 'inventory', 'employees', 'customers', 'onec_sync_logs')
    ORDER BY n_live_tup DESC
  `);
  
  // API performance metrics (last 24 hours)
  const apiPerformance = await DatabaseManager.query(`
    SELECT 
      sync_type,
      COUNT(*) as request_count,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_response_time,
      MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_response_time,
      MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_response_time,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as error_count,
      ROUND(
        (COUNT(CASE WHEN status = 'completed' THEN 1 END)::decimal / COUNT(*)::decimal) * 100, 
        2
      ) as success_rate
    FROM onec_sync_logs
    WHERE started_at >= NOW() - INTERVAL '24 hours'
    GROUP BY sync_type
    ORDER BY request_count DESC
  `);
  
  // System resource usage simulation (in real implementation, get from system metrics)
  const systemMetrics = {
    cpu_usage_percent: Math.floor(Math.random() * 30) + 10, // 10-40%
    memory_usage_percent: Math.floor(Math.random() * 40) + 30, // 30-70%
    disk_usage_percent: Math.floor(Math.random() * 20) + 50, // 50-70%
    active_connections: Math.floor(Math.random() * 50) + 10, // 10-60
    database_size_mb: Math.floor(Math.random() * 1000) + 500 // 500-1500 MB
  };
  
  // Error rate analysis
  const errorAnalysis = await DatabaseManager.query(`
    SELECT 
      DATE_TRUNC('hour', started_at) as hour,
      COUNT(*) as total_operations,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_operations,
      ROUND(
        (COUNT(CASE WHEN status = 'failed' THEN 1 END)::decimal / COUNT(*)::decimal) * 100, 
        2
      ) as error_rate_percent
    FROM onec_sync_logs
    WHERE started_at >= NOW() - INTERVAL '24 hours'
    GROUP BY DATE_TRUNC('hour', started_at)
    ORDER BY hour DESC
  `);
  
  res.json({
    success: true,
    data: {
      database_performance: dbPerformance.rows,
      api_performance: apiPerformance.rows,
      system_metrics: systemMetrics,
      error_analysis: errorAnalysis.rows,
      timestamp: new Date().toISOString()
    }
  });
}));

// GET /api/1c/analytics/health - Get system health check
router.get('/health', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const healthChecks = [];
  
  // Database connectivity check
  try {
    await DatabaseManager.query('SELECT 1');
    healthChecks.push({
      component: 'database',
      status: 'healthy',
      message: 'Database connection successful',
      response_time_ms: 0 // Would measure actual response time
    });
  } catch (error: any) {
    healthChecks.push({
      component: 'database',
      status: 'unhealthy',
      message: error.message,
      response_time_ms: null
    });
  }
  
  // Check for stuck sync operations
  const stuckSyncs = await DatabaseManager.query(`
    SELECT COUNT(*) as count
    FROM onec_sync_logs
    WHERE status = 'in_progress' 
    AND started_at <= NOW() - INTERVAL '2 hours'
  `);
  
  const stuckCount = parseInt(stuckSyncs.rows[0].count);
  healthChecks.push({
    component: 'sync_operations',
    status: stuckCount > 0 ? 'warning' : 'healthy',
    message: stuckCount > 0 ? `${stuckCount} sync operations appear stuck` : 'All sync operations are healthy',
    stuck_operations: stuckCount
  });
  
  // Check recent error rate
  const recentErrors = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
    FROM onec_sync_logs
    WHERE started_at >= NOW() - INTERVAL '1 hour'
  `);
  
  const errorRate = recentErrors.rows[0].total > 0 ? 
    (parseInt(recentErrors.rows[0].failed) / parseInt(recentErrors.rows[0].total)) * 100 : 0;
  
  healthChecks.push({
    component: 'error_rate',
    status: errorRate > 20 ? 'critical' : errorRate > 10 ? 'warning' : 'healthy',
    message: `Error rate: ${errorRate.toFixed(2)}% in last hour`,
    error_rate_percent: errorRate
  });
  
  // Check branch connectivity (simulate)
  const branchHealth = await DatabaseManager.query(`
    SELECT 
      COUNT(*) as total_branches,
      COUNT(CASE WHEN last_sync_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as recently_synced,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active_branches
    FROM branches
  `);
  
  const branchData = branchHealth.rows[0];
  const branchSyncHealth = parseInt(branchData.recently_synced) / Math.max(parseInt(branchData.active_branches), 1);
  
  healthChecks.push({
    component: 'branch_connectivity',
    status: branchSyncHealth > 0.8 ? 'healthy' : branchSyncHealth > 0.5 ? 'warning' : 'critical',
    message: `${branchData.recently_synced}/${branchData.active_branches} branches synced recently`,
    sync_ratio: branchSyncHealth
  });
  
  // Overall system status
  const statuses = healthChecks.map(check => check.status);
  let overallStatus = 'healthy';
  
  if (statuses.includes('critical')) {
    overallStatus = 'critical';
  } else if (statuses.includes('unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('warning')) {
    overallStatus = 'warning';
  }
  
  res.json({
    success: true,
    data: {
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      health_checks: healthChecks,
      summary: {
        healthy: statuses.filter(s => s === 'healthy').length,
        warning: statuses.filter(s => s === 'warning').length,
        unhealthy: statuses.filter(s => s === 'unhealthy').length,
        critical: statuses.filter(s => s === 'critical').length
      }
    }
  });
}));

// GET /api/1c/analytics/reports - Generate comprehensive reports
router.get('/reports', requirePermission('admin:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    report_type = 'summary',
    start_date,
    end_date,
    branch_id
  } = req.query;
  
  let dateFilter = '';
  const params: any[] = [];
  
  if (start_date) {
    params.push(start_date);
    dateFilter += ` AND transaction_date >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    dateFilter += ` AND transaction_date <= $${params.length}`;
  }
  
  if (branch_id) {
    params.push(branch_id);
    dateFilter += ` AND branch_id = $${params.length}`;
  }
  
  let reportData: any = {};
  
  switch (report_type) {
    case 'summary':
      // Sales summary report
      const salesSummary = await DatabaseManager.query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_transaction_value,
          COUNT(DISTINCT customer_id) as unique_customers,
          COUNT(DISTINCT DATE(transaction_date)) as business_days,
          SUM(total_amount) / NULLIF(COUNT(DISTINCT DATE(transaction_date)), 0) as daily_avg_revenue
        FROM transactions
        WHERE 1=1 ${dateFilter}
      `, params);
      
      reportData.sales_summary = salesSummary.rows[0];
      break;
      
    case 'detailed':
      // Detailed transactions report
      const detailedQuery = `
        SELECT 
          t.id, t.onec_id, t.transaction_date, t.total_amount, t.payment_method, t.status,
          b.name as branch_name, c.name as customer_name, e.name as employee_name,
          COUNT(ti.id) as items_count,
          SUM(ti.quantity) as total_items_quantity
        FROM transactions t
        LEFT JOIN branches b ON t.branch_id = b.id
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN employees e ON t.employee_id = e.id
        LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
        WHERE 1=1 ${dateFilter}
        GROUP BY t.id, b.name, c.name, e.name
        ORDER BY t.transaction_date DESC
        LIMIT 1000
      `;
      
      const detailedResult = await DatabaseManager.query(detailedQuery, params);
      reportData.detailed_transactions = detailedResult.rows;
      break;
      
    case 'inventory':
      // Inventory status report
      const inventoryReport = await DatabaseManager.query(`
        SELECT 
          p.name, p.sku, p.barcode, i.quantity, i.reorder_level, i.cost_price,
          b.name as branch_name,
          CASE 
            WHEN i.quantity <= 0 THEN 'Out of Stock'
            WHEN i.quantity <= i.reorder_level THEN 'Low Stock'
            ELSE 'In Stock'
          END as stock_status,
          (i.quantity * i.cost_price) as inventory_value
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN branches b ON i.branch_id = b.id
        ${branch_id ? 'WHERE i.branch_id = $1' : ''}
        ORDER BY stock_status, p.name
      `, branch_id ? [branch_id] : []);
      
      reportData.inventory_report = inventoryReport.rows;
      break;
      
    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid report type. Available: summary, detailed, inventory'
      });
  }
  
  res.json({
    success: true,
    data: {
      report_type,
      parameters: {
        start_date,
        end_date,
        branch_id
      },
      generated_at: new Date().toISOString(),
      ...reportData
    }
  });
}));

export default router;
