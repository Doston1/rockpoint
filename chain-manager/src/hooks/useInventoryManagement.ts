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
      
      // Include branch_id in the request if a branch is selected
      const filters: any = {};
      if (selectedBranchId) {
        filters.branch_id = selectedBranchId;
      }
      
      const response = await apiService.getProducts(filters);
      
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
  }, [selectedBranchId]);

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
      // If we have a selected branch and the update includes pricing (basePrice or cost),
      // we should update branch-specific pricing instead of global product
      if (selectedBranchId && (data.basePrice !== undefined || data.cost !== undefined)) {
        // Create or update branch-specific pricing
        const branchPricingData = {
          branch_id: selectedBranchId,
          product_id: productId,
          price: data.basePrice,
          cost: data.cost,
        };
        
        // Try to update existing branch pricing first
        try {
          const existingPricing = await apiService.getBranchPricing(selectedBranchId, productId);
          
          if (existingPricing.success && existingPricing.data?.branch_pricing && existingPricing.data.branch_pricing.length > 0) {
            // Update existing branch pricing
            const pricingId = existingPricing.data.branch_pricing[0].id;
            
            const updateData: any = {};
            if (data.basePrice !== undefined) updateData.price = data.basePrice;
            if (data.cost !== undefined) updateData.cost = data.cost;
            
            const updateResult = await apiService.updateBranchPricing(pricingId, updateData);
            
            if (!updateResult.success) {
              throw new Error(`Failed to update branch pricing: ${updateResult.error}`);
            }
          } else {
            // Create new branch pricing
            const createResult = await apiService.createBranchPricing(branchPricingData);
            
            if (!createResult.success) {
              throw new Error(`Failed to create branch pricing: ${createResult.error}`);
            }
          }
        } catch (error) {
          console.error('Error managing branch pricing:', error);
          // Don't fall back to global update for pricing changes - this would be incorrect
          throw error;
        }
        
        // Remove pricing fields from global product update
        const { basePrice, cost, ...globalData } = data;
        
        // Update global product with non-pricing fields only
        if (Object.keys(globalData).length > 0) {
          const response = await apiService.updateProduct(productId, globalData);
          if (response.success && response.data) {
            setProducts(prev => {
              const updated = prev.map(p => p.id === productId ? { ...p, ...response.data! } : p);
              return updated;
            });
          }
        }
        
        // Refetch inventory to get updated branch pricing
        if (selectedBranchId) {
          await fetchBranchInventory();
        } else {
          await fetchGeneralInventory();
        }
        
        // Refetch products to get updated branch pricing
        await fetchProducts();
        
        // Return the updated product (we need to fetch it to get the latest data)
        const filters: any = {};
        if (selectedBranchId) {
          filters.branch_id = selectedBranchId;
        }
        const products = await apiService.getProducts(filters);
        if (products.success && products.data) {
          const updatedProduct = products.data.products.find((p: any) => p.id === productId);
          return updatedProduct || null;
        }
        
        return null;
      } else {
        // Regular global product update (when no branch selected or no pricing changes)
        const response = await apiService.updateProduct(productId, data);
        
        if (response.success && response.data) {
          // Update the local state with the returned product data
          setProducts(prev => {
            const updated = prev.map(p => p.id === productId ? { ...p, ...response.data! } : p);
            return updated;
          });
          return response.data;
        } else {
          setError(response.error || 'Failed to update product');
          return null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, [selectedBranchId, fetchBranchInventory, fetchGeneralInventory]);

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
      if (response.success) {
        // Refetch data to show updated products
        await Promise.all([
          fetchProducts(),
          selectedBranchId === branchId ? fetchBranchInventory() : Promise.resolve()
        ]);
      }
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, [fetchProducts, fetchBranchInventory, selectedBranchId]);

  const syncPrices = useCallback(async (branchId: string, forceAll: boolean = false): Promise<boolean> => {
    try {
      const response = await apiService.syncPricesToBranch(branchId, forceAll);
      if (response.success) {
        // Refetch data to show updated prices
        await Promise.all([
          fetchProducts(),
          selectedBranchId === branchId ? fetchBranchInventory() : Promise.resolve()
        ]);
      }
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, [fetchProducts, fetchBranchInventory, selectedBranchId]);

  const syncPromotions = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      const response = await apiService.syncPromotionsToBranch(branchId);
      if (response.success) {
        // Refetch promotions to show updated data
        if (selectedBranchId === branchId) {
          await fetchPromotions();
        }
      }
      return response.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  }, [fetchPromotions, selectedBranchId]);

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
