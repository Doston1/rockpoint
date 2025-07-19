// API Service for communicating with the backend
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  employeeId: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'supervisor';
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresIn: string;
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
}

export interface Transaction {
  id: string;
  terminal_id: string;
  employee_id: string;
  customer_id?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: 'pending' | 'completed' | 'voided' | 'refunded';
  items: TransactionItem[];
  payments?: Payment[];
}

export interface TransactionItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface Payment {
  id?: string;
  method: 'cash' | 'card' | 'digital_wallet' | 'store_credit';
  amount: number;
  reference?: string;
  card_last4?: string;
  change_given?: number;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    // Use environment variable or default to localhost
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
  }

  // Token management
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('auth_token');
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // Generic request method
  private async request<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      
      // Handle different response types
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
          data: undefined
        };
      }

      return data;
    } catch (error: any) {
      console.error('API Request failed:', error);
      return {
        success: false,
        error: error.message || 'Network error occurred',
        data: undefined
      };
    }
  }

  // Authentication endpoints
  async login(employeeId: string, pin: string, terminalId?: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employeeId, pin, terminalId }),
    });

    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
    return response;
  }

  async verifyToken(): Promise<ApiResponse<{ user: User; session: any }>> {
    return this.request('/auth/verify', { method: 'POST' });
  }

  async changePin(currentPin: string, newPin: string, confirmPin: string): Promise<ApiResponse> {
    return this.request('/auth/change-pin', {
      method: 'POST',
      body: JSON.stringify({ currentPin, newPin, confirmPin }),
    });
  }

  async getActiveSessions(): Promise<ApiResponse<{ activeSessions: number; sessions: any[] }>> {
    return this.request('/auth/sessions');
  }

  // Product endpoints
  async searchProducts(query: string, limit = 20, offset = 0): Promise<ApiResponse<Product[]>> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
      offset: offset.toString()
    });
    return this.request(`/products/search?${params}`);
  }

  async getProductByBarcode(barcode: string): Promise<ApiResponse<Product>> {
    return this.request(`/products/barcode/${barcode}`);
  }

  async getAllProducts(): Promise<ApiResponse<Product[]>> {
    return this.request('/products');
  }

  async createProduct(product: Partial<Product>): Promise<ApiResponse<Product>> {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<ApiResponse<Product>> {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  }

  async deleteProduct(id: string): Promise<ApiResponse> {
    return this.request(`/products/${id}`, { method: 'DELETE' });
  }

  async getLowStockProducts(): Promise<ApiResponse<Product[]>> {
    return this.request('/products/low-stock');
  }

  // Transaction endpoints
  async createTransaction(transactionData: Partial<Transaction>): Promise<ApiResponse<Transaction>> {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async getTransactions(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    employeeId?: string;
    terminalId?: string;
  }): Promise<ApiResponse<Transaction[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    return this.request(`/transactions${queryString ? `?${queryString}` : ''}`);
  }

  async getTransactionById(id: string): Promise<ApiResponse<Transaction>> {
    return this.request(`/transactions/${id}`);
  }

  async voidTransaction(id: string, reason: string): Promise<ApiResponse> {
    return this.request(`/transactions/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async refundTransaction(id: string, reason: string): Promise<ApiResponse> {
    return this.request(`/transactions/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Employee endpoints
  async getEmployees(): Promise<ApiResponse<User[]>> {
    return this.request('/employees');
  }

  async createEmployee(employee: Partial<User & { pin: string }>): Promise<ApiResponse<User>> {
    return this.request('/employees', {
      method: 'POST',
      body: JSON.stringify(employee),
    });
  }

  async updateEmployee(id: string, employee: Partial<User>): Promise<ApiResponse<User>> {
    return this.request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employee),
    });
  }

  // Reports endpoints
  async getDailyReport(date?: string): Promise<ApiResponse<any>> {
    const params = date ? `?date=${date}` : '';
    return this.request(`/reports/daily${params}`);
  }

  async getWeeklyReport(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    return this.request(`/reports/weekly${queryString ? `?${queryString}` : ''}`);
  }

  async getMonthlyReport(year?: number, month?: number): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    
    const queryString = params.toString();
    return this.request(`/reports/monthly${queryString ? `?${queryString}` : ''}`);
  }

  // Sync endpoint
  async syncData(): Promise<ApiResponse> {
    return this.request('/sync', { method: 'POST' });
  }

  async getSyncStatus(): Promise<ApiResponse> {
    return this.request('/sync/status');
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;
