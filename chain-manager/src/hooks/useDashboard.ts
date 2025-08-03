import { useCallback, useEffect, useState } from 'react';
import apiService, { DashboardStats } from '../services/api';

interface UseDashboardReturn {
  dashboardData: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useDashboard = (branchId?: string): UseDashboardReturn => {
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getDashboardStats(branchId);
      
      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        setError(response.error || 'Failed to fetch dashboard data');
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
    isLoading,
    error,
    refetch: fetchDashboardData,
  };
};
