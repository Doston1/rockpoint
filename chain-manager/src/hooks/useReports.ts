import { useCallback, useState } from 'react';
import apiService from '../services/api';

interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchIds?: string[];
  employeeIds?: string[];
  branchId?: string;
  startDate?: string;
  endDate?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  limit?: number;
}

export interface DashboardStats {
  total_revenue: number;
  transaction_count: number;
  low_stock_count: number;
  employee_count: number;
  branch_count?: number;
}

export interface SalesTrend {
  period: string;
  revenue: number;
  transactions: number;
  avg_sale: number;
}

export interface TopProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity_sold: number;
  revenue: number;
  order_count: number;
}

export interface CategoryPerformance {
  id: string;
  name: string;
  quantity_sold: number;
  revenue: number;
  products_sold: number;
  order_count: number;
}

export interface EmployeePerformance {
  id: string;
  name: string;
  role: string;
  transaction_count: number;
  total_sales: number;
  average_sale: number;
  branch_name?: string;
}

export interface BranchComparison {
  id: string;
  name: string;
  code: string;
  transaction_count: number;
  total_sales: number;
  average_sale: number;
  employee_count: number;
}

export interface FinancialSummary {
  financial_summary: {
    total_revenue: number;
    total_tax: number;
    transaction_count: number;
  };
  payment_methods: Array<{
    method: string;
    amount: number;
    transaction_count: number;
  }>;
  hourly_sales: Array<{
    hour: number;
    total_sales: number;
    transaction_count: number;
  }>;
  period: {
    start_date: string;
    end_date: string;
  };
}

interface UseReportsReturn {
  // Data
  dashboardStats: DashboardStats | null;
  salesReport: any;
  inventoryReport: any;
  salesTrends: SalesTrend[] | null;
  topProducts: TopProduct[] | null;
  categoryPerformance: CategoryPerformance[] | null;
  employeePerformance: EmployeePerformance[] | null;
  branchComparison: BranchComparison[] | null;
  financialSummary: FinancialSummary | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingDashboard: boolean;
  isLoadingSales: boolean;
  isLoadingInventory: boolean;
  isLoadingTrends: boolean;
  isLoadingProducts: boolean;
  isLoadingCategories: boolean;
  isLoadingEmployees: boolean;
  isLoadingBranches: boolean;
  isLoadingFinancial: boolean;
  
  // Error state
  error: string | null;
  
  // Methods
  fetchDashboardStats: (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => Promise<void>;
  generateSalesReport: (filters: ReportFilters) => Promise<void>;
  generateInventoryReport: (branchId?: string) => Promise<void>;
  fetchSalesTrends: (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => Promise<void>;
  fetchTopProducts: (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => Promise<void>;
  fetchCategoryPerformance: (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => Promise<void>;
  fetchEmployeePerformance: (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => Promise<void>;
  fetchBranchComparison: (filters?: Omit<ReportFilters, 'branchId' | 'branchIds' | 'employeeIds'>) => Promise<void>;
  fetchFinancialSummary: (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => Promise<void>;
  refreshAll: (filters?: ReportFilters) => Promise<void>;
}

export const useReports = (): UseReportsReturn => {
  // Data states
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [salesReport, setSalesReport] = useState<any>(null);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [salesTrends, setSalesTrends] = useState<SalesTrend[] | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[] | null>(null);
  const [categoryPerformance, setCategoryPerformance] = useState<CategoryPerformance[] | null>(null);
  const [employeePerformance, setEmployeePerformance] = useState<EmployeePerformance[] | null>(null);
  const [branchComparison, setBranchComparison] = useState<BranchComparison[] | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => {
    try {
      setIsLoadingDashboard(true);
      setError(null);
      
      const response = await apiService.getDashboardStats(filters);
      
      if (response.success && response.data) {
        setDashboardStats(response.data);
      } else {
        setError(response.error || 'Failed to fetch dashboard stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  const generateSalesReport = useCallback(async (filters: ReportFilters) => {
    try {
      setIsLoadingSales(true);
      setError(null);
      
      const response = await apiService.getSalesReport(filters);
      
      if (response.success && response.data) {
        setSalesReport(response.data);
      } else {
        setError(response.error || 'Failed to generate sales report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingSales(false);
    }
  }, []);

  const generateInventoryReport = useCallback(async (branchId?: string) => {
    try {
      setIsLoadingInventory(true);
      setError(null);
      
      const response = await apiService.getInventoryReport(branchId);
      
      if (response.success && response.data) {
        setInventoryReport(response.data);
      } else {
        setError(response.error || 'Failed to generate inventory report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  const fetchSalesTrends = useCallback(async (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => {
    try {
      setIsLoadingTrends(true);
      setError(null);
      
      const response = await apiService.getSalesTrends(filters);
      
      if (response.success && response.data) {
        setSalesTrends(response.data.trends);
      } else {
        setError(response.error || 'Failed to fetch sales trends');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingTrends(false);
    }
  }, []);

  const fetchTopProducts = useCallback(async (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => {
    try {
      setIsLoadingProducts(true);
      setError(null);
      
      const response = await apiService.getTopProducts(filters);
      
      if (response.success && response.data) {
        setTopProducts(response.data.top_products);
      } else {
        setError(response.error || 'Failed to fetch top products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const fetchCategoryPerformance = useCallback(async (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => {
    try {
      setIsLoadingCategories(true);
      setError(null);
      
      const response = await apiService.getCategoryPerformance(filters);
      
      if (response.success && response.data) {
        setCategoryPerformance(response.data.category_performance);
      } else {
        setError(response.error || 'Failed to fetch category performance');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  const fetchEmployeePerformance = useCallback(async (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => {
    try {
      setIsLoadingEmployees(true);
      setError(null);
      
      const response = await apiService.getEmployeePerformance(filters);
      
      if (response.success && response.data) {
        setEmployeePerformance(response.data.employee_performance);
      } else {
        setError(response.error || 'Failed to fetch employee performance');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingEmployees(false);
    }
  }, []);

  const fetchBranchComparison = useCallback(async (filters?: Omit<ReportFilters, 'branchId' | 'branchIds' | 'employeeIds'>) => {
    try {
      setIsLoadingBranches(true);
      setError(null);
      
      const response = await apiService.getBranchComparison(filters);
      
      if (response.success && response.data) {
        setBranchComparison(response.data.branch_comparison);
      } else {
        setError(response.error || 'Failed to fetch branch comparison');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingBranches(false);
    }
  }, []);

  const fetchFinancialSummary = useCallback(async (filters?: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'>) => {
    try {
      setIsLoadingFinancial(true);
      setError(null);
      
      const response = await apiService.getFinancialSummary(filters);
      
      if (response.success && response.data) {
        setFinancialSummary(response.data);
      } else {
        setError(response.error || 'Failed to fetch financial summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingFinancial(false);
    }
  }, []);

  const refreshAll = useCallback(async (filters?: ReportFilters) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const reportFilters: Omit<ReportFilters, 'dateFrom' | 'dateTo' | 'branchIds' | 'employeeIds'> = {
        startDate: filters?.dateFrom || filters?.startDate,
        endDate: filters?.dateTo || filters?.endDate,
        branchId: filters?.branchIds?.[0] || filters?.branchId,
        period: filters?.period,
        limit: filters?.limit,
      };
      
      const branchFilters: Omit<ReportFilters, 'branchId' | 'branchIds' | 'employeeIds'> = {
        startDate: filters?.dateFrom || filters?.startDate,
        endDate: filters?.dateTo || filters?.endDate,
        period: filters?.period,
        limit: filters?.limit,
      };
      
      await Promise.all([
        fetchDashboardStats(reportFilters),
        fetchSalesTrends(reportFilters),
        fetchTopProducts(reportFilters),
        fetchCategoryPerformance(reportFilters),
        fetchEmployeePerformance(reportFilters),
        fetchBranchComparison(branchFilters),
        fetchFinancialSummary(reportFilters),
      ]);
      
      if (filters) {
        await generateSalesReport(filters);
        await generateInventoryReport(filters.branchIds?.[0] || filters.branchId);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh reports');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboardStats, fetchSalesTrends, fetchTopProducts, fetchCategoryPerformance, 
      fetchEmployeePerformance, fetchBranchComparison, fetchFinancialSummary, 
      generateSalesReport, generateInventoryReport]);

  return {
    // Data
    dashboardStats,
    salesReport,
    inventoryReport,
    salesTrends,
    topProducts,
    categoryPerformance,
    employeePerformance,
    branchComparison,
    financialSummary,
    
    // Loading states
    isLoading,
    isLoadingDashboard,
    isLoadingSales,
    isLoadingInventory,
    isLoadingTrends,
    isLoadingProducts,
    isLoadingCategories,
    isLoadingEmployees,
    isLoadingBranches,
    isLoadingFinancial,
    
    // Error state
    error,
    
    // Methods
    fetchDashboardStats,
    generateSalesReport,
    generateInventoryReport,
    fetchSalesTrends,
    fetchTopProducts,
    fetchCategoryPerformance,
    fetchEmployeePerformance,
    fetchBranchComparison,
    fetchFinancialSummary,
    refreshAll,
  };
};
