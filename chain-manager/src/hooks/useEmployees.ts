import { useCallback, useEffect, useState } from 'react';
import apiService, { Employee } from '../services/api';

export interface TimeLog {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out?: string;
  hours_worked?: number;
  break_minutes?: number;
  notes?: string;
  terminal_id?: string;
  is_clocked_in?: boolean;
  created_at: string;
}

interface UseEmployeesReturn {
  employees: Employee[];
  selectedEmployee: Employee | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getEmployee: (id: string) => Promise<Employee | null>;
  createEmployee: (employeeData: Partial<Employee>) => Promise<Employee | null>;
  updateEmployee: (id: string, employeeData: Partial<Employee>) => Promise<Employee | null>;
  deleteEmployee: (id: string) => Promise<boolean>;
  getEmployeeTimeLogs: (employeeId: string, startDate?: string, endDate?: string) => Promise<TimeLog[]>;
  getEmployeeStats: (employeeId: string, month?: string, year?: string) => Promise<any>;
  clearError: () => void;
}

interface UseEmployeesFilters {
  branchId?: string;
  role?: Employee['role'];
  status?: Employee['status'];
}

export const useEmployees = (filters?: UseEmployeesFilters): UseEmployeesReturn => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getEmployees(filters?.branchId);
      
      if (response.success && response.data) {
        let filteredEmployees = response.data.employees;
        
        // Apply client-side filters
        if (filters?.role) {
          filteredEmployees = filteredEmployees.filter(emp => emp.role === filters.role);
        }
        
        if (filters?.status) {
          filteredEmployees = filteredEmployees.filter(emp => emp.status === filters.status);
        }
        
        setEmployees(filteredEmployees);
      } else {
        setError(response.error || 'Failed to fetch employees');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [filters?.branchId, filters?.role, filters?.status]);

  const getEmployee = useCallback(async (id: string): Promise<Employee | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getEmployee(id);
      
      if (response.success && response.data) {
        setSelectedEmployee(response.data);
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch employee');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getEmployeeTimeLogs = useCallback(async (employeeId: string, startDate?: string, endDate?: string): Promise<TimeLog[]> => {
    try {
      setError(null);
      
      const response = await apiService.getEmployeeTimeLogs(employeeId, startDate, endDate);
      
      if (response.success && response.data) {
        return response.data.timeLogs || [];
      } else {
        setError(response.error || 'Failed to fetch time logs');
        return [];
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return [];
    }
  }, []);

  const getEmployeeStats = useCallback(async (employeeId: string, month?: string, year?: string): Promise<any> => {
    try {
      setError(null);
      
      const response = await apiService.getEmployeeStats(employeeId, month, year);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch employee stats');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createEmployee = useCallback(async (employeeData: Partial<Employee>): Promise<Employee | null> => {
    try {
      const response = await apiService.createEmployee(employeeData);
      
      if (response.success && response.data) {
        setEmployees(prev => [...prev, response.data!]);
        return response.data;
      } else {
        setError(response.error || 'Failed to create employee');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const updateEmployee = useCallback(async (id: string, employeeData: Partial<Employee>): Promise<Employee | null> => {
    try {
      const response = await apiService.updateEmployee(id, employeeData);
      
      if (response.success && response.data) {
        setEmployees(prev => 
          prev.map(employee => 
            employee.id === id ? response.data! : employee
          )
        );
        return response.data;
      } else {
        setError(response.error || 'Failed to update employee');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const deleteEmployee = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiService.deleteEmployee(id);
      
      if (response.success) {
        setEmployees(prev => prev.filter(employee => employee.id !== id));
        return true;
      } else {
        setError(response.error || 'Failed to delete employee');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    selectedEmployee,
    isLoading,
    error,
    refetch: fetchEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeTimeLogs,
    getEmployeeStats,
    clearError,
  };
};
