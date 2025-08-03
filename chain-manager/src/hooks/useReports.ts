import { useCallback, useState } from 'react';
import apiService from '../services/api';

interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  branchIds?: string[];
  employeeIds?: string[];
}

interface UseReportsReturn {
  salesReport: any;
  inventoryReport: any;
  isLoading: boolean;
  error: string | null;
  generateSalesReport: (filters: ReportFilters) => Promise<void>;
  generateInventoryReport: (branchId?: string) => Promise<void>;
}

export const useReports = (): UseReportsReturn => {
  const [salesReport, setSalesReport] = useState<any>(null);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSalesReport = useCallback(async (filters: ReportFilters) => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  const generateInventoryReport = useCallback(async (branchId?: string) => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  return {
    salesReport,
    inventoryReport,
    isLoading,
    error,
    generateSalesReport,
    generateInventoryReport,
  };
};
