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
  sku?: string;
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
  method: 'cash' | 'card' | 'digital_wallet' | 'store_credit' | 'fastpay';
  amount: number;
  reference?: string;
  card_last4?: string;
  change_given?: number;
}

export interface FastPayRequest {
  qrCode: string;
  amount: number;
  description: string;
  cashboxCode: string;
}

export interface FastPayResponse {
  success: boolean;
  data: {
    payment_id?: string;
    status: 'success' | 'failed' | 'pending';
    error_message?: string;
    client_phone_number?: string;
    operation_time?: string;
  };
  error?: string;
}

export interface UzumBankConfig {
  merchant_service_user_id: string;
  secret_key: string;
  service_id: string;
  api_base_url: string;
  request_timeout_ms: string;
  cashbox_code_prefix: string;
  max_retry_attempts: string;
  enable_logging: string;
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
  async searchProducts(query: string, options: {
    limit?: number;
    offset?: number;
    language?: string;
  } = {}): Promise<ApiResponse<{ products: Product[]; total: number; limit: number; offset: number }>> {
    const params = new URLSearchParams({
      query,
      limit: (options.limit || 20).toString(),
      offset: (options.offset || 0).toString()
    });
    
    if (options.language) {
      params.append('language', options.language);
    }
    
    return this.request(`/products/search?${params}`);
  }

  async autocompleteProducts(query: string, limit = 8, language?: string): Promise<ApiResponse<{ products: Product[] }>> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString()
    });
    
    if (language) {
      params.append('language', language);
    }
    
    return this.request(`/products/autocomplete?${params}`);
  }

  async getProductByBarcode(barcode: string, language?: string): Promise<ApiResponse<{ product: Product; fromCache: boolean }>> {
    const params = new URLSearchParams();
    if (language) {
      params.append('language', language);
    }
    
    const url = `/products/barcode/${barcode}${params.toString() ? '?' + params.toString() : ''}`;
    return this.request(url);
  }

  async getAllProducts(options: { 
    limit?: number; 
    offset?: number; 
    category?: string;
    language?: string;
  } = {}): Promise<ApiResponse<{ products: Product[]; total: number }>> {
    const params = new URLSearchParams({
      limit: (options.limit || 50).toString(),
      offset: (options.offset || 0).toString(),
    });
    
    if (options.category) {
      params.append('category', options.category);
    }
    if (options.language) {
      params.append('language', options.language);
    }
    
    return this.request(`/products?${params.toString()}`);
  }

  async createProduct(productData: Partial<Product>): Promise<ApiResponse<Product>> {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async updateProduct(id: string, productData: Partial<Product>): Promise<ApiResponse<Product>> {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  async deleteProduct(id: string): Promise<ApiResponse<any>> {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getLowStockProducts(language?: string): Promise<ApiResponse<Product[]>> {
    const params = new URLSearchParams();
    if (language) {
      params.append('language', language);
    }
    
    const url = `/products/low-stock${params.toString() ? '?' + params.toString() : ''}`;
    return this.request(url);
  }

  async getCategories(language?: string): Promise<ApiResponse<{ categories: { key: string; name: string; product_count: number }[] }>> {
    const params = new URLSearchParams();
    if (language) {
      params.append('language', language);
    }
    
    const url = `/products/categories${params.toString() ? '?' + params.toString() : ''}`;
    return this.request(url);
  }

  async getProductsByCategory(category: string, options: {
    limit?: number;
    offset?: number;
    language?: string;
  } = {}): Promise<ApiResponse<{ products: Product[]; total: number }>> {
    const params = new URLSearchParams({
      limit: (options.limit || 50).toString(),
      offset: (options.offset || 0).toString(),
    });
    
    if (options.language) {
      params.append('language', options.language);
    }
    
    return this.request(`/products/category/${category}?${params.toString()}`);
  }

  async createCategory(categoryData: { name_en: string; name_ru: string; name_uz: string }): Promise<ApiResponse<{ category: any }>> {
    return this.request('/products/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
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

  async processPayment(transactionId: string, paymentData: Partial<Payment>): Promise<ApiResponse> {
    return this.request(`/transactions/${transactionId}/payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async processSplitPayment(transactionId: string, payments: Partial<Payment>[]): Promise<ApiResponse> {
    return this.request(`/transactions/${transactionId}/split-payment`, {
      method: 'POST',
      body: JSON.stringify({ payments }),
    });
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

  // Employee management methods
  async getAllEmployees(): Promise<ApiResponse<{ employees: Employee[] }>> {
    return this.request('/employees');
  }

  async getEmployee(employeeId: string): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request(`/employees/${employeeId}`);
  }

  async createEmployee(employeeData: {
    employee_id: string;
    name: string;
    role: 'admin' | 'manager' | 'cashier' | 'supervisor';
    pin: string;
    hire_date?: string;
    status?: 'active' | 'inactive' | 'suspended';
  }): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request('/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(employeeData),
    });
  }

  async updateEmployee(employeeId: string, updateData: {
    name?: string;
    role?: 'admin' | 'manager' | 'cashier' | 'supervisor';
    status?: 'active' | 'inactive' | 'suspended';
    hire_date?: string;
  }): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request(`/employees/${employeeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
  }

  async deleteEmployee(employeeId: string): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request(`/employees/${employeeId}`, {
      method: 'DELETE',
    });
  }

  async changeEmployeePassword(employeeId: string, newPin: string): Promise<ApiResponse<{ employee: Employee }>> {
    return this.request(`/employees/${employeeId}/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newPin }),
    });
  }

  async getEmployeeSchedule(employeeId: string, startDate?: string, endDate?: string): Promise<ApiResponse<{ schedule: TimeLog[]; period: { startDate?: string; endDate?: string } }>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    return this.request(`/employees/${employeeId}/schedule?${params.toString()}`);
  }

  async getTodayHours(employeeId: string): Promise<ApiResponse<{ todayHours: TimeLog | null; date: string }>> {
    return this.request(`/employees/${employeeId}/today-hours`);
  }

  async clockIn(employeeId: string, terminalId?: string): Promise<ApiResponse<{ timeLogId: string; clockIn: string; message: string }>> {
    return this.request(`/employees/${employeeId}/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ terminalId }),
    });
  }

  async clockOut(employeeId: string, notes?: string): Promise<ApiResponse<{ timeLogId: string; clockOut: string; hoursWorked: number; message: string }>> {
    return this.request(`/employees/${employeeId}/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
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

  // FastPay endpoints
  async processFastPayPayment(request: FastPayRequest): Promise<ApiResponse<FastPayResponse>> {
    return this.request('/fastpay', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getFastPayStatus(paymentId: string): Promise<ApiResponse<any>> {
    return this.request(`/fastpay/status/${paymentId}`);
  }

  async reverseFastPayPayment(paymentId: string, reason: string): Promise<ApiResponse<any>> {
    return this.request('/fastpay/reverse', {
      method: 'POST',
      body: JSON.stringify({ paymentId, reason }),
    });
  }

  async getFastPayTransactions(params?: { limit?: number; offset?: number; status?: string }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.status) queryParams.append('status', params.status);
    
    const queryString = queryParams.toString();
    return this.request(`/fastpay/transactions${queryString ? `?${queryString}` : ''}`);
  }

  // Uzum Bank Configuration endpoints (Admin only)
  async getUzumBankConfig(): Promise<ApiResponse<UzumBankConfig>> {
    return this.request('/admin/uzum-bank/config');
  }

  async updateUzumBankConfig(config: Partial<UzumBankConfig>): Promise<ApiResponse<{ message: string }>> {
    return this.request('/admin/uzum-bank/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async getUzumBankAnalytics(): Promise<ApiResponse<any>> {
    return this.request('/admin/uzum-bank/analytics');
  }

  async testUzumBankConnection(): Promise<ApiResponse<{ status: string; message: string }>> {
    return this.request('/admin/uzum-bank/test-connection', {
      method: 'POST',
    });
  }

  async checkHealth(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request('/health', {
      method: 'GET',
    });
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
export default apiService;

// Add Employee and TimeLog interfaces if they don't exist
export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'supervisor';
  status: 'active' | 'inactive' | 'suspended';
  hire_date: string;
  last_login?: string;
  created_at: string;
  updated_at?: string;
}

export interface TimeLog {
  id: string;
  clock_in: string;
  clock_out?: string;
  hours_worked?: number;
  break_minutes: number;
  notes?: string;
  terminal_id?: string;
  is_clocked_in?: boolean;
}
