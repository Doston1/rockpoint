import { useCallback, useEffect, useState } from 'react';
import apiService, { BranchInventory, Product, Promotion } from '../services/api';

interface UseInventoryManagementReturn {
  // General inventory
  generalInventory: BranchInventory[];
  branchInventory: BranchInventory[];
  products: Product[];
  promotions: Promotion[];
  
  // Loading states
  isLoadingGeneral: boolean;
  isLoadingBranch: boolean;
  isLoadingProducts: boolean;
  isLoadingPromotions: boolean;
  
  // Error states
  error: string | null;
  
  // Selected branch
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string | null) => void;
  
  // Actions
  refetchGeneral: () => Promise<void>;
  refetchBranch: () => Promise<void>;
  refetchProducts: () => Promise<void>;
  refetchPromotions: () => Promise<void>;
  
  // Product management
  createProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product | null>;
  updateProduct: (productId: string, data: Partial<Product>) => Promise<Product | null>;
  deleteProduct: (productId: string) => Promise<boolean>;
  
  // Inventory management
  updateInventory: (branchId: string, productId: string, data: Partial<BranchInventory>) => Promise<BranchInventory | null>;
  
  // Promotion management
  createPromotion: (branchId: string, data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Promotion | null>;
  updatePromotion: (promotionId: string, data: Partial<Promotion>) => Promise<Promotion | null>;
  deletePromotion: (promotionId: string) => Promise<boolean>;
  
  // Sync operations
  syncProducts: (branchId: string) => Promise<boolean>;
  syncPrices: (branchId: string) => Promise<boolean>;
  syncPromotions: (branchId: string) => Promise<boolean>;
}

export const useInventoryManagement = (): UseInventoryManagementReturn => {
  // State
  const [generalInventory, setGeneralInventory] = useState<BranchInventory[]>([]);
  const [branchInventory, setBranchInventory] = useState<BranchInventory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  
  const [isLoadingGeneral, setIsLoadingGeneral] = useState(false);
  const [isLoadingBranch, setIsLoadingBranch] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Fetch general inventory
  const fetchGeneralInventory = useCallback(async () => {
    try {
      setIsLoadingGeneral(true);
      setError(null);
      
      const response = await apiService.getGeneralInventory();
      
      if (response.success && response.data) {
        setGeneralInventory(response.data.inventory);
      } else {
        setError(response.error || 'Failed to fetch general inventory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingGeneral(false);
    }
  }, []);

  // Fetch branch inventory
  const fetchBranchInventory = useCallback(async () => {
    if (!selectedBranchId) {
      setBranchInventory([]);
      return;
    }

    try {
      setIsLoadingBranch(true);
      setError(null);
      
      const response = await apiService.getBranchInventory(selectedBranchId);
      
      if (response.success && response.data) {
        setBranchInventory(response.data.inventory);
      } else {
        setError(response.error || 'Failed to fetch branch inventory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingBranch(false);
    }
  }, [selectedBranchId]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoadingProducts(true);
      setError(null);
      
      const response = await apiService.getProducts();
      
      if (response.success && response.data) {
        setProducts(response.data.products);
      } else {
        setError(response.error || 'Failed to fetch products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  // Fetch promotions
  const fetchPromotions = useCallback(async () => {
    if (!selectedBranchId) {
      setPromotions([]);
      return;
    }

    try {
      setIsLoadingPromotions(true);
      setError(null);
      
      const response = await apiService.getBranchPromotions(selectedBranchId);
      
      if (response.success && response.data) {
        setPromotions(response.data.promotions);
      } else {
        setError(response.error || 'Failed to fetch promotions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingPromotions(false);
    }
  }, [selectedBranchId]);

  // Product management
  const createProduct = useCallback(async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product | null> => {
    try {
      const response = await apiService.createProduct(data);
      
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

  const updateProduct = useCallback(async (productId: string, data: Partial<Product>): Promise<Product | null> => {
    try {
      const response = await apiService.updateProduct(productId, data);
      
      if (response.success && response.data) {
        setProducts(prev => prev.map(p => p.id === productId ? response.data! : p));
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

  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    try {
      const response = await apiService.deleteProduct(productId);
      
      if (response.success) {
        setProducts(prev => prev.filter(p => p.id !== productId));
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

  // Inventory management
  const updateInventory = useCallback(async (
    branchId: string, 
    productId: string, 
    data: Partial<BranchInventory>
  ): Promise<BranchInventory | null> => {
    try {
      const response = await apiService.updateInventory(branchId, productId, data);
      
      if (response.success && response.data) {
        // Update the appropriate inventory state
        if (branchId === selectedBranchId) {
          setBranchInventory(prev => 
            prev.map(item => 
              item.productId === productId ? response.data! : item
            )
          );
        }
        // Also update general inventory if it contains this item
        setGeneralInventory(prev => 
          prev.map(item => 
            item.branchId === branchId && item.productId === productId ? response.data! : item
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
  }, [selectedBranchId]);

  // Promotion management
  const createPromotion = useCallback(async (
    branchId: string, 
    data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Promotion | null> => {
    try {
      const response = await apiService.createPromotion(branchId, data);
      
      if (response.success && response.data) {
        if (branchId === selectedBranchId) {
          setPromotions(prev => [...prev, response.data!]);
        }
        return response.data;
      } else {
        setError(response.error || 'Failed to create promotion');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, [selectedBranchId]);

  const updatePromotion = useCallback(async (
    promotionId: string, 
    data: Partial<Promotion>
  ): Promise<Promotion | null> => {
    try {
      const response = await apiService.updatePromotion(promotionId, data);
      
      if (response.success && response.data) {
        setPromotions(prev => prev.map(p => p.id === promotionId ? response.data! : p));
        return response.data;
      } else {
        setError(response.error || 'Failed to update promotion');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, []);

  const deletePromotion = useCallback(async (promotionId: string): Promise<boolean> => {
    try {
      const response = await apiService.deletePromotion(promotionId);
      
      if (response.success) {
        setPromotions(prev => prev.filter(p => p.id !== promotionId));
        return true;
      } else {
        setError(response.error || 'Failed to delete promotion');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  // Sync operations
  const syncProducts = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      const response = await apiService.syncProductsToBranch(branchId);
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  const syncPrices = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      const response = await apiService.syncPricesToBranch(branchId);
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  const syncPromotions = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      const response = await apiService.syncPromotionsToBranch(branchId);
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, []);

  // Effects
  useEffect(() => {
    fetchGeneralInventory();
    fetchProducts();
  }, [fetchGeneralInventory, fetchProducts]);

  useEffect(() => {
    fetchBranchInventory();
    fetchPromotions();
  }, [fetchBranchInventory, fetchPromotions]);

  return {
    // Data
    generalInventory,
    branchInventory,
    products,
    promotions,
    
    // Loading states
    isLoadingGeneral,
    isLoadingBranch,
    isLoadingProducts,
    isLoadingPromotions,
    
    // Error state
    error,
    
    // Selected branch
    selectedBranchId,
    setSelectedBranchId,
    
    // Actions
    refetchGeneral: fetchGeneralInventory,
    refetchBranch: fetchBranchInventory,
    refetchProducts: fetchProducts,
    refetchPromotions: fetchPromotions,
    
    // Product management
    createProduct,
    updateProduct,
    deleteProduct,
    
    // Inventory management
    updateInventory,
    
    // Promotion management
    createPromotion,
    updatePromotion,
    deletePromotion,
    
    // Sync operations
    syncProducts,
    syncPrices,
    syncPromotions,
  };
};
