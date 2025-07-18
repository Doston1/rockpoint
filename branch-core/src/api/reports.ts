import { DatabaseManager } from '@/database/manager';
import { asyncHandler } from '@/middleware/errorHandler';
import { Request, Response, Router } from 'express';

const router = Router();

// GET /api/reports/sales/daily
router.get('/sales/daily', asyncHandler(async (req: Request, res: Response) => {
  const date = req.query.date as string || new Date().toISOString().split('T')[0];

  const dailySalesQuery = `
    SELECT 
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_sales,
      SUM(tax_amount) as total_tax,
      AVG(total_amount) as average_transaction,
      COUNT(CASE WHEN status = 'voided' THEN 1 END) as voided_count,
      SUM(CASE WHEN status = 'voided' THEN total_amount ELSE 0 END) as voided_amount
    FROM transactions
    WHERE DATE(created_at) = $1
  `;

  const paymentMethodsQuery = `
    SELECT 
      p.method,
      COUNT(*) as count,
      SUM(p.amount) as total_amount
    FROM payments p
    JOIN transactions t ON p.transaction_id = t.id
    WHERE DATE(t.created_at) = $1 AND t.status = 'completed'
    GROUP BY p.method
    ORDER BY total_amount DESC
  `;

  const hourlyBreakdownQuery = `
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_sales
    FROM transactions
    WHERE DATE(created_at) = $1 AND status = 'completed'
    GROUP BY EXTRACT(HOUR FROM created_at)
    ORDER BY hour
  `;

  const [salesResult, paymentsResult, hourlyResult] = await Promise.all([
    DatabaseManager.query(dailySalesQuery, [date]),
    DatabaseManager.query(paymentMethodsQuery, [date]),
    DatabaseManager.query(hourlyBreakdownQuery, [date])
  ]);

  res.json({
    success: true,
    data: {
      date,
      summary: salesResult.rows[0],
      paymentMethods: paymentsResult.rows,
      hourlyBreakdown: hourlyResult.rows
    }
  });
}));

// GET /api/reports/sales/period
router.get('/sales/period', asyncHandler(async (req: Request, res: Response) => {
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: 'Start date and end date are required'
    });
  }

  const periodSalesQuery = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as transaction_count,
      SUM(total_amount) as total_sales,
      SUM(tax_amount) as total_tax,
      AVG(total_amount) as average_transaction
    FROM transactions
    WHERE DATE(created_at) BETWEEN $1 AND $2 AND status = 'completed'
    GROUP BY DATE(created_at)
    ORDER BY date
  `;

  const result = await DatabaseManager.query(periodSalesQuery, [startDate, endDate]);

  const totalSales = result.rows.reduce((sum: number, day: any) => sum + parseFloat(day.total_sales || 0), 0);
  const totalTransactions = result.rows.reduce((sum: number, day: any) => sum + parseInt(day.transaction_count || 0), 0);

  res.json({
    success: true,
    data: {
      period: { startDate, endDate },
      dailyBreakdown: result.rows,
      summary: {
        totalSales,
        totalTransactions,
        averageDaily: result.rows.length > 0 ? totalSales / result.rows.length : 0
      }
    }
  });
}));

// GET /api/reports/products/top-selling
router.get('/products/top-selling', asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;
  const limit = parseInt(req.query.limit as string) || 20;

  const topProductsQuery = `
    SELECT 
      p.id, p.name, p.category, p.price,
      SUM(ti.quantity) as quantity_sold,
      SUM(ti.total_price) as total_revenue,
      COUNT(DISTINCT ti.transaction_id) as transaction_count,
      AVG(ti.quantity) as avg_quantity_per_transaction
    FROM products p
    JOIN transaction_items ti ON p.id = ti.product_id
    JOIN transactions t ON ti.transaction_id = t.id
    WHERE 
      t.created_at >= NOW() - INTERVAL '${days} days'
      AND t.status = 'completed'
    GROUP BY p.id, p.name, p.category, p.price
    ORDER BY quantity_sold DESC
    LIMIT $1
  `;

  const result = await DatabaseManager.query(topProductsQuery, [limit]);

  res.json({
    success: true,
    data: {
      period: `${days} days`,
      products: result.rows
    }
  });
}));

// GET /api/reports/inventory/status
router.get('/inventory/status', asyncHandler(async (req: Request, res: Response) => {
  const lowStockThreshold = parseInt(req.query.threshold as string) || 10;

  const inventoryQuery = `
    SELECT 
      COUNT(*) as total_products,
      COUNT(CASE WHEN quantity_in_stock = 0 THEN 1 END) as out_of_stock,
      COUNT(CASE WHEN quantity_in_stock <= $1 AND quantity_in_stock > 0 THEN 1 END) as low_stock,
      SUM(quantity_in_stock * cost) as total_inventory_value
    FROM products
    WHERE is_active = true
  `;

  const lowStockProductsQuery = `
    SELECT id, name, barcode, quantity_in_stock, cost, price
    FROM products
    WHERE quantity_in_stock <= $1 AND is_active = true
    ORDER BY quantity_in_stock ASC
    LIMIT 20
  `;

  const categoryBreakdownQuery = `
    SELECT 
      category,
      COUNT(*) as product_count,
      SUM(quantity_in_stock) as total_stock,
      SUM(quantity_in_stock * cost) as category_value
    FROM products
    WHERE is_active = true
    GROUP BY category
    ORDER BY category_value DESC
  `;

  const [inventoryResult, lowStockResult, categoryResult] = await Promise.all([
    DatabaseManager.query(inventoryQuery, [lowStockThreshold]),
    DatabaseManager.query(lowStockProductsQuery, [lowStockThreshold]),
    DatabaseManager.query(categoryBreakdownQuery)
  ]);

  res.json({
    success: true,
    data: {
      summary: inventoryResult.rows[0],
      lowStockProducts: lowStockResult.rows,
      categoryBreakdown: categoryResult.rows,
      threshold: lowStockThreshold
    }
  });
}));

// GET /api/reports/employees/performance
router.get('/employees/performance', asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 7;

  const performanceQuery = `
    SELECT 
      e.id, e.name, e.employee_id, e.role,
      COUNT(t.id) as transaction_count,
      SUM(t.total_amount) as total_sales,
      AVG(t.total_amount) as average_transaction,
      SUM(EXTRACT(EPOCH FROM (etl.clock_out - etl.clock_in))/3600) as hours_worked
    FROM employees e
    LEFT JOIN transactions t ON e.employee_id = t.employee_id 
      AND t.created_at >= NOW() - INTERVAL '${days} days'
      AND t.status = 'completed'
    LEFT JOIN employee_time_logs etl ON e.id = etl.employee_id
      AND etl.clock_in >= NOW() - INTERVAL '${days} days'
      AND etl.clock_out IS NOT NULL
    WHERE e.status = 'active'
    GROUP BY e.id, e.name, e.employee_id, e.role
    ORDER BY total_sales DESC NULLS LAST
  `;

  const result = await DatabaseManager.query(performanceQuery);

  res.json({
    success: true,
    data: {
      period: `${days} days`,
      employees: result.rows.map((emp: any) => ({
        ...emp,
        hours_worked: emp.hours_worked ? Math.round(emp.hours_worked * 100) / 100 : 0,
        sales_per_hour: emp.hours_worked && emp.total_sales 
          ? Math.round((emp.total_sales / emp.hours_worked) * 100) / 100 
          : 0
      }))
    }
  });
}));

export default router;
