import {
  Add,
  Delete,
  Edit,
  FilterList,
  Inventory as InventoryIcon,
  Save,
  Search,
  Visibility,
  VisibilityOff,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
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
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationBar } from '../components/NavigationBar';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../services/api';
import { apiService } from '../services/api';

interface ProductFormData {
  name: string;
  barcode: string;
  price: number;
  cost: number;
  quantity_in_stock: number;
  low_stock_threshold: number;
  category: string;
  brand: string;
  description: string;
  image_url: string;
  is_active: boolean;
  // Translation fields
  name_ru?: string;
  name_uz?: string;
  description_ru?: string;
  description_uz?: string;
}

interface CategoryFormData {
  name_en: string;
  name_ru: string;
  name_uz: string;
}

const InventoryPage = () => {
  const { t, i18n } = useTranslation();
  const {
    products,
    categories,
    // loading,
    error,
    getAllProducts,
    getCategories,
    getLowStockProducts,
    updateProduct,
    deleteProduct,
    clearError
  } = useProducts();

  // State management
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    barcode: '',
    price: 0,
    cost: 0,
    quantity_in_stock: 0,
    low_stock_threshold: 10,
    category: '',
    brand: '',
    description: '',
    image_url: '',
    is_active: true,
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Add product dialog state
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [addProductFormData, setAddProductFormData] = useState<ProductFormData>({
    name: '',
    barcode: '',
    price: 0,
    cost: 0,
    quantity_in_stock: 0,
    low_stock_threshold: 10,
    category: '',
    brand: '',
    description: '',
    image_url: '',
    is_active: true,
    name_ru: '',
    name_uz: '',
    description_ru: '',
    description_uz: '',
  });

  // Add category dialog state
  const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
  const [addCategoryFormData, setAddCategoryFormData] = useState<CategoryFormData>({
    name_en: '',
    name_ru: '',
    name_uz: '',
  });

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          getAllProducts(),
          getCategories(),
        ]);

        // Debug logging to check received data
        console.log('Products loaded:', products.length);
        if (products.length > 0) {
          console.log('First product sample:', {
            name: products[0].name,
            category: products[0].category,
            category_key: products[0].category_key,
            category_name: products[0].category_name
          });
        }
      } catch (error) {
        console.error('Failed to load inventory data:', error);
      }
    };

    loadData();
  }, [getAllProducts, getCategories]);

  // Define loadLowStockProducts before useEffect hooks
  const loadLowStockProducts = useCallback(async () => {
    try {
      const lowStock = await getLowStockProducts();
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Failed to load low stock products:', error);
    }
  }, [getLowStockProducts]);

  // Load low stock products when tab changes
  useEffect(() => {
    if (tabValue === 1) {
      loadLowStockProducts();
    }
  }, [tabValue, loadLowStockProducts]);

  // Refresh products when language changes
  useEffect(() => {
    getAllProducts();
    if (tabValue === 1) {
      loadLowStockProducts();
    }
  }, [i18n.language]); // Remove getAllProducts and loadLowStockProducts from dependencies

  // Filter products based on category and search
  const filteredProducts = products.filter((product) => {
    const productCategoryKey = product.category_key || product.category;
    const matchesCategory = selectedCategory === 'all' || productCategoryKey === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get current page products
  const currentProducts = tabValue === 0 ? filteredProducts : lowStockProducts;
  const paginatedProducts = currentProducts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(0);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode || '',
      price: product.price,
      cost: product.cost || 0,
      quantity_in_stock: product.quantity_in_stock,
      low_stock_threshold: product.low_stock_threshold || 10,
      category: product.category_key || product.category || '',
      brand: product.brand || '',
      description: product.description || '',
      image_url: product.image_url || '',
      is_active: product.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;

    try {
      const result = await updateProduct(editingProduct.id, formData);
      if (result) {
        setSnackbar({
          open: true,
          message: t('inventory.productUpdatedSuccess'),
          severity: 'success',
        });
        setEditDialogOpen(false);
        setEditingProduct(null);
        // Reload data
        await getAllProducts();
        if (tabValue === 1) {
          await loadLowStockProducts();
        }
      } else {
        setSnackbar({
          open: true,
          message: t('inventory.errorUpdatingProduct'),
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error updating product:', error);
      setSnackbar({
        open: true,
        message: t('inventory.errorUpdatingProduct'),
        severity: 'error',
      });
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    try {
      const result = await deleteProduct(productToDelete.id);
      if (result) {
        setSnackbar({
          open: true,
          message: t('inventory.productDeletedSuccess'),
          severity: 'success',
        });
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        // Reload data
        await getAllProducts();
        if (tabValue === 1) {
          await loadLowStockProducts();
        }
      } else {
        setSnackbar({
          open: true,
          message: t('inventory.errorDeletingProduct'),
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setSnackbar({
        open: true,
        message: t('inventory.errorDeletingProduct'),
        severity: 'error',
      });
    }
  };

  const getStockStatusColor = (product: Product) => {
    if (product.quantity_in_stock === 0) return 'error';
    if (product.quantity_in_stock <= (product.low_stock_threshold || 10)) return 'warning';
    return 'success';
  };

  const getStockStatusText = (product: Product) => {
    if (product.quantity_in_stock === 0) return t('inventory.outOfStock');
    if (product.quantity_in_stock <= (product.low_stock_threshold || 10)) return t('inventory.lowStock');
    return t('inventory.inStock');
  };

  // Validation functions
  const isAddProductFormValid = () => {
    return addProductFormData.name.trim() !== '' &&
      addProductFormData.name_ru?.trim() !== '' &&
      addProductFormData.name_uz?.trim() !== '' &&
      addProductFormData.description.trim() !== '' &&
      addProductFormData.description_ru?.trim() !== '' &&
      addProductFormData.description_uz?.trim() !== '' &&
      addProductFormData.category !== '' &&
      addProductFormData.price > 0;
  };

  const isAddCategoryFormValid = () => {
    return addCategoryFormData.name_en.trim() !== '' &&
      addCategoryFormData.name_ru.trim() !== '' &&
      addCategoryFormData.name_uz.trim() !== '';
  };

  // Add product handler
  const handleAddProduct = async () => {
    if (!isAddProductFormValid()) return;

    try {
      const result = await apiService.createProduct(addProductFormData);
      if (result.success) {
        setSnackbar({
          open: true,
          message: t('inventory.productAddedSuccess'),
          severity: 'success',
        });
        setAddProductDialogOpen(false);
        setAddProductFormData({
          name: '',
          barcode: '',
          price: 0,
          cost: 0,
          quantity_in_stock: 0,
          low_stock_threshold: 10,
          category: '',
          brand: '',
          description: '',
          image_url: '',
          is_active: true,
          name_ru: '',
          name_uz: '',
          description_ru: '',
          description_uz: '',
        });
        // Reload data
        await getAllProducts();
        await getCategories();
      } else {
        setSnackbar({
          open: true,
          message: t('inventory.errorAddingProduct'),
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error adding product:', error);
      setSnackbar({
        open: true,
        message: t('inventory.errorAddingProduct'),
        severity: 'error',
      });
    }
  };

  // Add category handler
  const handleAddCategory = async () => {
    if (!isAddCategoryFormValid()) return;

    try {
      const result = await apiService.createCategory(addCategoryFormData);
      if (result.success) {
        setSnackbar({
          open: true,
          message: t('inventory.categoryAddedSuccess'),
          severity: 'success',
        });
        setAddCategoryDialogOpen(false);
        setAddCategoryFormData({
          name_en: '',
          name_ru: '',
          name_uz: '',
        });
        // Reload categories
        await getCategories();
      } else {
        setSnackbar({
          open: true,
          message: t('inventory.errorAddingCategory'),
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error adding category:', error);
      setSnackbar({
        open: true,
        message: t('inventory.errorAddingCategory'),
        severity: 'error',
      });
    }
  };

  return (
    <>
      <NavigationBar />

      <Container maxWidth={false} sx={{ mt: 2, mb: 2, px: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <InventoryIcon sx={{ mr: 1, fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold">
                {t('inventory.inventoryManagement')}
              </Typography>
            </Box>

            <Box display="flex" gap={2}>
              {editMode && (
                <>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<Add />}
                    onClick={() => setAddCategoryDialogOpen(true)}
                  >
                    {t('inventory.addCategory')}
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={() => setAddProductDialogOpen(true)}
                  >
                    {t('inventory.addProduct')}
                  </Button>
                </>
              )}
              <Button
                variant={editMode ? "contained" : "outlined"}
                color={editMode ? "secondary" : "primary"}
                startIcon={editMode ? <Save /> : <Edit />}
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? t('inventory.exitEditMode') : t('inventory.editMode')}
              </Button>
            </Box>
          </Box>

          {/* Stats Cards - Using Box instead of Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(1, 1fr)',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 2,
              mb: 3,
            }}
          >
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('inventory.totalProducts')}
                </Typography>
                <Typography variant="h4">
                  {products.length}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('inventory.categories')}
                </Typography>
                <Typography variant="h4">
                  {categories.length}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('inventory.lowStockItems')}
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {lowStockProducts.length}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('inventory.outOfStock')}
                </Typography>
                <Typography variant="h4" color="error.main">
                  {products.filter(p => p.quantity_in_stock === 0).length}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Paper sx={{ mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={t('inventory.allProducts')} />
            <Tab
              label={
                <Box display="flex" alignItems="center">
                  {t('inventory.lowStockProducts')}
                  {lowStockProducts.length > 0 && (
                    <Chip
                      label={lowStockProducts.length}
                      size="small"
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
              }
            />
          </Tabs>
        </Paper>

        {/* Filters - Only show for All Products tab */}
        {tabValue === 0 && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <TextField
                label={t('inventory.searchProducts')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ minWidth: 200 }}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{t('inventory.category')}</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label={t('inventory.category')}
                >
                  <MenuItem value="all">{t('inventory.allCategories')}</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.key} value={category.key}>
                      {category.name} ({category.product_count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>              <Box display="flex" alignItems="center" gap={1}>
                <FilterList />
                <Typography variant="body2">
                  {t('inventory.showingProducts', { count: currentProducts.length })}
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Products Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('inventory.sku')}</TableCell>
                <TableCell>{t('inventory.product')}</TableCell>
                <TableCell>{t('inventory.category')}</TableCell>
                <TableCell>{t('inventory.barcode')}</TableCell>
                <TableCell align="right">{t('inventory.price')}</TableCell>
                <TableCell align="right">{t('inventory.cost')}</TableCell>
                <TableCell align="center">{t('inventory.stock')}</TableCell>
                <TableCell align="center">{t('inventory.status')}</TableCell>
                <TableCell align="center">{t('inventory.active')}</TableCell>
                {editMode && <TableCell align="center">{t('inventory.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" color="primary">
                      {product.sku || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      {/* Product Thumbnail */}
                      {product.has_image && product.image_paths?.thumbnail ? (
                        <Avatar
                          src={`http://localhost:3000${product.image_paths.thumbnail}`}
                          alt={product.name}
                          sx={{ width: 40, height: 40 }}
                          variant="rounded"
                        />
                      ) : (
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: 'grey.300',
                            color: 'grey.600'
                          }}
                          variant="rounded"
                        >
                          {product.name.charAt(0).toUpperCase()}
                        </Avatar>
                      )}

                      {/* Product Details */}
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {product.name}
                        </Typography>
                        {product.brand && (
                          <Typography variant="caption" color="text.secondary">
                            {product.brand}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={product.category_name || product.category || t('inventory.uncategorized')}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {product.barcode || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="bold">
                      ${product.price.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    ${(product.cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" flexDirection="column" alignItems="center">
                      <Typography variant="body2" fontWeight="bold">
                        {product.quantity_in_stock}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Threshold: {product.low_stock_threshold || 10}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={getStockStatusText(product)}
                      color={getStockStatusColor(product)}
                      size="small"
                      icon={product.quantity_in_stock === 0 ? <Warning /> : undefined}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" justifyContent="center">
                      {product.is_active ? (
                        <Visibility color="success" />
                      ) : (
                        <VisibilityOff color="disabled" />
                      )}
                    </Box>
                  </TableCell>
                  {editMode && (
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title={t('inventory.editProduct')}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('inventory.deleteProduct')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setProductToDelete(product);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={currentProducts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>

        {/* Edit Product Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{t('inventory.editProduct')}</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(1, 1fr)',
                  md: 'repeat(2, 1fr)',
                },
                gap: 2,
                mt: 1,
              }}
            >
              <TextField
                fullWidth
                label={t('inventory.productName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <TextField
                fullWidth
                label={t('inventory.barcode')}
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />

              <TextField
                fullWidth
                label={t('inventory.category')}
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />

              <TextField
                fullWidth
                label={t('inventory.brand')}
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 2,
                mt: 2,
              }}
            >
              <TextField
                fullWidth
                label={t('inventory.price')}
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                inputProps={{ step: 0.01 }}
              />

              <TextField
                fullWidth
                label={t('inventory.cost')}
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                inputProps={{ step: 0.01 }}
              />

              <TextField
                fullWidth
                label={t('inventory.stockQuantity')}
                type="number"
                value={formData.quantity_in_stock}
                onChange={(e) => setFormData({ ...formData, quantity_in_stock: parseInt(e.target.value) })}
              />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 2,
                mt: 2,
              }}
            >
              <TextField
                fullWidth
                label={t('inventory.lowStockThreshold')}
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) })}
              />

              <Box display="flex" alignItems="center" gap={2}>
                <Typography>{t('inventory.activeProduct')}:</Typography>
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              </Box>
            </Box>

            <TextField
              fullWidth
              label={t('inventory.description')}
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mt: 2 }}
            />

            <TextField
              fullWidth
              label={t('inventory.imageUrl')}
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>{t('inventory.cancel')}</Button>
            <Button onClick={handleSaveProduct} variant="contained">
              {t('inventory.saveChanges')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>{t('inventory.deleteProduct')}</DialogTitle>
          <DialogContent>
            <Typography>
              {t('inventory.deleteProductConfirm', { productName: productToDelete?.name })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>{t('inventory.cancel')}</Button>
            <Button onClick={handleDeleteProduct} color="error" variant="contained">
              {t('inventory.delete')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Product Dialog */}
        <Dialog open={addProductDialogOpen} onClose={() => setAddProductDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>{t('inventory.addProduct')}</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              {/* English Fields */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                {t('inventory.englishRequired')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                  mb: 3,
                }}
              >
                <TextField
                  fullWidth
                  label={`${t('inventory.productNameEnglish')} *`}
                  value={addProductFormData.name}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, name: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label={t('inventory.barcode')}
                  value={addProductFormData.barcode}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, barcode: e.target.value })}
                />
              </Box>

              <TextField
                fullWidth
                label={`${t('inventory.descriptionEnglish')} *`}
                multiline
                rows={2}
                value={addProductFormData.description}
                onChange={(e) => setAddProductFormData({ ...addProductFormData, description: e.target.value })}
                required
                sx={{ mb: 3 }}
              />

              {/* Russian Fields */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                {t('inventory.russianRequired')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                  mb: 3,
                }}
              >
                <TextField
                  fullWidth
                  label={`${t('inventory.productNameRussian')} *`}
                  value={addProductFormData.name_ru}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, name_ru: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label={t('inventory.brand')}
                  value={addProductFormData.brand}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, brand: e.target.value })}
                />
              </Box>

              <TextField
                fullWidth
                label={`${t('inventory.descriptionRussian')} *`}
                multiline
                rows={2}
                value={addProductFormData.description_ru}
                onChange={(e) => setAddProductFormData({ ...addProductFormData, description_ru: e.target.value })}
                required
                sx={{ mb: 3 }}
              />

              {/* Uzbek Fields */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                {t('inventory.uzbekRequired')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                  mb: 3,
                }}
              >
                <TextField
                  fullWidth
                  label={`${t('inventory.productNameUzbek')} *`}
                  value={addProductFormData.name_uz}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, name_uz: e.target.value })}
                  required
                />
                <FormControl fullWidth required>
                  <InputLabel>{t('inventory.category')} *</InputLabel>
                  <Select
                    value={addProductFormData.category}
                    onChange={(e) => setAddProductFormData({ ...addProductFormData, category: e.target.value })}
                    label={`${t('inventory.category')} *`}
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.key} value={category.key}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <TextField
                fullWidth
                label={`${t('inventory.descriptionUzbek')} *`}
                multiline
                rows={2}
                value={addProductFormData.description_uz}
                onChange={(e) => setAddProductFormData({ ...addProductFormData, description_uz: e.target.value })}
                required
                sx={{ mb: 3 }}
              />

              {/* Pricing and Stock */}
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                {t('inventory.pricingAndStock')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 2,
                  mb: 3,
                }}
              >
                <TextField
                  fullWidth
                  label={`${t('inventory.price')} *`}
                  type="number"
                  value={addProductFormData.price}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, price: parseFloat(e.target.value) || 0 })}
                  inputProps={{ step: 0.01, min: 0 }}
                  required
                />
                <TextField
                  fullWidth
                  label={t('inventory.cost')}
                  type="number"
                  value={addProductFormData.cost}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, cost: parseFloat(e.target.value) || 0 })}
                  inputProps={{ step: 0.01, min: 0 }}
                />
                <TextField
                  fullWidth
                  label={t('inventory.stockQuantityLabel')}
                  type="number"
                  value={addProductFormData.quantity_in_stock}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, quantity_in_stock: parseInt(e.target.value) || 0 })}
                  inputProps={{ min: 0 }}
                />
                <TextField
                  fullWidth
                  label={t('inventory.lowStockThresholdLabel')}
                  type="number"
                  value={addProductFormData.low_stock_threshold}
                  onChange={(e) => setAddProductFormData({ ...addProductFormData, low_stock_threshold: parseInt(e.target.value) || 10 })}
                  inputProps={{ min: 0 }}
                />
              </Box>

              <TextField
                fullWidth
                label={t('inventory.imageUrl')}
                value={addProductFormData.image_url}
                onChange={(e) => setAddProductFormData({ ...addProductFormData, image_url: e.target.value })}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddProductDialogOpen(false)}>{t('inventory.cancel')}</Button>
            <Button
              onClick={handleAddProduct}
              variant="contained"
              disabled={!isAddProductFormValid()}
            >
              {t('inventory.createProduct')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Category Dialog */}
        <Dialog open={addCategoryDialogOpen} onClose={() => setAddCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('inventory.addCategory')}</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label={`${t('inventory.categoryNameEnglish')} *`}
                value={addCategoryFormData.name_en}
                onChange={(e) => setAddCategoryFormData({ ...addCategoryFormData, name_en: e.target.value })}
                required
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label={`${t('inventory.categoryNameRussian')} *`}
                value={addCategoryFormData.name_ru}
                onChange={(e) => setAddCategoryFormData({ ...addCategoryFormData, name_ru: e.target.value })}
                required
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label={`${t('inventory.categoryNameUzbek')} *`}
                value={addCategoryFormData.name_uz}
                onChange={(e) => setAddCategoryFormData({ ...addCategoryFormData, name_uz: e.target.value })}
                required
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddCategoryDialogOpen(false)}>{t('inventory.cancel')}</Button>
            <Button
              onClick={handleAddCategory}
              variant="contained"
              disabled={!isAddCategoryFormValid()}
            >
              {t('inventory.createCategory')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </>
  );
};

export default InventoryPage;