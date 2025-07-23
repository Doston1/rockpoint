import { useCallback, useState } from 'react';
import { apiService, type Employee, type TimeLog } from '../services/api';

export interface CreateEmployeeData {
  employee_id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'supervisor';
  pin: string;
  hire_date?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface UpdateEmployeeData {
  name?: string;
  role?: 'admin' | 'manager' | 'cashier' | 'supervisor';
  status?: 'active' | 'inactive' | 'suspended';
  hire_date?: string;
}

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeSchedule, setEmployeeSchedule] = useState<TimeLog[]>([]);
  const [todayHours, setTodayHours] = useState<TimeLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getAllEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getAllEmployees();
      if (response.success && response.data) {
        setEmployees(response.data.employees);
      } else {
        throw new Error(response.error || 'Failed to fetch employees');
      }
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      setError(error.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, []);

  const getEmployee = useCallback(async (employeeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getEmployee(employeeId);
      if (response.success && response.data) {
        setSelectedEmployee(response.data.employee);
        return response.data.employee;
      } else {
        throw new Error(response.error || 'Failed to fetch employee');
      }
    } catch (error: any) {
      console.error('Error fetching employee:', error);
      setError(error.message || 'Failed to fetch employee');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createEmployee = useCallback(async (employeeData: CreateEmployeeData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.createEmployee(employeeData);
      if (response.success && response.data) {
        await getAllEmployees(); // Refresh the list
        return response.data.employee;
      } else {
        throw new Error(response.error || 'Failed to create employee');
      }
    } catch (error: any) {
      console.error('Error creating employee:', error);
      setError(error.message || 'Failed to create employee');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAllEmployees]);

  const updateEmployee = useCallback(async (employeeId: string, updateData: UpdateEmployeeData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.updateEmployee(employeeId, updateData);
      if (response.success && response.data) {
        await getAllEmployees(); // Refresh the list
        return response.data.employee;
      } else {
        throw new Error(response.error || 'Failed to update employee');
      }
    } catch (error: any) {
      console.error('Error updating employee:', error);
      setError(error.message || 'Failed to update employee');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAllEmployees]);

  const deleteEmployee = useCallback(async (employeeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.deleteEmployee(employeeId);
      if (response.success && response.data) {
        await getAllEmployees(); // Refresh the list
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete employee');
      }
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      setError(error.message || 'Failed to delete employee');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getAllEmployees]);

  const changeEmployeePassword = useCallback(async (employeeId: string, newPin: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.changeEmployeePassword(employeeId, newPin);
      if (response.success && response.data) {
        return true;
      } else {
        throw new Error(response.error || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      setError(error.message || 'Failed to change password');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getEmployeeSchedule = useCallback(async (employeeId: string, startDate?: string, endDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getEmployeeSchedule(employeeId, startDate, endDate);
      if (response.success && response.data) {
        setEmployeeSchedule(response.data.schedule);
        return response.data.schedule;
      } else {
        throw new Error(response.error || 'Failed to fetch schedule');
      }
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
      setError(error.message || 'Failed to fetch schedule');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getTodayHours = useCallback(async (employeeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getTodayHours(employeeId);
      if (response.success && response.data) {
        setTodayHours(response.data.todayHours);
        return response.data.todayHours;
      } else {
        throw new Error(response.error || 'Failed to fetch today hours');
      }
    } catch (error: any) {
      console.error('Error fetching today hours:', error);
      setError(error.message || 'Failed to fetch today hours');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clockIn = useCallback(async (employeeId: string, terminalId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.clockIn(employeeId, terminalId);
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to clock in');
      }
    } catch (error: any) {
      console.error('Error clocking in:', error);
      setError(error.message || 'Failed to clock in');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clockOut = useCallback(async (employeeId: string, notes?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.clockOut(employeeId, notes);
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to clock out');
      }
    } catch (error: any) {
      console.error('Error clocking out:', error);
      setError(error.message || 'Failed to clock out');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    employees,
    selectedEmployee,
    employeeSchedule,
    todayHours,
    loading,
    error,
    clearError,
    getAllEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    changeEmployeePassword,
    getEmployeeSchedule,
    getTodayHours,
    clockIn,
    clockOut,
  };
};

// Re-export types for convenience
export type { Employee, TimeLog };

