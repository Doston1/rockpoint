import { useCallback, useEffect, useState } from 'react';
import apiService, { Category, Product } from '../services/api';

interface UseProductsReturn {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createProduct: (productData: Partial<Product>) => Promise<Product | null>;
  updateProduct: (id: string, productData: Partial<Product>) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  createCategory: (categoryData: Partial<Category>) => Promise<Category | null>;
}

interface UseProductsFilters {
  category?: string;
  branchId?: string;
  isActive?: boolean;
  search?: string;
}

export const useProducts = (filters?: UseProductsFilters): UseProductsReturn => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [productsResponse, categoriesResponse] = await Promise.all([
        apiService.getProducts(filters),
        apiService.getCategories()
      ]);
      
      if (productsResponse.success && productsResponse.data) {
        setProducts(productsResponse.data.products);
      } else {
        setError(productsResponse.error || 'Failed to fetch products');
      }

      if (categoriesResponse.success && categoriesResponse.data) {
        setCategories(categoriesResponse.data.categories);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [filters?.category, filters?.branchId, filters?.isActive, filters?.search]);

  const createProduct = useCallback(async (productData: Partial<Product>): Promise<Product | null> => {
    try {
      const response = await apiService.createProduct(productData);
      
      if (response.success && response.data) {
        setProducts(prev => [...prev, response.data!]);
        return response.data;
      } else {
        setError(response.error || 'Failed to create product');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const updateProduct = useCallback(async (id: string, productData: Partial<Product>): Promise<Product | null> => {
    try {
      const response = await apiService.updateProduct(id, productData);
      
      if (response.success && response.data) {
        setProducts(prev => 
          prev.map(product => 
            product.id === id ? response.data! : product
          )
        );
        return response.data;
      } else {
        setError(response.error || 'Failed to update product');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiService.deleteProduct(id);
      
      if (response.success) {
        setProducts(prev => prev.filter(product => product.id !== id));
        return true;
      } else {
        setError(response.error || 'Failed to delete product');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  const createCategory = useCallback(async (categoryData: Partial<Category>): Promise<Category | null> => {
    try {
      const response = await apiService.createCategory(categoryData);
      
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
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    categories,
    isLoading,
    error,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
  };
};
