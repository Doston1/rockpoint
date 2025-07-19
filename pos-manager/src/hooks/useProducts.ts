import { useCallback, useState } from 'react';
import type { ApiResponse, Product } from '../services/api';
import { apiService } from '../services/api';

export interface UseProductsReturn {
  products: Product[];
  loading: boolean;
  error: string | null;
  searchProducts: (query: string, limit?: number, offset?: number) => Promise<Product[]>;
  getProductByBarcode: (barcode: string) => Promise<Product | null>;
  getAllProducts: () => Promise<Product[]>;
  createProduct: (product: Partial<Product>) => Promise<Product | null>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  getLowStockProducts: () => Promise<Product[]>;
  clearError: () => void;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const searchProducts = useCallback(async (query: string, limit = 20, offset = 0): Promise<Product[]> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Product[]> = await apiService.searchProducts(query, limit, offset);
      
      if (response.success && response.data) {
        setProducts(response.data);
        return response.data;
      } else {
        const errorMsg = response.error || 'Failed to search products';
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

  const getProductByBarcode = useCallback(async (barcode: string): Promise<Product | null> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Product> = await apiService.getProductByBarcode(barcode);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        const errorMsg = response.error || 'Product not found';
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

  const getAllProducts = useCallback(async (): Promise<Product[]> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Product[]> = await apiService.getAllProducts();
      
      if (response.success && response.data) {
        setProducts(response.data);
        return response.data;
      } else {
        const errorMsg = response.error || 'Failed to load products';
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

  const createProduct = useCallback(async (product: Partial<Product>): Promise<Product | null> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Product> = await apiService.createProduct(product);
      
      if (response.success && response.data) {
        // Add to local state
        setProducts(prev => [response.data!, ...prev]);
        return response.data;
      } else {
        const errorMsg = response.error || 'Failed to create product';
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

  const updateProduct = useCallback(async (id: string, product: Partial<Product>): Promise<Product | null> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Product> = await apiService.updateProduct(id, product);
      
      if (response.success && response.data) {
        // Update local state
        setProducts(prev => 
          prev.map(p => p.id === id ? response.data! : p)
        );
        return response.data;
      } else {
        const errorMsg = response.error || 'Failed to update product';
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

  const deleteProduct = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse = await apiService.deleteProduct(id);
      
      if (response.success) {
        // Remove from local state
        setProducts(prev => prev.filter(p => p.id !== id));
        return true;
      } else {
        const errorMsg = response.error || 'Failed to delete product';
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

  const getLowStockProducts = useCallback(async (): Promise<Product[]> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Product[]> = await apiService.getLowStockProducts();
      
      if (response.success && response.data) {
        return response.data;
      } else {
        const errorMsg = response.error || 'Failed to load low stock products';
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

  return {
    products,
    loading,
    error,
    searchProducts,
    getProductByBarcode,
    getAllProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
    clearError,
  };
}
