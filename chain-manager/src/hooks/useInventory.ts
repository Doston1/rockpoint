import { useCallback, useEffect, useState } from 'react';
import apiService, { BranchInventory } from '../services/api';

interface UseInventoryReturn {
  inventory: BranchInventory[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateInventory: (branchId: string, productId: string, data: Partial<BranchInventory>) => Promise<BranchInventory | null>;
}

export const useInventory = (branchId: string): UseInventoryReturn => {
  const [inventory, setInventory] = useState<BranchInventory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    if (!branchId) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getBranchInventory(branchId);
      
      if (response.success && response.data) {
        setInventory(response.data.inventory);
      } else {
        setError(response.error || 'Failed to fetch inventory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  const updateInventory = useCallback(async (
    branchId: string, 
    productId: string, 
    data: Partial<BranchInventory>
  ): Promise<BranchInventory | null> => {
    try {
      const response = await apiService.updateInventory(branchId, productId, data);
      
      if (response.success && response.data) {
        setInventory(prev => 
          prev.map(item => 
            item.branchId === branchId && item.productId === productId 
              ? response.data! 
              : item
          )
        );
        return response.data;
      } else {
        setError(response.error || 'Failed to update inventory');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return {
    inventory,
    isLoading,
    error,
    refetch: fetchInventory,
    updateInventory,
  };
};
