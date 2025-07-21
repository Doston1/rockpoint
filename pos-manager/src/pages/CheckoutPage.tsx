import {
  Add,
  CheckCircle,
  Delete,
  Payment as PaymentIcon,
  QrCodeScanner,
  Remove,
  Search,
  ShoppingCart,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { NavigationBar } from '../components/NavigationBar';
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../hooks/useProducts';
import { useTransactions } from '../hooks/useTransactions';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Payment as PaymentType, Product, TransactionItem } from '../services/api';
import { apiService } from '../services/api';

interface CartItem extends TransactionItem {
  product: Product;
}

const CheckoutPage = () => {
  const { user } = useAuth();
  const { 
    getProductByBarcode, 
    searchProducts,
    searchProductsForAutoComplete,
    getCategories,
    getProductsByCategory,
    products, 
    categories,
    searchSuggestions,
    loading: productsLoading, 
    error: productsError,
    clearError: clearProductsError,
    clearSearchSuggestions
  } = useProducts();
  const { 
    createTransaction, 
    loading: transactionLoading, 
    error: transactionError,
    clearError: clearTransactionError
  } = useTransactions();
  const { 
    terminalId, 
    isConnected, 
    requestPrice, 
    onPriceResponse,
    syncTransaction
  } = useWebSocket();

  const [barcode, setBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'search' | 'products'>('categories');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentType['method']>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [transactionCompleteDialogOpen, setTransactionCompleteDialogOpen] = useState(false);
  const [completedTransactionData, setCompletedTransactionData] = useState<{
    transactionId: string;
    changeAmount: number;
    totalAmount: number;
    amountReceived: number;
    paymentMethod: string;
  } | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const taxRate = 0.08; // 8% tax rate
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Set up WebSocket price response handler
  useEffect(() => {
    const cleanup = onPriceResponse((response) => {
      console.log('Price response received:', response);
    });

    return cleanup;
  }, [onPriceResponse]);

  // Load categories on component mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        await getCategories();
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };

    loadCategories();
  }, [getCategories]);

  const handleScanProduct = async () => {
    if (!barcode.trim()) return;
    
    clearProductsError();
    
    try {
      const product = await getProductByBarcode(barcode.trim());
      if (product) {
        addToCart(product);
        setBarcode('');
        
        // Request real-time price if connected
        if (isConnected) {
          requestPrice(product.id, barcode.trim());
        }
      }
    } catch (error) {
      console.error('Failed to scan product:', error);
    }
  };

  const handleSearchProducts = async () => {
    if (!searchQuery.trim()) {
      // If search is cleared, go back to categories
      handleBackToCategories();
      return;
    }
    
    try {
      await searchProducts(searchQuery.trim());
      setViewMode('search');
      setSelectedCategory(null);
    } catch (error) {
      console.error('Failed to search products:', error);
    }
  };

  const handleCategorySelect = async (category: string) => {
    try {
      setSelectedCategory(category);
      await getProductsByCategory(category);
      setViewMode('products');
    } catch (error) {
      console.error('Failed to load products for category:', error);
    }
  };

  const handleBackToCategories = () => {
    setViewMode('categories');
    setSelectedCategory(null);
    setSearchQuery('');
    setSelectedProduct(null);
    clearSearchSuggestions();
  };

  const handleProductSelect = (product: Product | null) => {
    setSelectedProduct(product);
    if (product) {
      addToCart(product);
      setSearchQuery('');
      setSelectedProduct(null);
      clearSearchSuggestions();
      
      // Request real-time price if connected
      if (isConnected && product.barcode) {
        requestPrice(product.id, product.barcode);
      }
    }
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.product_id === product.id);
      
      if (existingItem) {
        return prev.map(item =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total_price: (item.quantity + quantity) * product.price
              }
            : item
        );
      } else {
        const newItem: CartItem = {
          product_id: product.id,
          quantity,
          unit_price: product.price,
          total_price: product.price * quantity,
          product
        };
        return [...prev, newItem];
      }
    });
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(0, item.quantity + change);
        return {
          ...item,
          quantity: newQuantity,
          total_price: newQuantity * item.unit_price
        };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const handleCheckout = async () => {
    if (!user || !terminalId || cart.length === 0) return;

    clearTransactionError();

    // Create transaction data in the format expected by the backend API
    const transactionData = {
      terminalId: terminalId,
      employeeId: user.employeeId,
      items: cart.map(({ product, ...item }) => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price
      }))
    };

    console.log('🔍 Transaction data being sent:', {
      terminalId,
      employeeId: user.employeeId,
      cart: cart.map(item => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        product: item.product?.name
      }))
    });

    try {
      // Step 1: Create the transaction
      const transactionResponse = await createTransaction(transactionData as any);
      
      if (transactionResponse) {
        const transactionId = (transactionResponse as any).transactionId || transactionResponse.id;
        
        if (!transactionId) {
          console.error('Transaction created but no ID returned:', transactionResponse);
          throw new Error('Transaction created but no ID returned');
        }

        // Step 2: Process payment
        const paymentData = {
          method: paymentMethod,
          amount: paymentMethod === 'cash' ? parseFloat(paymentAmount) : total,
          reference: paymentMethod === 'cash' ? undefined : `REF-${Date.now()}`,
          cardLast4: paymentMethod === 'card' ? '****' : undefined
        };

        // Make payment request using the API service
        const paymentResult = await apiService.processPayment(transactionId, paymentData);
        
        if (paymentResult.success) {
          // Sync with WebSocket if connected
          if (isConnected) {
            syncTransaction({
              ...transactionResponse,
              id: transactionId,
              status: 'completed'
            });
          }
          
          const changeAmount = paymentResult.data?.changeGiven || 0;
          setCompletedTransactionData({
            transactionId,
            changeAmount,
            totalAmount: total,
            amountReceived: paymentMethod === 'cash' ? parseFloat(paymentAmount) : total,
            paymentMethod: paymentMethod
          });
          
          // Clear cart and close dialog AFTER storing the data
          setCart([]);
          setCheckoutDialogOpen(false);
          setPaymentAmount('');
          
          setTransactionCompleteDialogOpen(true);
        } else {
          throw new Error(paymentResult.error || 'Payment processing failed');
        }
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      // Show user-friendly error
      alert(`Checkout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <NavigationBar />

      <Container maxWidth="xl" sx={{ mt: 2, mb: 2 }}>
        {/* Error Messages */}
        {(productsError || transactionError) && (
          <Alert 
            severity="error" 
            onClose={() => { clearProductsError(); clearTransactionError(); }}
            sx={{ mb: 2 }}
          >
            {typeof (productsError || transactionError) === 'string' 
              ? (productsError || transactionError) 
              : 'An error occurred while loading data'}
          </Alert>
        )}

        <Box 
          sx={{
            display: 'flex',
            gap: 2,
            height: 'calc(100vh - 150px)',
            flexDirection: { xs: 'column', md: 'row' }
          }}
        >
          {/* Product Scanner & Search */}
          <Box sx={{ flex: { xs: 1, md: 2 } }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Product Scanner
              </Typography>
              
              {/* Barcode Scanner */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Scan or enter barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleScanProduct()}
                  disabled={productsLoading}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleScanProduct} disabled={productsLoading}>
                        {productsLoading ? <CircularProgress size={24} /> : <QrCodeScanner />}
                      </IconButton>
                    ),
                  }}
                />
              </Box>

              {/* Product Search */}
              <Box sx={{ mb: 3 }}>
                <Autocomplete<Product>
                  fullWidth
                  options={searchSuggestions}
                  getOptionLabel={(option: Product) => option.name || ''}
                  value={selectedProduct}
                  inputValue={searchQuery}
                  onChange={(_event: any, newValue: Product | null) => handleProductSelect(newValue)}
                  onInputChange={(_event: any, newInputValue: string) => {
                    setSearchQuery(newInputValue);
                    if (newInputValue && newInputValue.length >= 2) {
                      searchProductsForAutoComplete(newInputValue);
                    } else {
                      clearSearchSuggestions();
                    }
                  }}
                  filterOptions={(x) => x} // Disable built-in filtering since we do server-side filtering
                  renderInput={(params: any) => (
                    <TextField
                      {...params}
                      label="Search products"
                      placeholder="Type at least 2 characters to search..."
                      disabled={productsLoading}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <Box display="flex" alignItems="center">
                            {params.InputProps.endAdornment}
                            {searchQuery && (
                              <IconButton 
                                onClick={() => {
                                  setSearchQuery('');
                                  setSelectedProduct(null);
                                  clearSearchSuggestions();
                                  handleBackToCategories();
                                }}
                                size="small"
                                title="Clear search"
                              >
                                ×
                              </IconButton>
                            )}
                            <IconButton 
                              onClick={() => searchQuery && handleSearchProducts()} 
                              disabled={productsLoading || !searchQuery}
                              title="Search all products"
                            >
                              {productsLoading ? <CircularProgress size={24} /> : <Search />}
                            </IconButton>
                          </Box>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props: any, option: Product) => {
                    const { key, ...otherProps } = props;
                    return (
                      <Box component="li" key={key} {...otherProps}>
                        <Box sx={{ width: '100%' }}>
                          <Typography variant="body2" fontWeight="bold">
                            {option.name}
                          </Typography>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              {option.category && `${option.category} • `}Stock: {option.quantity_in_stock}
                              {option.barcode && ` • ${option.barcode}`}
                            </Typography>
                            <Typography variant="body2" color="primary.main" fontWeight="bold">
                              ${option.price.toFixed(2)}
                            </Typography>
                          </Box>
                          {option.quantity_in_stock <= (option.low_stock_threshold || 10) && (
                            <Typography variant="caption" color="error.main">
                              ⚠️ Low Stock
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  }}
                  noOptionsText={
                    searchQuery.length < 2 
                      ? "Type at least 2 characters to search" 
                      : productsLoading 
                        ? "Searching..." 
                        : searchQuery.length > 0
                          ? "No products found"
                          : "Start typing to search products"
                  }
                  loading={productsLoading}
                  loadingText="Searching products..."
                  openOnFocus={false} // Only open when there are suggestions
                  clearOnBlur={false} // Keep the input value when losing focus
                />
              </Box>

              {/* Categories/Products Display */}
              {viewMode === 'categories' && (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    Select a Category
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                      },
                      gap: 2,
                      maxHeight: 400,
                      overflow: 'auto'
                    }}
                  >
                    {categories.map((category) => (
                      <Card 
                        key={category.name} 
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                        onClick={() => handleCategorySelect(category.name)}
                      >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                          <Typography variant="h6" fontWeight="bold">
                            {category.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {category.product_count} products
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </>
              )}

              {(viewMode === 'products' || viewMode === 'search') && (
                <>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="subtitle1">
                      {viewMode === 'search' ? 'Search Results' : `${selectedCategory} Products`}
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={handleBackToCategories}
                      sx={{ minWidth: 'auto' }}
                    >
                      Back to Categories
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                      },
                      gap: 2,
                      maxHeight: 400,
                      overflow: 'auto'
                    }}
                  >
                    {products.length > 0 ? (
                      products.map((product) => (
                        <Card 
                          key={product.id} 
                          sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                          onClick={() => addToCart(product)}
                        >
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="body2" fontWeight="bold" noWrap>
                              {product.name}
                            </Typography>
                            <Typography variant="h6" color="primary.main" sx={{ my: 1 }}>
                              ${product.price.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Stock: {product.quantity_in_stock}
                            </Typography>
                            {product.quantity_in_stock <= (product.low_stock_threshold || 10) && (
                              <Typography variant="caption" color="error.main" display="block">
                                Low Stock
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {viewMode === 'search' ? 'No products found' : 'No products in this category'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Paper>
          </Box>
          
          {/* Cart & Checkout */}
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center">
                  <ShoppingCart sx={{ mr: 1 }} />
                  <Typography variant="h6">Cart ({cart.length} items)</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Terminal: {terminalId || 'Not connected'}
                </Typography>
              </Box>
              
              <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                {cart.map((item) => (
                  <ListItem key={item.product_id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={item.product.name}
                      secondary={`$${item.unit_price.toFixed(2)} each`}
                    />
                    <ListItemSecondaryAction>
                      <Box display="flex" alignItems="center" gap={1}>
                        <IconButton size="small" onClick={() => updateQuantity(item.product_id, -1)}>
                          <Remove />
                        </IconButton>
                        <Typography>{item.quantity}</Typography>
                        <IconButton size="small" onClick={() => updateQuantity(item.product_id, 1)}>
                          <Add />
                        </IconButton>
                        <IconButton size="small" onClick={() => removeItem(item.product_id)}>
                          <Delete />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
                {cart.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No items in cart"
                      secondary="Scan a product or search to add items"
                    />
                  </ListItem>
                )}
              </List>

              <Divider sx={{ my: 2 }} />
              
              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Subtotal:</Typography>
                  <Typography>${subtotal.toFixed(2)}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>Tax ({(taxRate * 100).toFixed(0)}%):</Typography>
                  <Typography>${taxAmount.toFixed(2)}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6">${total.toFixed(2)}</Typography>
                </Box>
                
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<PaymentIcon />}
                  onClick={() => setCheckoutDialogOpen(true)}
                  disabled={cart.length === 0 || transactionLoading}
                  sx={{ py: 1.5 }}
                >
                  {transactionLoading ? <CircularProgress size={24} /> : 'Checkout'}
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Checkout Dialog */}
        <Dialog open={checkoutDialogOpen} onClose={() => setCheckoutDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Total Amount: ${total.toFixed(2)}
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentType['method'])}
                  label="Payment Method"
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                  <MenuItem value="digital_wallet">Digital Wallet</MenuItem>
                </Select>
              </FormControl>

              {paymentMethod === 'cash' && (
                <TextField
                  fullWidth
                  label="Amount Received"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  helperText={
                    paymentAmount && parseFloat(paymentAmount) >= total
                      ? `Change: $${(parseFloat(paymentAmount) - total).toFixed(2)}`
                      : 'Amount must be equal to or greater than total'
                  }
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCheckoutDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCheckout}
              variant="contained"
              disabled={
                transactionLoading || 
                (paymentMethod === 'cash' && (!paymentAmount || parseFloat(paymentAmount) < total))
              }
            >
              {transactionLoading ? <CircularProgress size={24} /> : 'Complete Transaction'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Transaction Complete Dialog */}
        <Dialog 
          open={transactionCompleteDialogOpen} 
          onClose={() => setTransactionCompleteDialogOpen(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              textAlign: 'center',
              py: 2
            }
          }}
        >
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <CheckCircle sx={{ fontSize: 80, color: 'success.main' }} />
              
              <Typography variant="h4" color="success.main" fontWeight="bold">
                Transaction Complete!
              </Typography>
              
              <Box sx={{ textAlign: 'left', width: '100%', maxWidth: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Transaction Details:
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">Transaction ID:</Typography>
                  <Typography variant="body1" fontFamily="monospace" fontWeight="bold">
                    {completedTransactionData?.transactionId}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">Total Amount:</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    ${completedTransactionData?.totalAmount.toFixed(2)}
                  </Typography>
                </Box>
                
                {completedTransactionData?.paymentMethod === 'cash' && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1">Amount Received:</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        ${completedTransactionData?.amountReceived.toFixed(2)}
                      </Typography>
                    </Box>
                    
                    {completedTransactionData && completedTransactionData.changeAmount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" color="primary.main">Change Due:</Typography>
                        <Typography variant="h6" color="primary.main" fontWeight="bold">
                          ${completedTransactionData.changeAmount.toFixed(2)}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">Payment Method:</Typography>
                  <Typography variant="body1" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                    {completedTransactionData?.paymentMethod.replace('_', ' ')}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Thank you for your purchase!
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setTransactionCompleteDialogOpen(false)}
              variant="contained"
              size="large"
              fullWidth
              sx={{ mx: 3, mb: 2 }}
            >
              Continue
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
};

export default CheckoutPage;