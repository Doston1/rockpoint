// Type definitions for RockPoint Branch Core

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'supervisor';
  status: 'active' | 'inactive' | 'suspended';
  hire_date?: Date;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  cost: number;
  quantity_in_stock: number;
  low_stock_threshold: number;
  category?: string;
  brand?: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  transaction_id: string;
  terminal_id: string;
  employee_id: string;
  customer_id?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'pending' | 'completed' | 'voided' | 'refunded';
  created_at: Date;
  updated_at: Date;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: Date;
}

export interface Payment {
  id: string;
  transaction_id: string;
  method: 'cash' | 'card' | 'digital_wallet' | 'store_credit';
  amount: number;
  reference_number?: string;
  processed_at: Date;
}

export interface Customer {
  id: string;
  customer_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  membership_level?: string;
  created_at: Date;
  updated_at: Date;
}

export interface StockMovement {
  id: string;
  product_id: string;
  old_quantity: number;
  new_quantity: number;
  change_quantity: number;
  operation: 'add' | 'subtract' | 'set' | 'sale' | 'return' | 'adjustment';
  reason?: string;
  employee_id?: string;
  created_at: Date;
}

export interface EmployeeTimeLog {
  id: string;
  employee_id: string;
  terminal_id?: string;
  clock_in: Date;
  clock_out?: Date;
  break_start?: Date;
  break_end?: Date;
  total_hours?: number;
  overtime_hours?: number;
  created_at: Date;
}

export interface SyncLog {
  id: string;
  sync_type: 'full' | 'incremental' | 'transactions-only';
  status: 'in_progress' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  records_synced?: number;
  error_message?: string;
  cloud_sync_id?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket message types (re-export from services)
export interface PosTerminal {
  id: string;
  name: string;
  ipAddress: string;
  status: 'online' | 'offline' | 'idle';
  connectedAt: Date;
  lastActivity: Date;
  userId?: string;
  userRole?: string;
}

export interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
  terminalId?: string;
}

// Configuration types
export interface BranchConfig {
  branchId: string;
  branchName: string;
  branchType: 'supermarket' | 'gym' | 'play_center';
  timezone: string;
  currency: string;
  taxRate?: number;
  address?: string;
  phone?: string;
  manager?: string;
}

// Report types
export interface DailySalesReport {
  date: string;
  transaction_count: number;
  total_sales: number;
  total_tax: number;
  average_transaction: number;
  voided_count: number;
  voided_amount: number;
}

export interface PaymentMethodSummary {
  method: string;
  count: number;
  total_amount: number;
}

export interface HourlyBreakdown {
  hour: number;
  transaction_count: number;
  total_sales: number;
}

export interface TopSellingProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity_sold: number;
  total_revenue: number;
  transaction_count: number;
  avg_quantity_per_transaction: number;
}

export interface InventoryStatus {
  total_products: number;
  out_of_stock: number;
  low_stock: number;
  total_inventory_value: number;
}

export interface EmployeePerformance {
  id: string;
  name: string;
  employee_id: string;
  role: string;
  transaction_count: number;
  total_sales: number;
  average_transaction: number;
  hours_worked: number;
  sales_per_hour: number;
}
