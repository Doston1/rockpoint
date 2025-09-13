import { useCallback, useEffect, useState } from 'react';
import apiService, { DashboardStats } from '../services/api';

interface ComprehensiveStats {
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
}

interface UseDashboardReturn {
  dashboardData: DashboardStats | null;
  comprehensiveStats: ComprehensiveStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useDashboard = (branchId?: string): UseDashboardReturn => {
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [comprehensiveStats, setComprehensiveStats] = useState<ComprehensiveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch both regular dashboard stats and comprehensive stats
      const [dashboardResponse, comprehensiveResponse] = await Promise.all([
        apiService.getDashboardStats(branchId ? { branchId } : undefined),
        apiService.getComprehensiveDashboardStats()
      ]);
      
      if (dashboardResponse.success && dashboardResponse.data) {
        setDashboardData(dashboardResponse.data);
      } else if (dashboardResponse.error) {
        console.warn('Dashboard stats error:', dashboardResponse.error);
      }
      
      if (comprehensiveResponse.success && comprehensiveResponse.data) {
        setComprehensiveStats(comprehensiveResponse.data);
      } else if (comprehensiveResponse.error) {
        console.warn('Comprehensive stats error:', comprehensiveResponse.error);
      }

      // Set error only if both requests fail
      if (!dashboardResponse.success && !comprehensiveResponse.success) {
        setError(dashboardResponse.error || comprehensiveResponse.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    dashboardData,
    comprehensiveStats,
    isLoading,
    error,
    refetch: fetchDashboardData,
  };
};
