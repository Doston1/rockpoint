import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'supervisor';
  permissions: string[];
  branchId?: string;
  branchName?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  manager: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  code: string;
  position: string;
  department: string;
  branchId: string;
  branchName: string;
  hireDate: string;
  salary: number;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  quantity: number;
  lowStockThreshold: number;
  description?: string;
  imageUrl?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalBranches: number;
  totalEmployees: number;
  totalProducts: number;
  totalSales: number;
  recentActivity: any[];
  branchPerformance: any[];
  salesOverview: any[];
}

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    
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
        if (error.response?.status === 401) {
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
      const response = await this.api.post('/auth/login', { email, password });
      if (response.data.success) {
        this.setToken(response.data.data.token);
        localStorage.setItem('user_data', JSON.stringify(response.data.data.user));
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
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
      const response = await this.api.post('/auth/verify');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Token verification failed',
      };
    }
  }

  // Dashboard APIs
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    try {
      const response = await this.api.get('/dashboard/stats');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch dashboard stats',
      };
    }
  }

  // Branch APIs
  async getBranches(): Promise<ApiResponse<Branch[]>> {
    try {
      const response = await this.api.get('/branches');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch branches',
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
      };
    }
  }

  async createBranch(branch: Partial<Branch>): Promise<ApiResponse<Branch>> {
    try {
      const response = await this.api.post('/branches', branch);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create branch',
      };
    }
  }

  async updateBranch(id: string, branch: Partial<Branch>): Promise<ApiResponse<Branch>> {
    try {
      const response = await this.api.put(`/branches/${id}`, branch);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update branch',
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
      };
    }
  }

  // Employee APIs
  async getEmployees(): Promise<ApiResponse<Employee[]>> {
    try {
      const response = await this.api.get('/employees');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employees',
      };
    }
  }

  async getEmployee(id: string): Promise<ApiResponse<Employee>> {
    try {
      const response = await this.api.get(`/employees/${id}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch employee',
      };
    }
  }

  async createEmployee(employee: Partial<Employee>): Promise<ApiResponse<Employee>> {
    try {
      const response = await this.api.post('/employees', employee);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create employee',
      };
    }
  }

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<ApiResponse<Employee>> {
    try {
      const response = await this.api.put(`/employees/${id}`, employee);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update employee',
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
      };
    }
  }

  // Product APIs
  async getProducts(): Promise<ApiResponse<Product[]>> {
    try {
      const response = await this.api.get('/products');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch products',
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
      };
    }
  }

  async createProduct(product: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const response = await this.api.post('/products', product);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create product',
      };
    }
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<ApiResponse<Product>> {
    try {
      const response = await this.api.put(`/products/${id}`, product);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to update product',
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
      };
    }
  }

  // Reports APIs
  async getReports(type: string, params?: any): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get(`/reports/${type}`, { params });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to fetch reports',
      };
    }
  }
}

export const apiService = new ApiService();
