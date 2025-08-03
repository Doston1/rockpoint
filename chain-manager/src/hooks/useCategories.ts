import { useCallback, useEffect, useState } from 'react';
import apiService, { Category } from '../services/api';

interface UseCategoriesReturn {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCategory: (data: Omit<Category, 'id'>) => Promise<Category | null>;
}

export const useCategories = (): UseCategoriesReturn => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getCategories();
      
      if (response.success && response.data) {
        setCategories(response.data.categories);
      } else {
        setError(response.error || 'Failed to fetch categories');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (data: Omit<Category, 'id'>): Promise<Category | null> => {
    try {
      const response = await apiService.createCategory(data);
      
      if (response.success && response.data) {
        setCategories(prev => [...prev, response.data!]);
        return response.data;
      } else {
        setError(response.error || 'Failed to create category');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
    createCategory,
  };
};
