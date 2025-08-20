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
  method: 'cash' | 'card' | 'digital_wallet' | 'store_credit' | 'fastpay';
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

// =================================================================
// UZUM BANK FASTPAY TYPES
// =================================================================

export interface FastPayTransaction {
  id: string;
  transaction_id: string;
  order_id: string;
  pos_transaction_id?: string;
  amount: number; // in tiyin
  amount_uzs: number; // in UZS
  cashbox_code: string;
  otp_data: string;
  service_id: number;
  payment_id?: string;
  request_payload: any;
  response_payload?: any;
  authorization_header: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'reversed';
  error_code: number;
  error_message?: string;
  initiated_at: Date;
  completed_at?: Date;
  employee_id: string;
  terminal_id: string;
  client_phone_number?: string;
  operation_time?: string;
  retry_count: number;
  timeout_occurred: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FastPayConfig {
  merchant_service_user_id: string;
  secret_key: string;
  service_id: number;
  api_base_url: string;
  request_timeout_ms: number;
  cashbox_code_prefix: string;
  max_retry_attempts: number;
  enable_logging: boolean;
}

export interface FastPayRequest {
  amount: number; // in tiyin
  cashbox_code: string;
  otp_data: string;
  order_id: string;
  transaction_id: string;
  service_id: number;
}

export interface FastPayResponse {
  payment_id?: string;
  payment_status?: string;
  error_code: number;
  error_message?: string;
  operation_time?: string;
  client_phone_number?: string;
}

export interface FastPayFiscalizationRequest {
  payment_id: string;
  service_id: number;
  fiscal_url: string;
}

export interface FastPayReversalRequest {
  service_id: number;
  payment_id: string;
}

export interface FastPayStatusRequest {
  payment_id: string;
  service_id: number;
}

export interface FastPayCreatePaymentRequest {
  amount_uzs: number;
  otp_data: string;
  employee_id: string;
  terminal_id: string;
  pos_transaction_id?: string;
}

export interface FastPayCreatePaymentResponse {
  success: boolean;
  data?: {
    fastpay_transaction_id: string;
    order_id: string;
    payment_id?: string;
    status: string;
    error_code: number;
    error_message?: string;
    processing_time_ms?: number;
  };
  error?: string;
  message?: string;
}
