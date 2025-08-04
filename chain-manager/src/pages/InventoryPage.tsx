import {
  Add,
  Delete,
  Edit,
  Inventory,
  LocalOffer,
  MonetizationOn,
  PowerSettingsNew,
  Refresh,
  Search,
  Store,
  Sync,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridActionsCellItem, GridColDef } from '@mui/x-data-grid';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Import hooks and components
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { InventoryDialog } from '../components/inventory/InventoryDialog';
import { ProductDialog } from '../components/inventory/ProductDialog';
import { PromotionDialog } from '../components/inventory/PromotionDialog';
import { StockAdjustmentDialog } from '../components/inventory/StockAdjustmentDialog';
import { useCategories } from '../hooks';
import { useBranches } from '../hooks/useBranches';
import { useInventoryManagement } from '../hooks/useInventoryManagement';
import { BranchInventory, Product, Promotion } from '../services/api';

const InventoryPage = () => {
  const { t } = useTranslation();
  const { branches, isLoading: branchesLoading } = useBranches();
  const { categories } = useCategories();
  
  const {
    generalInventory,
    branchInventory,
    products,
    promotions,
    isLoadingGeneral,
    isLoadingBranch,
    isLoadingProducts,
    isLoadingPromotions,
    error,
    selectedBranchId,
    setSelectedBranchId,
    refetchGeneral,
    refetchBranch,
    refetchProducts,
    refetchPromotions,
    createProduct,
    updateProduct,
    deleteProduct,
    updateInventory,
    createPromotion,
    updatePromotion,
    deletePromotion,
    syncProducts,
    syncPrices,
    syncPromotions,
  } = useInventoryManagement();

  // Local state
  const [currentTab, setCurrentTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [stockAdjustmentDialogOpen, setStockAdjustmentDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [editingPromotion, setEditingPromotion] = useState<Promotion | undefined>();
  const [editingInventory, setEditingInventory] = useState<(BranchInventory & { product?: Product }) | undefined>();
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Computed values
  const currentInventory = selectedBranchId ? branchInventory : generalInventory;
  const isLoading = selectedBranchId ? isLoadingBranch : isLoadingGeneral;

  // Safe fallbacks for data
  const safeCategories = categories || [];
  const safeBranches = branches || [];
  const safeProducts = products || [];
  const safePromotions = promotions || [];
  const safeCurrentInventory = currentInventory || [];

  // Filter products based on search and filters
  const filteredProducts = useMemo(() => {
    const safeSearchTerm = (searchTerm || '').toLowerCase();
    return safeProducts.filter(product => {
      const matchesSearch = (product.name || '').toLowerCase().includes(safeSearchTerm) ||
                           (product.sku || '').toLowerCase().includes(safeSearchTerm) ||
                           (product.barcode && product.barcode.toLowerCase().includes(safeSearchTerm));
      
      const matchesActive = !showActiveOnly || product.isActive;
      
      return matchesSearch && matchesActive;
    }).map((product, index) => {
      // Ensure each product has a unique id for DataGrid
      return {
        ...product,
        id: product.id || `product-${index}`
      };
    });
  }, [safeProducts, searchTerm, showActiveOnly]);

  // Filter inventory based on search and filters
  const filteredInventory = useMemo(() => {
    const inventoryWithProducts = safeCurrentInventory.map((item, index) => {
      const product = safeProducts.find(p => p.id === item.productId);
      // Create a guaranteed unique ID for DataGrid
      const uniqueId = item.id || `${item.branchId || 'global'}-${item.productId || 'unknown'}-${index}`;
      
      return { 
        ...item, 
        product,
        // Ensure each row has a unique id for DataGrid - must be at top level
        id: uniqueId
      };
    }).filter(item => item.product);

    return inventoryWithProducts.filter(item => {
      const product = item.product!;
      const safeSearchTerm = (searchTerm || '').toLowerCase();
      const matchesSearch = (product.name || '').toLowerCase().includes(safeSearchTerm) ||
                           (product.sku || '').toLowerCase().includes(safeSearchTerm);
      
      const matchesLowStock = !showLowStockOnly || item.quantityInStock <= item.minStockLevel;
      
      return matchesSearch && matchesLowStock;
    });
  }, [safeCurrentInventory, safeProducts, searchTerm, showLowStockOnly]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalProducts = filteredProducts.length;
    const lowStockItems = filteredInventory.filter(item => 
      item.quantityInStock <= item.minStockLevel && item.quantityInStock > 0
    ).length;
    const outOfStockItems = filteredInventory.filter(item => 
      item.quantityInStock === 0
    ).length;
    const totalValue = filteredInventory.reduce((sum, item) => {
      // Use branch price if available, otherwise fall back to base price
      const price = item.branch_price || item.product?.basePrice || 0;
      return sum + (price * item.quantityInStock);
    }, 0);

    return {
      totalProducts,
      lowStockItems,
      outOfStockItems,
      totalValue,
    };
  }, [filteredProducts, filteredInventory]);

  // Event handlers
  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId || null);
    setPage(0);
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleAddProduct = () => {
    setEditingProduct(undefined);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm(t('inventory.confirmDeleteProduct'))) {
      const success = await deleteProduct(productId);
      setSnackbar({
        open: true,
        message: success ? 'Product deleted successfully' : 'Failed to delete product',
        severity: success ? 'success' : 'error',
      });
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    const newStatus = !product.isActive;
    const action = newStatus ? 'activated' : 'deactivated';
    
    const success = await updateProduct(product.id, { isActive: newStatus });
    
    setSnackbar({
      open: true,
      message: success 
        ? `Product ${action} successfully` 
        : `Failed to ${newStatus ? 'activate' : 'deactivate'} product`,
      severity: success ? 'success' : 'error',
    });
  };

  const handleSaveProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      let result;
      if (editingProduct) {
        result = await updateProduct(editingProduct.id, productData);
      } else {
        result = await createProduct(productData);
      }
      
      const success = result !== null;
      
      setSnackbar({
        open: true,
        message: success ? 'Product saved successfully' : 'Failed to save product',
        severity: success ? 'success' : 'error',
      });
      
      if (success) {
        setProductDialogOpen(false);
        setEditingProduct(undefined);
        // Explicitly refetch products to ensure UI is updated
        await refetchProducts();
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save product',
        severity: 'error',
      });
    }
  };

  const handleAddPromotion = () => {
    if (!selectedBranchId) {
      setSnackbar({
        open: true,
        message: 'Please select a branch first',
        severity: 'warning',
      });
      return;
    }
    setEditingPromotion(undefined);
    setPromotionDialogOpen(true);
  };

  const handleEditPromotion = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setPromotionDialogOpen(true);
  };

  const handleDeletePromotion = async (promotionId: string) => {
    if (window.confirm('Are you sure you want to delete this promotion?')) {
      const success = await deletePromotion(promotionId);
      setSnackbar({
        open: true,
        message: success ? 'Promotion deleted successfully' : 'Failed to delete promotion',
        severity: success ? 'success' : 'error',
      });
    }
  };

  const handleSavePromotion = async (promotionData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      let success;
      if (editingPromotion) {
        success = await updatePromotion(editingPromotion.id, promotionData);
      } else {
        success = await createPromotion(selectedBranchId!, promotionData);
      }
      
      setSnackbar({
        open: true,
        message: success ? 'Promotion saved successfully' : 'Failed to save promotion',
        severity: success ? 'success' : 'error',
      });
      
      if (success) {
        setPromotionDialogOpen(false);
        setEditingPromotion(undefined);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save promotion',
        severity: 'error',
      });
    }
  };

  const handleSync = async (type: 'products' | 'prices' | 'promotions') => {
    if (!selectedBranchId) {
      setSnackbar({
        open: true,
        message: 'Please select a branch first',
        severity: 'warning',
      });
      return;
    }

    let success = false;
    switch (type) {
      case 'products':
        success = await syncProducts(selectedBranchId);
        break;
      case 'prices':
        success = await syncPrices(selectedBranchId);
        break;
      case 'promotions':
        success = await syncPromotions(selectedBranchId);
        break;
    }

    setSnackbar({
      open: true,
      message: success ? `${type} sync initiated successfully` : `Failed to sync ${type}`,
      severity: success ? 'success' : 'error',
    });
  };

  const handleBulkSync = async () => {
    if (!selectedBranchId) {
      setSnackbar({
        open: true,
        message: 'Please select a branch first',
        severity: 'warning',
      });
      return;
    }

    setSnackbar({
      open: true,
      message: 'Starting bulk synchronization...',
      severity: 'info',
    });

    try {
      const [productsResult, pricesResult, promotionsResult] = await Promise.all([
        syncProducts(selectedBranchId),
        syncPrices(selectedBranchId),
        syncPromotions(selectedBranchId)
      ]);

      const successCount = [productsResult, pricesResult, promotionsResult].filter(Boolean).length;
      
      setSnackbar({
        open: true,
        message: `Bulk sync completed: ${successCount}/3 operations successful`,
        severity: successCount === 3 ? 'success' : successCount > 0 ? 'warning' : 'error',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Bulk sync failed',
        severity: 'error',
      });
    }
  };

  const handleEditInventory = (inventoryItem: BranchInventory & { product?: Product }) => {
    setEditingInventory(inventoryItem);
    setInventoryDialogOpen(true);
  };

  const handleAdjustStock = (inventoryItem: BranchInventory & { product?: Product }) => {
    setEditingInventory(inventoryItem);
    setStockAdjustmentDialogOpen(true);
  };

  const handleSaveInventorySettings = async (data: Partial<BranchInventory>) => {
    if (!editingInventory) return;
    
    try {
      const success = await updateInventory(
        editingInventory.branchId,
        editingInventory.productId,
        data
      );
      
      if (success) {
        setSnackbar({
          open: true,
          message: 'Inventory settings updated successfully',
          severity: 'success',
        });
        setInventoryDialogOpen(false);
        setEditingInventory(undefined);
      } else {
        setSnackbar({
          open: true,
          message: 'Failed to update inventory settings',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to update inventory settings',
        severity: 'error',
      });
    }
  };

  const handleStockAdjustment = async (adjustmentData: {
    adjustment: number;
    type: 'add' | 'subtract' | 'set';
    reason: string;
  }) => {
    if (!editingInventory) return;
    
    try {
      // Calculate the new quantity based on adjustment type
      let newQuantity = editingInventory.quantityInStock;
      
      switch (adjustmentData.type) {
        case 'add':
          newQuantity += adjustmentData.adjustment;
          break;
        case 'subtract':
          newQuantity = Math.max(0, newQuantity - adjustmentData.adjustment);
          break;
        case 'set':
          newQuantity = adjustmentData.adjustment;
          break;
      }
      
      const success = await updateInventory(
        editingInventory.branchId,
        editingInventory.productId,
        { quantityInStock: newQuantity }
      );
      
      if (success) {
        setSnackbar({
          open: true,
          message: `Stock adjusted successfully. New quantity: ${newQuantity}`,
          severity: 'success',
        });
        setStockAdjustmentDialogOpen(false);
        setEditingInventory(undefined);
      } else {
        setSnackbar({
          open: true,
          message: 'Failed to adjust stock',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to adjust stock',
        severity: 'error',
      });
    }
  };

  const handleRefresh = () => {
    refetchProducts();
    refetchGeneral();
    refetchBranch();
    refetchPromotions();
  };

  // Define columns for products table
  const productColumns: GridColDef[] = [
    { field: 'sku', headerName: t('inventory.sku'), width: 120 },
    { field: 'name', headerName: t('inventory.product'), flex: 1, minWidth: 200 },
    { 
      field: 'basePrice', 
      headerName: selectedBranchId ? t('inventory.branchPrice') : t('inventory.basePrice'), 
      width: 120,
      valueFormatter: (value: number) => value != null ? `$${Number(value).toFixed(2)}` : '$0.00',
      valueGetter: (_value: any, row: any) => selectedBranchId ? (row.branch_price || row.basePrice) : row.basePrice
    },
    { 
      field: 'cost', 
      headerName: selectedBranchId ? t('inventory.branchCost') : t('inventory.baseCost'), 
      width: 120,
      valueFormatter: (value: number) => value != null ? `$${Number(value).toFixed(2)}` : '-',
      valueGetter: (_value: any, row: any) => selectedBranchId ? (row.branch_cost || row.cost) : row.cost
    },
    { 
      field: 'isActive', 
      headerName: t('inventory.status'), 
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={params.value ? t('inventory.active') : t('inventory.inactive')}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      )
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('inventory.actions'),
      width: 180,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<Edit />}
          label="Edit"
          onClick={() => handleEditProduct(params.row)}
        />,
        <GridActionsCellItem
          icon={<PowerSettingsNew />}
          label={params.row.isActive ? "Deactivate" : "Activate"}
          onClick={() => handleToggleProductStatus(params.row)}
        />,
        <GridActionsCellItem
          icon={<Delete />}
          label="Delete"
          onClick={() => handleDeleteProduct(params.row.id)}
        />,
      ],
    },
  ];

  // Define columns for inventory table
  const inventoryColumns: GridColDef[] = [
    { 
      field: 'sku', 
      headerName: t('inventory.sku'), 
      width: 120, 
      valueGetter: (_value: any, row: any) => row.product?.sku 
    },
    { 
      field: 'name', 
      headerName: t('inventory.product'), 
      flex: 1, 
      minWidth: 200, 
      valueGetter: (_value: any, row: any) => row.product?.name 
    },
    { 
      field: 'branch_price', 
      headerName: selectedBranchId ? t('inventory.branchPrice') : t('inventory.basePrice'), 
      width: 120,
      valueFormatter: (value: number) => value != null ? `$${Number(value).toFixed(2)}` : '$0.00',
      valueGetter: (_value: any, row: any) => row.branch_price || row.product?.base_price || 0
    },
    { 
      field: 'branch_cost', 
      headerName: selectedBranchId ? t('inventory.branchCost') : t('inventory.baseCost'), 
      width: 120,
      valueFormatter: (value: number) => value != null ? `$${Number(value).toFixed(2)}` : '-',
      valueGetter: (_value: any, row: any) => row.branch_cost || row.product?.cost || 0
    },
    { field: 'quantityInStock', headerName: t('inventory.quantity'), width: 100 },
    { field: 'minStockLevel', headerName: t('inventory.minStock'), width: 100 },
    { field: 'maxStockLevel', headerName: t('inventory.maxStock'), width: 100 },
    { 
      field: 'status', 
      headerName: t('inventory.status'), 
      width: 120,
      renderCell: (params) => {
        const { quantityInStock, minStockLevel } = params.row;
        let status = t('inventory.inStock');
        let color: 'success' | 'warning' | 'error' = 'success';
        
        if (quantityInStock === 0) {
          status = t('inventory.outOfStock');
          color = 'error';
        } else if (quantityInStock <= minStockLevel) {
          status = t('inventory.lowStock');
          color = 'warning';
        }
        
        return <Chip label={status} color={color} size="small" />;
      }
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('inventory.actions'),
      width: 120,
      getActions: (params) => [
        <GridActionsCellItem
          icon={<Edit />}
          label="Edit Stock"
          onClick={() => handleEditInventory(params.row)}
        />,
        <GridActionsCellItem
          icon={<PowerSettingsNew />}
          label="Adjust Stock"
          onClick={() => handleAdjustStock(params.row)}
        />,
      ],
    },
  ];

  // Show loading spinner if essential data is loading
  if (branchesLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Inventory sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">
            {t('inventory.title')}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
          >
            {t('inventory.refresh')}
          </Button>
          
          {selectedBranchId && (
            <>
              <Button
                variant="outlined"
                startIcon={<Sync />}
                onClick={() => handleSync('products')}
              >
                {t('inventory.syncProducts')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<MonetizationOn />}
                onClick={() => handleSync('prices')}
              >
                {t('inventory.syncPrices')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<LocalOffer />}
                onClick={() => handleSync('promotions')}
              >
                {t('inventory.syncPromotions')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Sync />}
                onClick={() => handleBulkSync()}
              >
                {t('inventory.syncAll')}
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Branch Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Store />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>{t('inventory.selectBranch')}</InputLabel>
              <Select
                value={selectedBranchId || ''}
                onChange={(e) => handleBranchChange(e.target.value)}
                label={t('inventory.selectBranch')}
              >
                <MenuItem value="">
                  <em>{t('inventory.generalInventory')}</em>
                </MenuItem>
                {safeBranches.map(branch => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              {selectedBranchId 
                ? t('inventory.branchInventory') 
                : t('inventory.generalInventory')
              }
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" color="primary">
              {stats.totalProducts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('inventory.totalProducts')}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" color="warning.main">
              {stats.lowStockItems}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('inventory.lowStockItems')}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" color="error.main">
              {stats.outOfStockItems}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('inventory.outOfStockItems')}
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" color="success.main">
              ${stats.totalValue.toFixed(2)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('inventory.totalValue')}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label={t('inventory.products')} />
          <Tab label={t('inventory.inventory')} />
          {selectedBranchId && <Tab label={t('inventory.promotions')} />}
        </Tabs>
      </Box>

      {/* Search and Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('inventory.search')}
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
            />
            
            {currentTab === 1 && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showLowStockOnly}
                      onChange={(e) => setShowLowStockOnly(e.target.checked)}
                    />
                  }
                  label={t('inventory.showLowStock')}
                />
                {stats.lowStockItems > 0 && (
                  <Chip 
                    label={`${stats.lowStockItems} Low Stock Items`}
                    color="warning"
                    icon={<Warning />}
                    variant="outlined"
                  />
                )}
                {stats.outOfStockItems > 0 && (
                  <Chip 
                    label={`${stats.outOfStockItems} Out of Stock`}
                    color="error"
                    icon={<Warning />}
                    variant="outlined"
                  />
                )}
              </>
            )}
            
            {currentTab === 0 && (
              <FormControlLabel
                control={
                  <Switch
                    checked={showActiveOnly}
                    onChange={(e) => setShowActiveOnly(e.target.checked)}
                  />
                }
                label={t('inventory.showActive')}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {currentTab === 0 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {t('inventory.products')} ({filteredProducts.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddProduct}
              >
                {t('inventory.addProduct')}
              </Button>
            </Box>
            
            <DataGrid
              rows={filteredProducts}
              columns={productColumns}
              loading={isLoadingProducts}
              pageSizeOptions={[25, 50, 100]}
              paginationModel={{
                page,
                pageSize: rowsPerPage,
              }}
              onPaginationModelChange={(model) => {
                setPage(model.page);
                setRowsPerPage(model.pageSize);
              }}
              disableRowSelectionOnClick
              sx={{ height: 600 }}
            />
          </CardContent>
        </Card>
      )}

      {currentTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {selectedBranchId ? t('inventory.branchInventory') : t('inventory.generalInventory')} ({filteredInventory.length})
            </Typography>
            
            <DataGrid
              rows={filteredInventory}
              columns={inventoryColumns}
              loading={isLoading}
              pageSizeOptions={[25, 50, 100]}
              paginationModel={{
                page,
                pageSize: rowsPerPage,
              }}
              onPaginationModelChange={(model) => {
                setPage(model.page);
                setRowsPerPage(model.pageSize);
              }}
              disableRowSelectionOnClick
              sx={{ height: 600 }}
            />
          </CardContent>
        </Card>
      )}

      {currentTab === 2 && selectedBranchId && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                {t('inventory.promotions')} ({safePromotions.length})
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddPromotion}
              >
                {t('inventory.addPromotion')}
              </Button>
            </Box>
            
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('inventory.promotionName')}</TableCell>
                    <TableCell>{t('inventory.promotionType')}</TableCell>
                    <TableCell>{t('inventory.discount')}</TableCell>
                    <TableCell>{t('inventory.startDate')}</TableCell>
                    <TableCell>{t('inventory.endDate')}</TableCell>
                    <TableCell>{t('inventory.status')}</TableCell>
                    <TableCell>{t('inventory.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {safePromotions.map((promotion) => (
                    <TableRow key={promotion.id}>
                      <TableCell>{promotion.name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={t(`inventory.${promotion.type}`)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {promotion.type === 'percentage' 
                          ? `${promotion.discountPercentage}%`
                          : `$${promotion.discountAmount}`
                        }
                      </TableCell>
                      <TableCell>{new Date(promotion.startDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(promotion.endDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip 
                          label={promotion.isActive ? t('inventory.active') : t('inventory.inactive')}
                          color={promotion.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={t('inventory.editPromotion')}>
                          <IconButton onClick={() => handleEditPromotion(promotion)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('inventory.deletePromotion')}>
                          <IconButton onClick={() => handleDeletePromotion(promotion.id)}>
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ProductDialog
        open={productDialogOpen}
        onClose={() => setProductDialogOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        categories={safeCategories}
        isLoading={isLoadingProducts}
        selectedBranchId={selectedBranchId}
      />

      {selectedBranchId && (
        <PromotionDialog
          open={promotionDialogOpen}
          onClose={() => setPromotionDialogOpen(false)}
          onSave={handleSavePromotion}
          promotion={editingPromotion}
          categories={safeCategories}
          products={safeProducts}
          branchId={selectedBranchId}
          isLoading={isLoadingPromotions}
        />
      )}

      {/* Inventory Management Dialogs */}
      <InventoryDialog
        open={inventoryDialogOpen}
        onClose={() => setInventoryDialogOpen(false)}
        onSave={handleSaveInventorySettings}
        inventoryItem={editingInventory}
        isLoading={isLoadingBranch || isLoadingGeneral}
      />

      <StockAdjustmentDialog
        open={stockAdjustmentDialogOpen}
        onClose={() => setStockAdjustmentDialogOpen(false)}
        onSave={handleStockAdjustment}
        inventoryItem={editingInventory}
        isLoading={isLoadingBranch || isLoadingGeneral}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default InventoryPage;
