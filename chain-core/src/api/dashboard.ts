import { Request, Response, Router } from 'express';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/dashboard/overview - Get dashboard overview data
router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id } = req.query;
  
  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  
  // Today's sales
  let todaySalesQuery = `
    SELECT 
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as total_sales,
      COALESCE(AVG(total_amount), 0) as average_sale
    FROM transactions
    WHERE status = 'completed'
    AND DATE(created_at) = $1
  `;
  
  const params = [today];
  let paramIndex = 2;
  
  if (branch_id) {
    todaySalesQuery += ` AND branch_id = $${paramIndex}`;
    params.push(branch_id as string);
    paramIndex++;
  }
  
  const todaySalesResult = await DatabaseManager.query(todaySalesQuery, params);
  
  // This month's sales
  let monthSalesQuery = `
    SELECT 
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as total_sales
    FROM transactions
    WHERE status = 'completed'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $1::date)
  `;
  
  const monthParams = [today];
  let monthParamIndex = 2;
  
  if (branch_id) {
    monthSalesQuery += ` AND branch_id = $${monthParamIndex}`;
    monthParams.push(branch_id as string);
    monthParamIndex++;
  }
  
  const monthSalesResult = await DatabaseManager.query(monthSalesQuery, monthParams);
  
  // Active employees count
  let employeeQuery = `
    SELECT COUNT(*) as active_employees
    FROM employees
    WHERE status = 'active'
  `;
  
  if (branch_id) {
    employeeQuery += ` AND branch_id = $1`;
    const employeeResult = await DatabaseManager.query(employeeQuery, [branch_id]);
  } else {
    var employeeResult = await DatabaseManager.query(employeeQuery);
  }
  
  // Low stock items
  let lowStockQuery = `
    SELECT COUNT(*) as low_stock_items
    FROM branch_inventory bi
    JOIN products p ON bi.product_id = p.id
    WHERE bi.quantity_in_stock <= bi.min_stock_level
    AND p.is_active = true
  `;
  
  if (branch_id) {
    lowStockQuery += ` AND bi.branch_id = $1`;
    const lowStockResult = await DatabaseManager.query(lowStockQuery, [branch_id]);
  } else {
    var lowStockResult = await DatabaseManager.query(lowStockQuery);
  }
  
  // Recent transactions
  let recentTransactionsQuery = `
    SELECT 
      t.id, t.total_amount, t.payment_method, t.created_at,
      e.name as employee_name,
      b.name as branch_name
    FROM transactions t
    LEFT JOIN employees e ON t.employee_id = e.id
    LEFT JOIN branches b ON t.branch_id = b.id
    WHERE t.status = 'completed'
  `;
  
  if (branch_id) {
    recentTransactionsQuery += ` AND t.branch_id = $1`;
    recentTransactionsQuery += ` ORDER BY t.created_at DESC LIMIT 10`;
    const recentTransactionsResult = await DatabaseManager.query(recentTransactionsQuery, [branch_id]);
  } else {
    recentTransactionsQuery += ` ORDER BY t.created_at DESC LIMIT 10`;
    var recentTransactionsResult = await DatabaseManager.query(recentTransactionsQuery);
  }
  
  res.json({
    success: true,
    data: {
      today_sales: {
        transaction_count: parseInt(todaySalesResult.rows[0].transaction_count),
        total_sales: parseFloat(todaySalesResult.rows[0].total_sales),
        average_sale: parseFloat(todaySalesResult.rows[0].average_sale)
      },
      month_sales: {
        transaction_count: parseInt(monthSalesResult.rows[0].transaction_count),
        total_sales: parseFloat(monthSalesResult.rows[0].total_sales)
      },
      active_employees: parseInt(employeeResult.rows[0].active_employees),
      low_stock_items: parseInt(lowStockResult.rows[0].low_stock_items),
      recent_transactions: recentTransactionsResult.rows.map((transaction: any) => ({
        id: transaction.id,
        total_amount: parseFloat(transaction.total_amount),
        payment_method: transaction.payment_method,
        created_at: transaction.created_at,
        employee_name: transaction.employee_name,
        branch_name: transaction.branch_name
      }))
    }
  });
}));

// GET /api/dashboard/charts - Get chart data for dashboard
router.get('/charts', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id, period = '7' } = req.query;
  const days = parseInt(period as string) || 7;
  
  // Sales trend for the last N days
  let salesTrendQuery = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as transaction_count,
      COALESCE(SUM(total_amount), 0) as total_sales
    FROM transactions
    WHERE status = 'completed'
    AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (branch_id) {
    salesTrendQuery += ` AND branch_id = $${paramIndex}`;
    params.push(branch_id);
    paramIndex++;
  }
  
  salesTrendQuery += ` GROUP BY DATE(created_at) ORDER BY date ASC`;
  
  const salesTrendResult = await DatabaseManager.query(salesTrendQuery, params);
  
  // Top selling products
  let topProductsQuery = `
    SELECT 
      p.name,
      SUM(ti.quantity) as quantity_sold,
      SUM(ti.total_amount) as revenue
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN products p ON ti.product_id = p.id
    WHERE t.status = 'completed'
    AND t.created_at >= CURRENT_DATE - INTERVAL '${days} days'
  `;
  
  if (branch_id) {
    topProductsQuery += ` AND t.branch_id = $${paramIndex}`;
    params.push(branch_id);
    paramIndex++;
  }
  
  topProductsQuery += `
    GROUP BY p.id, p.name
    ORDER BY quantity_sold DESC
    LIMIT 10
  `;
  
  const topProductsResult = await DatabaseManager.query(topProductsQuery, params);
  
  // Payment method distribution
  let paymentMethodQuery = `
    SELECT 
      payment_method,
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_amount
    FROM transactions
    WHERE status = 'completed'
    AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
  `;
  
  if (branch_id) {
    paymentMethodQuery += ` AND branch_id = $${paramIndex}`;
  }
  
  paymentMethodQuery += ` GROUP BY payment_method`;
  
  const paymentMethodResult = await DatabaseManager.query(paymentMethodQuery, params);
  
  // Hourly sales pattern (for today)
  let hourlySalesQuery = `
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_sales
    FROM transactions
    WHERE status = 'completed'
    AND DATE(created_at) = CURRENT_DATE
  `;
  
  if (branch_id) {
    hourlySalesQuery += ` AND branch_id = $${paramIndex}`;
  }
  
  hourlySalesQuery += ` GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY hour`;
  
  const hourlySalesResult = await DatabaseManager.query(hourlySalesQuery, params);
  
  res.json({
    success: true,
    data: {
      sales_trend: salesTrendResult.rows.map((row: any) => ({
        date: row.date,
        transaction_count: parseInt(row.transaction_count),
        total_sales: parseFloat(row.total_sales)
      })),
      top_products: topProductsResult.rows.map((row: any) => ({
        name: row.name,
        quantity_sold: parseInt(row.quantity_sold),
        revenue: parseFloat(row.revenue)
      })),
      payment_methods: paymentMethodResult.rows.map((row: any) => ({
        method: row.payment_method,
        transaction_count: parseInt(row.transaction_count),
        total_amount: parseFloat(row.total_amount)
      })),
      hourly_sales: hourlySalesResult.rows.map((row: any) => ({
        hour: parseInt(row.hour),
        transaction_count: parseInt(row.transaction_count),
        total_sales: parseFloat(row.total_sales)
      }))
    }
  });
}));

// GET /api/dashboard/alerts - Get dashboard alerts and notifications
router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id } = req.query;
  const alerts: Array<{
    id: string;
    type: 'low_stock' | 'out_of_stock' | 'system' | 'employee' | 'transaction' | 'failed_transaction';
    severity: 'low' | 'medium' | 'high' | 'critical' | 'warning';
    title: string;
    message: string;
    timestamp: string;
    branchId?: string;
    branchName?: string;
    acknowledged: boolean;
    created_at?: string;
  }> = [];
  
  // Low stock alerts
  let lowStockQuery = `
    SELECT 
      p.name as product_name,
      i.quantity,
      i.min_stock,
      b.name as branch_name
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN branches b ON i.branch_id = b.id
    WHERE i.quantity <= i.min_stock
    AND p.is_active = true
  `;
  
  if (branch_id) {
    lowStockQuery += ` AND i.branch_id = $1`;
    lowStockQuery += ` ORDER BY i.quantity ASC LIMIT 10`;
    const lowStockResult = await DatabaseManager.query(lowStockQuery, [branch_id]);
  } else {
    lowStockQuery += ` ORDER BY i.quantity ASC LIMIT 10`;
    var lowStockResult = await DatabaseManager.query(lowStockQuery);
  }
  
  lowStockResult.rows.forEach((item: any) => {
    alerts.push({
      id: `low_stock_${item.product_name}_${Date.now()}`,
      type: 'low_stock',
      severity: item.quantity === 0 ? 'critical' : 'warning',
      title: `Stock Alert: ${item.product_name}`,
      message: `${item.product_name} is ${item.quantity === 0 ? 'out of stock' : 'low in stock'}`,
      timestamp: new Date().toISOString(),
      branchId: item.branch_name ? undefined : undefined,
      branchName: item.branch_name,
      acknowledged: false,
      created_at: new Date().toISOString()
    });
  });
  
  // Recent failed transactions
  let failedTransactionsQuery = `
    SELECT 
      t.id,
      t.total_amount,
      t.created_at,
      e.name as employee_name,
      b.name as branch_name
    FROM transactions t
    LEFT JOIN employees e ON t.employee_id = e.id
    LEFT JOIN branches b ON t.branch_id = b.id
    WHERE t.status = 'failed'
    AND t.created_at >= CURRENT_DATE - INTERVAL '1 day'
  `;
  
  if (branch_id) {
    failedTransactionsQuery += ` AND t.branch_id = $1`;
    failedTransactionsQuery += ` ORDER BY t.created_at DESC LIMIT 5`;
    const failedTransactionsResult = await DatabaseManager.query(failedTransactionsQuery, [branch_id]);
  } else {
    failedTransactionsQuery += ` ORDER BY t.created_at DESC LIMIT 5`;
    var failedTransactionsResult = await DatabaseManager.query(failedTransactionsQuery);
  }
  
  failedTransactionsResult.rows.forEach((transaction: any) => {
    alerts.push({
      id: `failed_transaction_${transaction.id}`,
      type: 'failed_transaction',
      severity: 'warning',
      title: `Failed Transaction`,
      message: `Failed transaction of $${transaction.total_amount}`,
      timestamp: transaction.created_at,
      branchId: undefined,
      branchName: transaction.branch_name,
      acknowledged: false,
      created_at: transaction.created_at
    });
  });
  
  // Sort alerts by severity and date
  alerts.sort((a, b) => {
    const severityOrder = { critical: 3, warning: 2, info: 1 };
    const severityDiff = (severityOrder[b.severity as keyof typeof severityOrder] || 0) - 
                        (severityOrder[a.severity as keyof typeof severityOrder] || 0);
    if (severityDiff !== 0) return severityDiff;
    
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  res.json({
    success: true,
    data: {
      alerts: alerts.slice(0, 20) // Limit to 20 most important alerts
    }
  });
}));

// GET /api/dashboard/stats - Get quick stats for dashboard widgets
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id } = req.query;
  
  // Total branches (only for chain-wide view)
  let branchCountQuery = `SELECT COUNT(*) as total_branches FROM branches WHERE is_active = true`;
  const branchCountResult = branch_id 
    ? { rows: [{ total_branches: 1 }] }
    : await DatabaseManager.query(branchCountQuery);
  
  // Total products
  let productCountQuery = `SELECT COUNT(*) as total_products FROM products WHERE is_active = true`;
  const productCountResult = await DatabaseManager.query(productCountQuery);
  
  // Total employees
  let employeeCountQuery = `SELECT COUNT(*) as total_employees FROM employees WHERE status = 'active'`;
  if (branch_id) {
    employeeCountQuery += ` AND branch_id = $1`;
    var employeeCountResult = await DatabaseManager.query(employeeCountQuery, [branch_id]);
  } else {
    var employeeCountResult = await DatabaseManager.query(employeeCountQuery);
  }
  
  // Total transactions today
  let transactionCountQuery = `
    SELECT COUNT(*) as today_transactions 
    FROM transactions 
    WHERE status = 'completed' 
    AND DATE(created_at) = CURRENT_DATE
  `;
  if (branch_id) {
    transactionCountQuery += ` AND branch_id = $1`;
    var transactionCountResult = await DatabaseManager.query(transactionCountQuery, [branch_id]);
  } else {
    var transactionCountResult = await DatabaseManager.query(transactionCountQuery);
  }

  // Today's sales
  let todaySalesQuery = `
    SELECT COALESCE(SUM(total_amount), 0) as today_sales 
    FROM transactions 
    WHERE status = 'completed' 
    AND DATE(created_at) = CURRENT_DATE
  `;
  if (branch_id) {
    todaySalesQuery += ` AND branch_id = $1`;
    var todaySalesResult = await DatabaseManager.query(todaySalesQuery, [branch_id]);
  } else {
    var todaySalesResult = await DatabaseManager.query(todaySalesQuery);
  }

  // This month's sales
  let monthSalesQuery = `
    SELECT COALESCE(SUM(total_amount), 0) as month_sales 
    FROM transactions 
    WHERE status = 'completed' 
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
  `;
  if (branch_id) {
    monthSalesQuery += ` AND branch_id = $1`;
    var monthSalesResult = await DatabaseManager.query(monthSalesQuery, [branch_id]);
  } else {
    var monthSalesResult = await DatabaseManager.query(monthSalesQuery);
  }

  // Low stock items count
  let lowStockQuery = `
    SELECT COUNT(*) as low_stock_items 
    FROM branch_inventory bi 
    JOIN products p ON bi.product_id = p.id 
    WHERE bi.quantity_in_stock <= bi.min_stock_level 
    AND p.is_active = true
  `;
  if (branch_id) {
    lowStockQuery += ` AND bi.branch_id = $1`;
    var lowStockResult = await DatabaseManager.query(lowStockQuery, [branch_id]);
  } else {
    var lowStockResult = await DatabaseManager.query(lowStockQuery);
  }
  
  res.json({
    success: true,
    data: {
      totalBranches: parseInt(branchCountResult.rows[0].total_branches),
      totalProducts: parseInt(productCountResult.rows[0].total_products),
      totalEmployees: parseInt(employeeCountResult.rows[0].total_employees),
      todayTransactions: parseInt(transactionCountResult.rows[0].today_transactions),
      todaySales: parseFloat(todaySalesResult.rows[0].today_sales || '0'),
      monthSales: parseFloat(monthSalesResult.rows[0].month_sales || '0'),
      lowStockItems: parseInt(lowStockResult.rows[0].low_stock_items || '0')
    }
  });
}));

// GET /api/dashboard/comprehensive - Get comprehensive dashboard statistics with more details
router.get('/comprehensive', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id } = req.query;
  
  try {
    // Run all queries in parallel for better performance
    const queries: string[] = [];
    const queryParams: any[][] = [];

    // 1. Branch count
    if (!branch_id) {
      queries.push('SELECT COUNT(*) as total_branches FROM branches WHERE is_active = true');
      queryParams.push([]);
    }

    // 2. Product count
    queries.push('SELECT COUNT(*) as total_products FROM products WHERE is_active = true');
    queryParams.push([]);

    // 3. Employee count
    let employeeQuery = 'SELECT COUNT(*) as total_employees FROM employees WHERE status = \'active\'';
    if (branch_id) {
      employeeQuery += ' AND branch_id = $1';
      queries.push(employeeQuery);
      queryParams.push([branch_id]);
    } else {
      queries.push(employeeQuery);
      queryParams.push([]);
    }

    // 4. Today transactions count
    let todayTxnCountQuery = 'SELECT COUNT(*) as today_transactions FROM transactions WHERE status = \'completed\' AND DATE(created_at) = CURRENT_DATE';
    if (branch_id) {
      todayTxnCountQuery += ' AND branch_id = $1';
      queries.push(todayTxnCountQuery);
      queryParams.push([branch_id]);
    } else {
      queries.push(todayTxnCountQuery);
      queryParams.push([]);
    }

    // 5. Today sales amount
    let todaySalesQuery = 'SELECT COALESCE(SUM(total_amount), 0) as today_sales FROM transactions WHERE status = \'completed\' AND DATE(created_at) = CURRENT_DATE';
    if (branch_id) {
      todaySalesQuery += ' AND branch_id = $1';
      queries.push(todaySalesQuery);
      queryParams.push([branch_id]);
    } else {
      queries.push(todaySalesQuery);
      queryParams.push([]);
    }

    // 6. Month sales amount
    let monthSalesQuery = 'SELECT COALESCE(SUM(total_amount), 0) as month_sales FROM transactions WHERE status = \'completed\' AND DATE_TRUNC(\'month\', created_at) = DATE_TRUNC(\'month\', CURRENT_DATE)';
    if (branch_id) {
      monthSalesQuery += ' AND branch_id = $1';
      queries.push(monthSalesQuery);
      queryParams.push([branch_id]);
    } else {
      queries.push(monthSalesQuery);
      queryParams.push([]);
    }

    // 7. Low stock items
    let lowStockQuery = 'SELECT COUNT(*) as low_stock_items FROM branch_inventory bi JOIN products p ON bi.product_id = p.id WHERE bi.quantity_in_stock <= bi.min_stock_level AND p.is_active = true';
    if (branch_id) {
      lowStockQuery += ' AND bi.branch_id = $1';
      queries.push(lowStockQuery);
      queryParams.push([branch_id]);
    } else {
      queries.push(lowStockQuery);
      queryParams.push([]);
    }

    // 8. Recent transactions for activity feed
    let recentTxnQuery = `
      SELECT t.id, t.total_amount, t.payment_method, t.created_at,
             e.name as employee_name, b.name as branch_name
      FROM transactions t
      LEFT JOIN employees e ON t.employee_id = e.id
      LEFT JOIN branches b ON t.branch_id = b.id
      WHERE t.status = 'completed'
    `;
    if (branch_id) {
      recentTxnQuery += ' AND t.branch_id = $1';
      queries.push(recentTxnQuery + ' ORDER BY t.created_at DESC LIMIT 10');
      queryParams.push([branch_id]);
    } else {
      queries.push(recentTxnQuery + ' ORDER BY t.created_at DESC LIMIT 10');
      queryParams.push([]);
    }

    // Execute all queries
    const results = await Promise.all(
      queries.map((query, index) => DatabaseManager.query(query, queryParams[index]))
    );

    let resultIndex = 0;
    const data: any = {};

    // Parse results
    if (!branch_id) {
      data.totalBranches = parseInt(results[resultIndex++].rows[0].total_branches);
    } else {
      data.totalBranches = 1;
    }

    data.totalProducts = parseInt(results[resultIndex++].rows[0].total_products);
    data.totalEmployees = parseInt(results[resultIndex++].rows[0].total_employees);
    data.todayTransactions = parseInt(results[resultIndex++].rows[0].today_transactions);
    data.todaySales = parseFloat(results[resultIndex++].rows[0].today_sales || '0');
    data.monthSales = parseFloat(results[resultIndex++].rows[0].month_sales || '0');
    data.lowStockItems = parseInt(results[resultIndex++].rows[0].low_stock_items || '0');
    
    // Recent transactions
    data.recentTransactions = results[resultIndex++].rows.map((transaction: any) => ({
      id: transaction.id,
      total_amount: parseFloat(transaction.total_amount),
      payment_method: transaction.payment_method,
      created_at: transaction.created_at,
      employee_name: transaction.employee_name,
      branch_name: transaction.branch_name
    }));

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error fetching comprehensive dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comprehensive dashboard statistics'
    });
  }
}));

export default router;
