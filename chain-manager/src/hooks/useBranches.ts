import { useCallback, useEffect, useState } from 'react';
import apiService, { Branch } from '../services/api';

interface UseBranchesReturn {
  branches: Branch[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createBranch: (branchData: Partial<Branch>) => Promise<Branch | null>;
  updateBranch: (id: string, branchData: Partial<Branch>) => Promise<Branch | null>;
  deleteBranch: (id: string) => Promise<boolean>;
}

export const useBranches = (): UseBranchesReturn => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getBranches();
      
      if (response.success && response.data) {
        setBranches(response.data.branches);
      } else {
        setError(response.error || 'Failed to fetch branches');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBranch = useCallback(async (branchData: Partial<Branch>): Promise<Branch | null> => {
    try {
      const response = await apiService.createBranch(branchData);
      
      if (response.success && response.data) {
        setBranches(prev => [...prev, response.data!]);
        return response.data;
      } else {
        setError(response.error || 'Failed to create branch');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const updateBranch = useCallback(async (id: string, branchData: Partial<Branch>): Promise<Branch | null> => {
    try {
      const response = await apiService.updateBranch(id, branchData);
      
      if (response.success && response.data) {
        setBranches(prev => 
          prev.map(branch => 
            branch.id === id ? response.data! : branch
          )
        );
        return response.data;
      } else {
        setError(response.error || 'Failed to update branch');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const deleteBranch = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiService.deleteBranch(id);
      
      if (response.success) {
        setBranches(prev => prev.filter(branch => branch.id !== id));
        return true;
      } else {
        setError(response.error || 'Failed to delete branch');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  return {
    branches,
    isLoading,
    error,
    refetch: fetchBranches,
    createBranch,
    updateBranch,
    deleteBranch,
  };
};
