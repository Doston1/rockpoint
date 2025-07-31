import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const reportParamsSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  branch_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
});

// GET /api/reports/sales - Sales report
router.get('/sales', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, branch_id } = reportParamsSchema.parse(req.query);
  
  let query = `
    SELECT 
      DATE(t.created_at) as date,
      COUNT(t.id) as transaction_count,
      SUM(t.total_amount) as total_sales,
      SUM(t.tax_amount) as total_tax,
      AVG(t.total_amount) as average_sale,
      b.name as branch_name
    FROM transactions t
    LEFT JOIN branches b ON t.branch_id = b.id
    WHERE t.status = 'completed'
    AND DATE(t.created_at) BETWEEN $1 AND $2
  `;
  
  const params = [start_date, end_date];
  
  if (branch_id) {
    query += ` AND t.branch_id = $3`;
    params.push(branch_id);
  }
  
  query += ` GROUP BY DATE(t.created_at), b.name ORDER BY date DESC`;
  
  const result = await DatabaseManager.query(query, params);
  
  // Calculate totals
  const totals = result.rows.reduce((acc: { 
    total_transactions: number; 
    total_sales: number; 
    total_tax: number; 
  }, row: any) => ({
    total_transactions: acc.total_transactions + parseInt(row.transaction_count),
    total_sales: acc.total_sales + parseFloat(row.total_sales || '0'),
    total_tax: acc.total_tax + parseFloat(row.total_tax || '0'),
  }), { total_transactions: 0, total_sales: 0, total_tax: 0 });
  
  res.json({
    success: true,
    data: {
      sales_report: result.rows,
      summary: {
        ...totals,
        average_daily_sales: result.rows.length > 0 ? totals.total_sales / result.rows.length : 0,
        period: { start_date, end_date }
      }
    }
  });
}));

// GET /api/reports/products - Product performance report
router.get('/products', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, branch_id } = reportParamsSchema.parse(req.query);
  
  let query = `
    SELECT 
      p.id, p.name, p.sku, p.price,
      SUM(ti.quantity) as total_quantity_sold,
      SUM(ti.total_amount) as total_revenue,
      COUNT(DISTINCT t.id) as transaction_count,
      c.name as category_name
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN products p ON ti.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE t.status = 'completed'
    AND DATE(t.created_at) BETWEEN $1 AND $2
  `;
  
  const params = [start_date, end_date];
  
  if (branch_id) {
    query += ` AND t.branch_id = $3`;
    params.push(branch_id);
  }
  
  query += `
    GROUP BY p.id, p.name, p.sku, p.price, c.name
    ORDER BY total_revenue DESC
  `;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      product_performance: result.rows.map((row: any) => ({
        ...row,
        total_quantity_sold: parseInt(row.total_quantity_sold),
        total_revenue: parseFloat(row.total_revenue),
        transaction_count: parseInt(row.transaction_count),
        average_price: parseFloat(row.total_revenue) / parseInt(row.total_quantity_sold)
      }))
    }
  });
}));

// GET /api/reports/employees - Employee performance report
router.get('/employees', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, branch_id } = reportParamsSchema.parse(req.query);
  
  let query = `
    SELECT 
      e.id, e.name, e.role,
      COUNT(t.id) as transaction_count,
      SUM(t.total_amount) as total_sales,
      AVG(t.total_amount) as average_sale,
      b.name as branch_name
    FROM transactions t
    JOIN employees e ON t.employee_id = e.id
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE t.status = 'completed'
    AND DATE(t.created_at) BETWEEN $1 AND $2
  `;
  
  const params = [start_date, end_date];
  
  if (branch_id) {
    query += ` AND e.branch_id = $3`;
    params.push(branch_id);
  }
  
  query += `
    GROUP BY e.id, e.name, e.role, b.name
    ORDER BY total_sales DESC
  `;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      employee_performance: result.rows.map((row: any) => ({
        ...row,
        transaction_count: parseInt(row.transaction_count),
        total_sales: parseFloat(row.total_sales || '0'),
        average_sale: parseFloat(row.average_sale || '0')
      }))
    }
  });
}));

// GET /api/reports/inventory - Inventory report
router.get('/inventory', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id } = req.query;
  
  let query = `
    SELECT 
      p.id, p.name, p.sku, p.price,
      i.quantity, i.min_stock, i.max_stock,
      i.quantity * p.cost as inventory_value,
      CASE 
        WHEN i.quantity = 0 THEN 'out_of_stock'
        WHEN i.quantity <= i.min_stock THEN 'low_stock'
        ELSE 'in_stock'
      END as stock_status,
      b.name as branch_name,
      c.name as category_name
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN branches b ON i.branch_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
  `;
  
  const params: any[] = [];
  
  if (branch_id) {
    query += ` AND i.branch_id = $1`;
    params.push(branch_id);
  }
  
  query += ` ORDER BY p.name ASC`;
  
  const result = await DatabaseManager.query(query, params);
  
  // Calculate summary statistics
  const summary = result.rows.reduce((acc: {
    total_items: number;
    total_value: number;
    out_of_stock_count: number;
    low_stock_count: number;
    in_stock_count: number;
  }, row: any) => {
    acc.total_items++;
    acc.total_value += parseFloat(row.inventory_value || '0');
    
    switch (row.stock_status) {
      case 'out_of_stock':
        acc.out_of_stock_count++;
        break;
      case 'low_stock':
        acc.low_stock_count++;
        break;
      case 'in_stock':
        acc.in_stock_count++;
        break;
    }
    
    return acc;
  }, {
    total_items: 0,
    total_value: 0,
    out_of_stock_count: 0,
    low_stock_count: 0,
    in_stock_count: 0
  });
  
  res.json({
    success: true,
    data: {
      inventory_report: result.rows,
      summary
    }
  });
}));

// GET /api/reports/financial - Financial summary report
router.get('/financial', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, branch_id } = reportParamsSchema.parse(req.query);
  
  // Sales data
  let salesQuery = `
    SELECT 
      SUM(total_amount) as total_revenue,
      SUM(tax_amount) as total_tax,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE status = 'completed'
    AND DATE(created_at) BETWEEN $1 AND $2
  `;
  
  const params = [start_date, end_date];
  
  if (branch_id) {
    salesQuery += ` AND branch_id = $3`;
    params.push(branch_id);
  }
  
  const salesResult = await DatabaseManager.query(salesQuery, params);
  
  // Payment method breakdown
  let paymentQuery = `
    SELECT 
      payment_method,
      SUM(total_amount) as amount,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE status = 'completed'
    AND DATE(created_at) BETWEEN $1 AND $2
  `;
  
  if (branch_id) {
    paymentQuery += ` AND branch_id = $3`;
  }
  
  paymentQuery += ` GROUP BY payment_method`;
  
  const paymentResult = await DatabaseManager.query(paymentQuery, params);
  
  // Hourly sales pattern
  let hourlyQuery = `
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      SUM(total_amount) as total_sales,
      COUNT(*) as transaction_count
    FROM transactions
    WHERE status = 'completed'
    AND DATE(created_at) BETWEEN $1 AND $2
  `;
  
  if (branch_id) {
    hourlyQuery += ` AND branch_id = $3`;
  }
  
  hourlyQuery += ` GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY hour`;
  
  const hourlyResult = await DatabaseManager.query(hourlyQuery, params);
  
  res.json({
    success: true,
    data: {
      financial_summary: {
        total_revenue: parseFloat(salesResult.rows[0]?.total_revenue || '0'),
        total_tax: parseFloat(salesResult.rows[0]?.total_tax || '0'),
        transaction_count: parseInt(salesResult.rows[0]?.transaction_count || '0'),
      },
      payment_methods: paymentResult.rows.map((row: any) => ({
        method: row.payment_method,
        amount: parseFloat(row.amount),
        transaction_count: parseInt(row.transaction_count)
      })),
      hourly_sales: hourlyResult.rows.map((row: any) => ({
        hour: parseInt(row.hour),
        total_sales: parseFloat(row.total_sales),
        transaction_count: parseInt(row.transaction_count)
      })),
      period: { start_date, end_date }
    }
  });
}));

// GET /api/reports/branches - Branch comparison report
router.get('/branches', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date } = reportParamsSchema.parse(req.query);
  
  const query = `
    SELECT 
      b.id, b.name, b.code,
      COUNT(t.id) as transaction_count,
      SUM(t.total_amount) as total_sales,
      AVG(t.total_amount) as average_sale,
      COUNT(DISTINCT e.id) as employee_count
    FROM branches b
    LEFT JOIN transactions t ON b.id = t.branch_id 
      AND t.status = 'completed'
      AND DATE(t.created_at) BETWEEN $1 AND $2
    LEFT JOIN employees e ON b.id = e.branch_id AND e.status = 'active'
    WHERE b.is_active = true
    GROUP BY b.id, b.name, b.code
    ORDER BY total_sales DESC NULLS LAST
  `;
  
  const result = await DatabaseManager.query(query, [start_date, end_date]);
  
  res.json({
    success: true,
    data: {
      branch_comparison: result.rows.map((row: any) => ({
        ...row,
        transaction_count: parseInt(row.transaction_count || '0'),
        total_sales: parseFloat(row.total_sales || '0'),
        average_sale: parseFloat(row.average_sale || '0'),
        employee_count: parseInt(row.employee_count || '0')
      })),
      period: { start_date, end_date }
    }
  });
}));

// GET /api/reports/export/:type - Export report data
router.get('/export/:type', asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.params;
  const queryParams = reportParamsSchema.parse(req.query);
  
  // This is a placeholder for export functionality
  // In a real implementation, you would generate CSV, Excel, or PDF files
  
  res.json({
    success: true,
    message: `Export functionality for ${type} reports will be implemented`,
    data: {
      export_type: type,
      parameters: queryParams,
      // In real implementation, return download URL or file data
    }
  });
}));

export default router;
