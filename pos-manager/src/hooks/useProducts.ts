import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiResponse, Product } from '../services/api';
import { apiService } from '../services/api';

// Helper function to convert string prices to numbers
const normalizeProduct = (product: any): Product => ({
  ...product,
  price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
  cost: typeof product.cost === 'string' ? parseFloat(product.cost) : product.cost,
});

const normalizeProducts = (products: any[]): Product[] => 
  products.map(normalizeProduct);

export interface UseProductsReturn {
  products: Product[];
  categories: { key: string; name: string; product_count: number }[];
  searchSuggestions: Product[];
  loading: boolean;
  error: string | null;
  searchProducts: (query: string, limit?: number, offset?: number) => Promise<Product[]>;
  searchProductsForAutoComplete: (query: string) => Promise<Product[]>;
  getProductByBarcode: (barcode: string) => Promise<Product | null>;
  getAllProducts: () => Promise<Product[]>;
  getCategories: () => Promise<{ key: string; name: string; product_count: number }[]>;
  getProductsByCategory: (category: string, limit?: number, offset?: number) => Promise<Product[]>;
  createProduct: (product: Partial<Product>) => Promise<Product | null>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  getLowStockProducts: () => Promise<Product[]>;
  clearError: () => void;
  clearSearchSuggestions: () => void;
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ key: string; name: string; product_count: number }[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { i18n } = useTranslation();

  // Cache for search results to avoid repeated API calls
  const searchCache = useRef<Map<string, { products: Product[]; timestamp: number }>>(new Map());
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const MAX_CACHE_SIZE = 50; // Maximum cache entries
  const MIN_SEARCH_LENGTH = 2;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearSearchSuggestions = useCallback(() => {
    setSearchSuggestions([]);
  }, []);

  // Cache cleanup function
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const cache = searchCache.current;
    
    // Remove expired entries
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        cache.delete(key);
      }
    }
    
    // If still too large, remove oldest entries
    if (cache.size > MAX_CACHE_SIZE) {
      const sortedEntries = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = sortedEntries.slice(0, cache.size - MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => cache.delete(key));
    }
  }, [CACHE_DURATION, MAX_CACHE_SIZE]);

  // Check if cached result is still valid
  const isCacheValid = useCallback((timestamp: number): boolean => {
    return Date.now() - timestamp < CACHE_DURATION;
  }, [CACHE_DURATION]);

  // Debounced search for autocomplete
  const searchProductsForAutoComplete = useCallback(async (query: string): Promise<Product[]> => {
    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Clear suggestions if query is too short
    if (query.length < MIN_SEARCH_LENGTH) {
      setSearchSuggestions([]);
      return [];
    }

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    const cached = searchCache.current.get(cacheKey);
    
    if (cached && isCacheValid(cached.timestamp)) {
      setSearchSuggestions(cached.products);
      return cached.products;
    }

    // Debounce the API call
    return new Promise((resolve) => {
      searchTimeout.current = setTimeout(async () => {
        try {
          const response: ApiResponse<{ products: Product[] }> = 
            await apiService.autocompleteProducts(query.trim(), 8, i18n.language);
          
          if (response.success && response.data && response.data.products) {
            const normalizedProducts = normalizeProducts(response.data.products);
            
            // Clean up cache before adding new entry
            cleanupCache();
            
            // Cache the result
            searchCache.current.set(cacheKey, {
              products: normalizedProducts,
              timestamp: Date.now()
            });
            
            setSearchSuggestions(normalizedProducts);
            resolve(normalizedProducts);
          } else {
            setSearchSuggestions([]);
            resolve([]);
          }
        } catch (err: any) {
          console.error('Auto-complete search failed:', err);
          setSearchSuggestions([]);
          resolve([]);
        }
      }, 250); // Reduced debounce to 250ms for faster response
    });
  }, [MIN_SEARCH_LENGTH, CACHE_DURATION, isCacheValid, cleanupCache]);

  const searchProducts = useCallback(async (query: string, limit = 20, offset = 0): Promise<Product[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.searchProducts(query, { 
        limit, 
        offset,
        language: i18n.language 
      });
      
      if (response.success && response.data && response.data.products) {
        const normalizedProducts = normalizeProducts(response.data.products);
        setProducts(normalizedProducts);
        return normalizedProducts;
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
  }, [i18n.language]);

  const getProductByBarcode = useCallback(async (barcode: string): Promise<Product | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getProductByBarcode(barcode, i18n.language);
      
      if (response.success && response.data && response.data.product) {
        const normalizedProduct = normalizeProduct(response.data.product);
        return normalizedProduct;
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
  }, [i18n.language]);

  const getAllProducts = useCallback(async (): Promise<Product[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getAllProducts({ 
        limit: 100, 
        language: i18n.language 
      });
      
      if (response.success && response.data && response.data.products) {
        const normalizedProducts = normalizeProducts(response.data.products);
        setProducts(normalizedProducts);
        return normalizedProducts;
      } else {
        const errorMsg = response.error || 'Failed to fetch products';
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
  }, [i18n.language]);

  const createProduct = useCallback(async (product: Partial<Product>): Promise<Product | null> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<Product> = await apiService.createProduct(product);
      
      if (response.success && response.data) {
        const normalizedProduct = normalizeProduct(response.data);
        // Add to local state
        setProducts(prev => [normalizedProduct, ...prev]);
        return normalizedProduct;
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
        const normalizedProduct = normalizeProduct(response.data);
        // Update local state
        setProducts(prev => 
          prev.map(p => p.id === id ? normalizedProduct : p)
        );
        return normalizedProduct;
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
      const response: ApiResponse<Product[]> = await apiService.getLowStockProducts(i18n.language);
      
      if (response.success && response.data) {
        const normalizedProducts = normalizeProducts(response.data);
        return normalizedProducts;
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

  const getCategories = useCallback(async (): Promise<{ key: string; name: string; product_count: number }[]> => {
    setLoading(true);
    setError(null);

    try {
      const response: ApiResponse<{ categories: { key: string; name: string; product_count: number }[] }> = await apiService.getCategories(i18n.language);
      
      if (response.success && response.data) {
        setCategories(response.data.categories);
        return response.data.categories;
      } else {
        const errorMsg = response.error || 'Failed to load categories';
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
  }, [i18n.language]);

  const getProductsByCategory = useCallback(async (category: string, limit = 50, offset = 0): Promise<Product[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.getProductsByCategory(category, { 
        limit, 
        offset,
        language: i18n.language 
      });
      
      if (response.success && response.data && response.data.products) {
        const normalizedProducts = normalizeProducts(response.data.products);
        setProducts(normalizedProducts);
        return normalizedProducts;
      } else {
        const errorMsg = response.error || 'Failed to load products by category';
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
  }, [i18n.language]);

  // Refresh products when language changes
  useEffect(() => {
    if (products.length > 0) {
      getAllProducts();
    }
  }, [i18n.language]); // Remove getAllProducts from dependencies

  return {
    products,
    categories,
    searchSuggestions,
    loading,
    error,
    searchProducts,
    searchProductsForAutoComplete,
    getProductByBarcode,
    getAllProducts,
    getCategories,
    getProductsByCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
    clearError,
    clearSearchSuggestions,
  };
}
