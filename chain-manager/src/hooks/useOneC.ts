import { useCallback, useEffect, useState } from 'react';
import apiService, { OneCSync } from '../services/api';

interface UseOneCReturn {
  syncStatus: OneCSync[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  triggerSync: (syncType: OneCSync['syncType'], direction?: OneCSync['direction']) => Promise<boolean>;
}

export const useOneC = (): UseOneCReturn => {
  const [syncStatus, setSyncStatus] = useState<OneCSync[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSyncStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getOneCStatus();
      
      if (response.success && response.data) {
        setSyncStatus(response.data);
      } else {
        setError(response.error || 'Failed to fetch 1C sync status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerSync = useCallback(async (
    syncType: OneCSync['syncType'], 
    direction: OneCSync['direction'] = 'import'
  ): Promise<boolean> => {
    try {
      const response = await apiService.triggerSync(syncType, direction);
      
      if (response.success && response.data) {
        // Add the new sync to the status list
        setSyncStatus(prev => [response.data!, ...prev]);
        return true;
      } else {
        setError(response.error || 'Failed to trigger sync');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  return {
    syncStatus,
    isLoading,
    error,
    refetch: fetchSyncStatus,
    triggerSync,
  };
};
