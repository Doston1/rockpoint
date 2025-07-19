import { useCallback, useState } from 'react';
import type { ApiResponse, Transaction } from '../services/api';
import { apiService } from '../services/api';

export interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  createTransaction: (transactionData: Partial<Transaction>) => Promise<Transaction | null>;
  getTransactions: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    employeeId?: string;
    terminalId?: string;
  }) => Promise<Transaction[]>;
  getTransactionById: (id: string) => Promise<Transaction | null>;
  voidTransaction: (id: string, reason: string) => Promise<boolean>;
  refundTransaction: (id: string, reason: string) => Promise<boolean>;
  clearError: () => void;
}

export function useTransactions(): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createTransaction = useCallback(async (transactionData: Partial<Transaction>): Promise<Transaction | null> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Transaction> = await apiService.createTransaction(transactionData);
      
      if (response.success && response.data) {
        // Add to local state
        setTransactions(prev => [response.data!, ...prev]);
        return response.data;
      } else {
        const errorMsg = response.error || 'Failed to create transaction';
        setError(errorMsg);
        return null;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network error occurred';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTransactions = useCallback(async (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    employeeId?: string;
    terminalId?: string;
  }): Promise<Transaction[]> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Transaction[]> = await apiService.getTransactions(params);
      
      if (response.success && response.data) {
        setTransactions(response.data);
        return response.data;
      } else {
        const errorMsg = response.error || 'Failed to load transactions';
        setError(errorMsg);
        return [];
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network error occurred';
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getTransactionById = useCallback(async (id: string): Promise<Transaction | null> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Transaction> = await apiService.getTransactionById(id);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        const errorMsg = response.error || 'Transaction not found';
        setError(errorMsg);
        return null;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network error occurred';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const voidTransaction = useCallback(async (id: string, reason: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse = await apiService.voidTransaction(id, reason);
      
      if (response.success) {
        // Update local state
        setTransactions(prev => 
          prev.map(t => 
            t.id === id 
              ? { ...t, status: 'voided' as const, void_reason: reason }
              : t
          )
        );
        return true;
      } else {
        const errorMsg = response.error || 'Failed to void transaction';
        setError(errorMsg);
        return false;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network error occurred';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const refundTransaction = useCallback(async (id: string, reason: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse = await apiService.refundTransaction(id, reason);
      
      if (response.success) {
        // Update local state
        setTransactions(prev => 
          prev.map(t => 
            t.id === id 
              ? { ...t, status: 'refunded' as const }
              : t
          )
        );
        return true;
      } else {
        const errorMsg = response.error || 'Failed to refund transaction';
        setError(errorMsg);
        return false;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network error occurred';
      setError(errorMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    createTransaction,
    getTransactions,
    getTransactionById,
    voidTransaction,
    refundTransaction,
    clearError,
  };
}
