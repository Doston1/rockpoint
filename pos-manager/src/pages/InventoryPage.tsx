import {
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
import { useEffect, useState } from 'react';
import { NavigationBar } from '../components/NavigationBar';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../services/api';

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
}

const InventoryPage = () => {
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
      } catch (error) {
        console.error('Failed to load inventory data:', error);
      }
    };

    loadData();
  }, [getAllProducts, getCategories]);

  // Load low stock products when tab changes
  useEffect(() => {
    if (tabValue === 1) {
      loadLowStockProducts();
    }
  }, [tabValue]);

  const loadLowStockProducts = async () => {
    try {
      const lowStock = await getLowStockProducts();
      setLowStockProducts(lowStock);
    } catch (error) {
      console.error('Failed to load low stock products:', error);
    }
  };

  // Filter products based on category and search
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
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
      category: product.category || '',
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
          message: 'Product updated successfully',
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
          message: 'Failed to update product',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error updating product:', error);
      setSnackbar({
        open: true,
        message: 'Error updating product',
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
          message: 'Product deleted successfully',
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
          message: 'Failed to delete product',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setSnackbar({
        open: true,
        message: 'Error deleting product',
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
    if (product.quantity_in_stock === 0) return 'Out of Stock';
    if (product.quantity_in_stock <= (product.low_stock_threshold || 10)) return 'Low Stock';
    return 'In Stock';
  };

  return (
    <>
      <NavigationBar />
      
      <Container maxWidth="xl" sx={{ mt: 2, mb: 2 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <InventoryIcon sx={{ mr: 1, fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold">
                Inventory Management
              </Typography>
            </Box>
            
            <Box display="flex" gap={2}>
              <Button
                variant={editMode ? "contained" : "outlined"}
                color={editMode ? "secondary" : "primary"}
                startIcon={editMode ? <Save /> : <Edit />}
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
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
                  Total Products
                </Typography>
                <Typography variant="h4">
                  {products.length}
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Categories
                </Typography>
                <Typography variant="h4">
                  {categories.length}
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Low Stock Items
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {lowStockProducts.length}
                </Typography>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Out of Stock
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
            <Tab label="All Products" />
            <Tab 
              label={
                <Box display="flex" alignItems="center">
                  Low Stock Products
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
                label="Search products"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ minWidth: 200 }}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
                }}
              />
              
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.name} value={category.name}>
                      {category.name} ({category.product_count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box display="flex" alignItems="center" gap={1}>
                <FilterList />
                <Typography variant="body2">
                  Showing {currentProducts.length} products
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
                <TableCell>Product</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Barcode</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell align="center">Stock</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Active</TableCell>
                {editMode && <TableCell align="center">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <Chip label={product.category || 'Uncategorized'} size="small" />
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
                        <Tooltip title="Edit Product">
                          <IconButton
                            size="small"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Product">
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
          <DialogTitle>Edit Product</DialogTitle>
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
                label="Product Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              
              <TextField
                fullWidth
                label="Barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
              
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
              
              <TextField
                fullWidth
                label="Brand"
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
                label="Price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                inputProps={{ step: 0.01 }}
              />
              
              <TextField
                fullWidth
                label="Cost"
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                inputProps={{ step: 0.01 }}
              />
              
              <TextField
                fullWidth
                label="Stock Quantity"
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
                label="Low Stock Threshold"
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) })}
              />
              
              <Box display="flex" alignItems="center" gap={2}>
                <Typography>Active Product:</Typography>
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              </Box>
            </Box>

            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mt: 2 }}
            />
            
            <TextField
              fullWidth
              label="Image URL"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProduct} variant="contained">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDeleteProduct} color="error" variant="contained">
              Delete
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