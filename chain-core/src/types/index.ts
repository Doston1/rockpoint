export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'super_admin' | 'chain_admin' | 'manager' | 'analyst' | 'auditor';
  permissions: string[];
  isActive: boolean;
}

export interface Branch {
  id: string;
  chainId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  timezone: string;
  currency: string;
  taxRate: number;
  isActive: boolean;
  lastSyncAt?: Date;
  apiEndpoint?: string;
  apiKey?: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  branchId: string;
  name: string;
  role: 'admin' | 'manager' | 'supervisor' | 'cashier';
  phone?: string;
  email?: string;
  hireDate?: Date;
  salary?: number;
  status: 'active' | 'inactive' | 'terminated';
  syncStatus: 'synced' | 'pending' | 'error';
  oneCId?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  nameRu?: string;
  nameUz?: string;
  description?: string;
  descriptionRu?: string;
  descriptionUz?: string;
  categoryId?: string;
  brand?: string;
  unitOfMeasure: string;
  basePrice: number;
  cost?: number;
  taxRate: number;
  imageUrl?: string;
  images?: string[];
  attributes?: Record<string, any>;
  isActive: boolean;
  oneCId?: string;
}

export interface Category {
  id: string;
  key: string;
  name: string;
  nameRu?: string;
  nameUz?: string;
  description?: string;
  descriptionRu?: string;
  descriptionUz?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  oneCId?: string;
}

export interface Transaction {
  id: string;
  branchId: string;
  transactionNumber: string;
  employeeId?: string;
  customerId?: string;
  terminalId?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  completedAt?: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  oneCId?: string;
}

export interface BranchInventory {
  id: string;
  branchId: string;
  productId: string;
  quantityInStock: number;
  reservedQuantity: number;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  lastCountedAt?: Date;
  lastMovementAt?: Date;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface OneCSync {
  id: string;
  syncType: 'products' | 'categories' | 'employees' | 'transactions' | 'inventory';
  direction: 'import' | 'export';
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
  error?: string;
  timestamp: string;
}

export interface DashboardStats {
  branches: {
    total: number;
    active: number;
    inactive: number;
  };
  employees: {
    total: number;
    active: number;
    byRole: Record<string, number>;
  };
  products: {
    total: number;
    active: number;
    lowStock: number;
  };
  sales: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    previousMonth: number;
  };
  inventory: {
    totalValue: number;
    lowStockAlerts: number;
  };
  sync: {
    lastSync: Date | null;
    status: string;
    pendingItems: number;
  };
}

export interface ReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  branchIds?: string[];
  categoryIds?: string[];
  employeeIds?: string[];
  status?: string;
  limit?: number;
  offset?: number;
}
