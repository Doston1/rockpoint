import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { transformBranch, transformCategory, transformEmployee, transformInventory, transformProduct } from '../utils/transformers';

// Types - Updated to match chain-core backend
export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'super_admin' | 'chain_admin' | 'manager' | 'analyst' | 'auditor';
  permissions: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
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

export interface Branch {
  id: string;
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
  createdAt?: string;
  updatedAt?: string;
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
  lastLogin?: Date;
  oneCId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  loyalty_card_number?: string;
  loyalty_points: number;
  discount_percentage: number;
  is_vip: boolean;
  is_active: boolean;
  notes?: string;
  transaction_count?: number;
  total_spent?: number;
  last_transaction_date?: string;
  first_transaction_date?: string;
  average_transaction_amount?: number;
  recent_transactions?: Array<{
    id: string;
    transaction_number: string;
    transaction_date: string;
    total_amount: number;
    payment_method: string;
    branch_name: string;
    cashier_name: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
  // Branch-specific pricing fields (populated when branch_id is provided)
  branch_price?: number;
  branch_cost?: number;
  is_available?: boolean;
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
  // Branch-specific pricing fields from backend JOIN with branch_product_pricing
  branch_price?: number;
  branch_cost?: number;
  is_available?: boolean;
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
  oneCId?: string;
}

export interface DashboardStats {
  today_sales: {
    transaction_count: number;
    total_sales: number;
    average_sale: number;
  };
  month_sales: {
    transaction_count: number;
    total_sales: number;
  };
  active_employees: number;
  low_stock_items: number;
  recent_transactions: Array<{
    id: string;
    total_amount: number;
    payment_method: string;
    created_at: string;
    employee_name: string;
    branch_name: string;
  }>;
}

export interface Promotion {
  id: string;
  branchId: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bulk_discount';
  productId?: string;
  categoryId?: string;
  discountPercentage?: number;
  discountAmount?: number;
  minQuantity?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    
    this.api = axios.create({
      baseURL: `${this.baseURL}/api`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        // Don't redirect to login if we're already on the login page or trying to login
        if (error.response?.status === 401 && !window.location.pathname.includes('/login') && !error.config?.url?.includes('/auth/login')) {
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Token management
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  clearToken(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }

    // Auth APIs
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    try {
      console.log('API: Sending login request to:', `${this.baseURL}/api/auth/login`);
      const response = await this.api.post('/auth/login', { email, password });
      console.log('API: Login response:', response.data);
      if (response.data.success) {
        console.log('API: Login successful, storing token');
        this.setToken(response.data.data.token);
        localStorage.setItem('user_data', JSON.stringify(response.data.data.user));
      }
      return response.data;
    } catch (error: any) {
      console.error('API: Login error:', error);
      console.error('API: Error response:', error.response?.data);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Login failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  async verifyToken(): Promise<ApiResponse<{ user: User }>> {
    try {
      const response = await this.api.post('/auth/verify-token');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Token verification failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Dashboard APIs
  async getDashboardStats(filters?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters?.startDate) params.start_date = filters.startDate;
      if (filters?.endDate) params.end_date = filters.endDate;
      if (filters?.branchId) params.branch_id = filters.branchId;
      
      const response = await this.api.get('/reports/dashboard', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch dashboard stats',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getComprehensiveDashboardStats(): Promise<ApiResponse<{
    totalBranches: number;
    totalProducts: number;
    totalEmployees: number;
    todayTransactions: number;
    todaySales: number;
    monthSales: number;
    lowStockItems: number;
    recentTransactions?: Array<{
      id: string;
      total_amount: number;
      payment_method: string;
      created_at: string;
      employee_name: string;
      branch_name: string;
    }>;
  }>> {
    try {
      const response = await this.api.get('/dashboard/comprehensive');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch comprehensive dashboard stats',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Branch APIs
  async getBranches(): Promise<ApiResponse<{ branches: Branch[] }>> {
    try {
      const response = await this.api.get('/branches');
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: {
            branches: response.data.data.branches.map(transformBranch)
          }
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branches',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBranch(id: string): Promise<ApiResponse<Branch>> {
    try {
      const response = await this.api.get(`/branches/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createBranch(branchData: Partial<Branch>): Promise<ApiResponse<Branch>> {
    try {
      const response = await this.api.post('/branches', branchData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateBranch(id: string, branchData: Partial<Branch>): Promise<ApiResponse<Branch>> {
    try {
      const response = await this.api.put(`/branches/${id}`, branchData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteBranch(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/branches/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBranchStats(id: string): Promise<ApiResponse<{
    employeeCount: number;
    todaySales: number;
    monthSales: number;
    productCount: number;
    lowStockCount: number;
    recentTransactions: number;
  }>> {
    try {
      const response = await this.api.get(`/branches/${id}/stats`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branch stats',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBranchConnection(id: string): Promise<ApiResponse<{
    isConnected: boolean;
    lastSync: string;
    status: string;
  }>> {
    try {
      const response = await this.api.get(`/branches/${id}/connection`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branch connection status',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async syncBranch(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.post(`/branches/${id}/sync`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to sync branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getAllBranchesConnectionStatus(): Promise<ApiResponse<{ 
    branches: Array<{
      id: string;
      name: string;
      code: string;
      isConnected: boolean;
      lastSync: string;
      status: string;
    }> 
  }>> {
    try {
      const response = await this.api.get('/branches/connection-status');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branches connection status',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Employee APIs
  async getEmployees(branchId?: string): Promise<ApiResponse<{ employees: Employee[] }>> {
    try {
      const params = branchId ? { branch_id: branchId } : {};
      const response = await this.api.get('/employees', { params });
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: {
            employees: response.data.data.employees.map(transformEmployee)
          }
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employees',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Customer APIs
  async getCustomers(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    is_active?: boolean;
    is_vip?: boolean;
    phone?: string;
    email?: string;
  }): Promise<ApiResponse<{ customers: Customer[] }> & { pagination?: any }> {
    try {
      const params: any = {};
      if (filters?.page) params.page = filters.page;
      if (filters?.limit) params.limit = filters.limit;
      if (filters?.search) params.search = filters.search;
      if (filters?.is_active !== undefined) params.is_active = filters.is_active;
      if (filters?.is_vip !== undefined) params.is_vip = filters.is_vip;
      if (filters?.phone) params.phone = filters.phone;
      if (filters?.email) params.email = filters.email;
      
      const response = await this.api.get('/customers', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch customers',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCustomer(id: string, includeTransactions?: boolean): Promise<ApiResponse<Customer>> {
    try {
      const params = includeTransactions ? { include_transactions: 'true' } : {};
      const response = await this.api.get(`/customers/${id}`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch customer',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createCustomer(customerData: Partial<Customer>): Promise<ApiResponse<Customer>> {
    try {
      const response = await this.api.post('/customers', customerData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create customer',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateCustomer(id: string, customerData: Partial<Customer>): Promise<ApiResponse<Customer>> {
    try {
      const response = await this.api.put(`/customers/${id}`, customerData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update customer',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteCustomer(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/customers/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete customer',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async activateCustomer(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.post(`/customers/${id}/activate`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to activate customer',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCustomerTransactions(
    id: string,
    filters?: {
      page?: number;
      limit?: number;
      start_date?: string;
      end_date?: string;
      min_amount?: number;
      max_amount?: number;
      branch_id?: string;
    }
  ): Promise<ApiResponse<{
    customer: Customer;
    transactions: any[];
  }> & { pagination?: any }> {
    try {
      const params: any = {};
      if (filters?.page) params.page = filters.page;
      if (filters?.limit) params.limit = filters.limit;
      if (filters?.start_date) params.start_date = filters.start_date;
      if (filters?.end_date) params.end_date = filters.end_date;
      if (filters?.min_amount) params.min_amount = filters.min_amount;
      if (filters?.max_amount) params.max_amount = filters.max_amount;
      if (filters?.branch_id) params.branch_id = filters.branch_id;
      
      const response = await this.api.get(`/customers/${id}/transactions`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch customer transactions',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getEmployee(id: string): Promise<ApiResponse<Employee>> {
    try {
      const response = await this.api.get(`/employees/${id}`);
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: transformEmployee(response.data.data)
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employee',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createEmployee(employeeData: Partial<Employee>): Promise<ApiResponse<Employee>> {
    try {
      const response = await this.api.post('/employees', employeeData);
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: transformEmployee(response.data.data)
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create employee',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateEmployee(id: string, employeeData: Partial<Employee>): Promise<ApiResponse<Employee>> {
    try {
      const response = await this.api.put(`/employees/${id}`, employeeData);
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: transformEmployee(response.data.data)
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update employee',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteEmployee(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/employees/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete employee',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getEmployeeTimeLogs(employeeId: string, startDate?: string, endDate?: string): Promise<ApiResponse<{ timeLogs: any[] }>> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const response = await this.api.get(`/employees/${employeeId}/time-logs?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch time logs',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getEmployeeStats(employeeId: string, month?: string, year?: string): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      
      const response = await this.api.get(`/employees/${employeeId}/stats?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employee stats',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Product APIs
  async getProducts(filters?: { category?: string; branch_id?: string; is_active?: boolean }): Promise<ApiResponse<{ products: Product[] }>> {
    try {
      const response = await this.api.get('/products', { params: filters });
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: {
            products: response.data.data.products.map(transformProduct)
          }
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch products',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    try {
      const response = await this.api.get(`/products/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch product',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createProduct(productData: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const response = await this.api.post('/products', productData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create product',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateProduct(id: string, productData: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const response = await this.api.put(`/products/${id}`, productData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update product',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteProduct(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/products/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete product',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Category APIs
  async getCategories(): Promise<ApiResponse<{ categories: Category[] }>> {
    try {
      const response = await this.api.get('/products/categories');
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: {
            categories: response.data.data.categories.map(transformCategory)
          }
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch categories',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createCategory(categoryData: Partial<Category>): Promise<ApiResponse<Category>> {
    try {
      const response = await this.api.post('/products/categories', categoryData);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create category',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Inventory APIs
  async getGeneralInventory(): Promise<ApiResponse<{ inventory: BranchInventory[] }>> {
    try {
      const response = await this.api.get('/inventory');
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: {
            inventory: response.data.data.inventory.map(transformInventory)
          }
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch general inventory',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBranchInventory(branchId: string): Promise<ApiResponse<{ inventory: BranchInventory[] }>> {
    try {
      const response = await this.api.get(`/inventory/branch/${branchId}`);
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: {
            inventory: response.data.data.inventory.map(transformInventory)
          }
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch inventory',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateInventory(branchId: string, productId: string, data: Partial<BranchInventory>): Promise<ApiResponse<BranchInventory>> {
    try {
      const response = await this.api.put(`/inventory/branch/${branchId}/product/${productId}`, data);
      if (response.data.success && response.data.data) {
        return {
          ...response.data,
          data: transformInventory(response.data.data)
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update inventory',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Promotions APIs
  async getBranchPromotions(branchId: string): Promise<ApiResponse<{ promotions: Promotion[] }>> {
    try {
      const response = await this.api.get(`/promotions/branch/${branchId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch promotions',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createPromotion(branchId: string, data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Promotion>> {
    try {
      const response = await this.api.post(`/promotions/branch/${branchId}`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create promotion',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updatePromotion(promotionId: string, data: Partial<Promotion>): Promise<ApiResponse<Promotion>> {
    try {
      const response = await this.api.put(`/promotions/${promotionId}`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update promotion',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deletePromotion(promotionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/promotions/${promotionId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete promotion',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Sync to Branch APIs
  async syncProductsToBranch(branchId: string): Promise<ApiResponse<{ synced: number }>> {
    try {
      const response = await this.api.post(`/sync/products/branch/${branchId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to sync products to branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async syncPricesToBranch(branchId: string, forceAll: boolean = false): Promise<ApiResponse<{ synced: number }>> {
    try {
      const response = await this.api.post(`/sync/prices/branch/${branchId}`, {
        force_all: forceAll
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to sync prices to branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async syncPromotionsToBranch(branchId: string): Promise<ApiResponse<{ synced: number }>> {
    try {
      const response = await this.api.post(`/sync/promotions/branch/${branchId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to sync promotions to branch',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Sync APIs
  async getOneCStatus(): Promise<ApiResponse<OneCSync[]>> {
    try {
      const response = await this.api.get('/1c/status');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch 1C sync status',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async triggerSync(syncType: OneCSync['syncType'], direction: OneCSync['direction'] = 'import'): Promise<ApiResponse<OneCSync>> {
    try {
      const response = await this.api.post('/1c/sync', { syncType, direction });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to trigger sync',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Reports APIs
  async getSalesReport(filters: { 
    dateFrom?: string; 
    dateTo?: string; 
    branchIds?: string[]; 
    employeeIds?: string[]; 
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters.dateFrom) params.start_date = filters.dateFrom;
      if (filters.dateTo) params.end_date = filters.dateTo;
      if (filters.branchIds?.length === 1) params.branch_id = filters.branchIds[0];
      if (filters.employeeIds?.length === 1) params.employee_id = filters.employeeIds[0];
      
      const response = await this.api.get('/reports/sales', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch sales report',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getInventoryReport(branchId?: string): Promise<ApiResponse<any>> {
    try {
      const params = branchId ? { branch_id: branchId } : {};
      const response = await this.api.get('/reports/inventory', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch inventory report',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getSalesTrends(filters?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
    period?: 'daily' | 'weekly' | 'monthly';
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters?.startDate) params.start_date = filters.startDate;
      if (filters?.endDate) params.end_date = filters.endDate;
      if (filters?.branchId) params.branch_id = filters.branchId;
      if (filters?.period) params.period = filters.period;
      
      const response = await this.api.get('/reports/trends', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch sales trends',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getTopProducts(filters?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters?.startDate) params.start_date = filters.startDate;
      if (filters?.endDate) params.end_date = filters.endDate;
      if (filters?.branchId) params.branch_id = filters.branchId;
      if (filters?.limit) params.limit = filters.limit.toString();
      
      const response = await this.api.get('/reports/top-products', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch top products',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCategoryPerformance(filters?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters?.startDate) params.start_date = filters.startDate;
      if (filters?.endDate) params.end_date = filters.endDate;
      if (filters?.branchId) params.branch_id = filters.branchId;
      
      const response = await this.api.get('/reports/categories', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch category performance',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getEmployeePerformance(filters?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters?.startDate) params.start_date = filters.startDate;
      if (filters?.endDate) params.end_date = filters.endDate;
      if (filters?.branchId) params.branch_id = filters.branchId;
      
      const response = await this.api.get('/reports/employees', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employee performance',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBranchComparison(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters?.startDate) params.start_date = filters.startDate;
      if (filters?.endDate) params.end_date = filters.endDate;
      
      const response = await this.api.get('/reports/branches', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branch comparison',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getFinancialSummary(filters?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (filters?.startDate) params.start_date = filters.startDate;
      if (filters?.endDate) params.end_date = filters.endDate;
      if (filters?.branchId) params.branch_id = filters.branchId;
      
      const response = await this.api.get('/reports/financial', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch financial summary',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Branch Pricing Methods
  async getBranchPricing(branchId?: string, productId?: string): Promise<ApiResponse<{ branch_pricing: any[] }>> {
    try {
      let url = '/branch-pricing';
      const params = new URLSearchParams();
      
      if (branchId) params.append('branch_id', branchId);
      if (productId) params.append('product_id', productId);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await this.api.get(url);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branch pricing',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createBranchPricing(data: {
    branch_id: string;
    product_id: string;
    price?: number;
    cost?: number;
    is_available?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post('/branch-pricing', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create branch pricing',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateBranchPricing(id: string, data: Partial<{
    price: number;
    cost: number;
    is_available: boolean;
  }>): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.put(`/branch-pricing/${id}`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update branch pricing',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteBranchPricing(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/branch-pricing/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete branch pricing',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Network Management APIs
  async getBranchServers(params?: { status?: string; network_type?: string }): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.api.get('/network/branch-servers', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branch servers',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getBranchServer(id: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get(`/network/branch-servers/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branch server',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async saveBranchServer(data: {
    branch_id: string;
    server_name: string;
    ip_address: string;
    port: number;
    api_port?: number;
    websocket_port?: number;
    vpn_ip_address?: string;
    public_ip_address?: string;
    network_type?: string;
    api_key?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post('/network/branch-servers', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to save branch server',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateBranchServerStatus(id: string, data: {
    status: string;
    response_time_ms?: number;
    server_info?: any;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.patch(`/network/branch-servers/${id}/status`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update branch server status',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async testBranchServerConnection(id: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.post(`/network/branch-servers/${id}/test-connection`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to test branch server connection',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteBranchServer(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/network/branch-servers/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to delete branch server',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getNetworkSettings(category?: string): Promise<ApiResponse<any[]>> {
    try {
      const params = category ? { category } : {};
      const response = await this.api.get('/network/settings', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch network settings',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateNetworkSetting(key: string, data: {
    setting_value: string;
    description?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.patch(`/network/settings/${key}`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update network setting',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getConnectionHealthLogs(params?: {
    limit?: number;
    source_type?: string;
    target_type?: string;
  }): Promise<ApiResponse<any[]>> {
    try {
      const response = await this.api.get('/network/health-logs', { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch connection health logs',
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Generic request method for network API calls
  async request(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', endpoint: string, data?: any): Promise<ApiResponse<any>> {
    try {
      const config: any = { method: method.toLowerCase() };
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.data = data;
      }
      
      const response = await this.api.request({
        ...config,
        url: endpoint,
      });
      
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || `Failed to ${method} ${endpoint}`,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Create and export API service instance
const apiService = new ApiService();
export default apiService;