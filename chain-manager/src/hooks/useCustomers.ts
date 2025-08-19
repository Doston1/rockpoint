import { useCallback, useEffect, useState } from 'react';
import apiService, { Customer } from '../services/api';

interface UseCustomersOptions {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
  is_vip?: boolean;
  autoFetch?: boolean;
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    page = 1,
    limit = 50,
    search = '',
    is_active = true,
    is_vip,
    autoFetch = true
  } = options;

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getCustomers({
        page,
        limit,
        search: search || undefined,
        is_active,
        is_vip
      });

      if (response.success && response.data) {
        setCustomers(response.data.customers);
        setPagination(response.pagination || {});
      } else {
        setError(response.error || 'Failed to fetch customers');
        setCustomers([]);
      }
    } catch (error) {
      setError('Network error occurred while fetching customers');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, is_active, is_vip]);

  const getCustomer = useCallback(async (id: string, includeTransactions = false): Promise<Customer | null> => {
    try {
      const response = await apiService.getCustomer(id, includeTransactions);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Failed to fetch customer');
        return null;
      }
    } catch (error) {
      setError('Network error occurred while fetching customer');
      return null;
    }
  }, []);

  const createCustomer = useCallback(async (customerData: Partial<Customer>): Promise<boolean> => {
    try {
      const response = await apiService.createCustomer(customerData);
      if (response.success) {
        // Refresh the list
        await fetchCustomers();
        return true;
      } else {
        setError(response.error || 'Failed to create customer');
        return false;
      }
    } catch (error) {
      setError('Network error occurred while creating customer');
      return false;
    }
  }, [fetchCustomers]);

  const updateCustomer = useCallback(async (id: string, customerData: Partial<Customer>): Promise<boolean> => {
    try {
      const response = await apiService.updateCustomer(id, customerData);
      if (response.success) {
        // Update the customer in the list
        setCustomers(prev => prev.map(customer => 
          customer.id === id ? { ...customer, ...customerData } : customer
        ));
        return true;
      } else {
        setError(response.error || 'Failed to update customer');
        return false;
      }
    } catch (error) {
      setError('Network error occurred while updating customer');
      return false;
    }
  }, []);

  const deleteCustomer = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiService.deleteCustomer(id);
      if (response.success) {
        // Remove customer from list or mark as inactive
        setCustomers(prev => prev.map(customer => 
          customer.id === id ? { ...customer, is_active: false } : customer
        ));
        return true;
      } else {
        setError(response.error || 'Failed to delete customer');
        return false;
      }
    } catch (error) {
      setError('Network error occurred while deleting customer');
      return false;
    }
  }, []);

  const activateCustomer = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiService.activateCustomer(id);
      if (response.success) {
        // Update customer status in list
        setCustomers(prev => prev.map(customer => 
          customer.id === id ? { ...customer, is_active: true } : customer
        ));
        return true;
      } else {
        setError(response.error || 'Failed to activate customer');
        return false;
      }
    } catch (error) {
      setError('Network error occurred while activating customer');
      return false;
    }
  }, []);

  const getCustomerTransactions = useCallback(async (
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
  ) => {
    try {
      const response = await apiService.getCustomerTransactions(id, filters);
      if (response.success && response.data) {
        return {
          customer: response.data.customer,
          transactions: response.data.transactions,
          pagination: response.pagination
        };
      } else {
        setError(response.error || 'Failed to fetch customer transactions');
        return null;
      }
    } catch (error) {
      setError('Network error occurred while fetching customer transactions');
      return null;
    }
  }, []);

  const refetch = useCallback(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchCustomers();
    }
  }, [fetchCustomers, autoFetch]);

  return {
    customers,
    pagination,
    isLoading,
    error,
    fetchCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    activateCustomer,
    getCustomerTransactions,
    refetch,
    clearError
  };
}
