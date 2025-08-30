import { useCallback, useEffect, useState } from 'react';
import apiService, { Category } from '../services/api';

interface UseCategoriesReturn {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCategory: (data: Omit<Category, 'id'>) => Promise<Category | null>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<Category | null>;
  deleteCategory: (id: string) => Promise<boolean>;
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

  const updateCategory = useCallback(async (id: string, data: Partial<Category>): Promise<Category | null> => {
    try {
      const response = await apiService.updateCategory(id, data);
      
      if (response.success && response.data) {
        setCategories(prev => prev.map(cat => cat.id === id ? response.data! : cat));
        return response.data;
      } else {
        setError(response.error || 'Failed to update category');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiService.deleteCategory(id);
      
      if (response.success) {
        setCategories(prev => prev.filter(cat => cat.id !== id));
        return true;
      } else {
        setError(response.error || 'Failed to delete category');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
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
    updateCategory,
    deleteCategory,
  };
};
