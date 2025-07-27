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
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
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
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
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

  // Scanner-related state
  const [scannerMode, setScannerMode] = useState(false);
  const [productNotFoundSnackbar, setProductNotFoundSnackbar] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const taxRate = 0.08; // 8% tax rate
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Handle scanner key events
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'F' || event.key === 'f') {
        event.preventDefault();
        
        if (!scannerMode) {
          // First F pressed - enter scanner mode and focus barcode field
          setScannerMode(true);
          setBarcode('');
          setTimeout(() => {
            barcodeInputRef.current?.focus();
          }, 10);
        } else {
          // Second F pressed - process the barcode
          handleScanProduct();
          setScannerMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [scannerMode, barcode]);

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

  // Refresh products when language changes
  useEffect(() => {
    if (viewMode === 'search' && searchQuery) {
      handleSearchProducts();
    } else if (viewMode === 'products' && selectedCategory) {
      const categoryObj = categories.find(c => c.key === selectedCategory);
      if (categoryObj) {
        handleCategorySelect(selectedCategory, categoryObj.name);
      }
    }
  }, [i18n.language]); // Re-run when language changes

  const handleScanProduct = async () => {
    if (!barcode.trim()) return;
    

      // Clean the barcode - remove all '@' characters
    const cleanBarcode = barcode.trim().replace(/@/g, '');
    
    if (!cleanBarcode) {
      console.log('No valid barcode after cleaning');
      setBarcode('');
      return;
    }

    clearProductsError();
    try {
      const product = await getProductByBarcode(cleanBarcode);

      // Check if product is null (404 - not found)
      if (!product || product === null) {
        clearProductsError();
        console.log('Product not found for barcode:', cleanBarcode);
        setProductNotFoundSnackbar(true);
        setBarcode('');
        return;
      }

      // Product found - add to cart
      addToCart(product);
      setBarcode('');

      // Request real-time price if connected
      if (isConnected) {
        requestPrice(product.id, cleanBarcode);
      }
      
    } catch (error: any) {
      console.log('Error scanning product:', error);
      // Check if it's a 404 error (product not found)
      if (error.message?.includes('Product not found') || error.message?.includes('404')) {
        clearProductsError();
        setProductNotFoundSnackbar(true);
        setBarcode('');
      } else {
        console.error('Failed to scan product:', error);
      }
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

  const handleCategorySelect = async (categoryKey: string, categoryName: string) => {
    try {
      setSelectedCategory(categoryKey);
      setSelectedCategoryName(categoryName);
      await getProductsByCategory(categoryKey);
      setViewMode('products');
    } catch (error) {
      console.error('Failed to load products for category:', error);
    }
  };

  const handleBackToCategories = () => {
    setViewMode('categories');
    setSelectedCategory(null);
    setSelectedCategoryName(null);
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
          throw new Error(paymentResult.error || t('checkout.paymentProcessingFailed'));
        }
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      // Show user-friendly error
      alert(`${t('checkout.checkoutFailed')}: ${error instanceof Error ? error.message : t('checkout.unknownError')}`);
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
                {t('checkout.productScanner')}
              </Typography>
              
              {/* Scanner Status Indicator */}
              {scannerMode && (
                <Alert 
                  severity="info" 
                  sx={{ mb: 2 }}
                  icon={<QrCodeScanner />}
                >
                  {t('checkout.scannerModeActive')}
                </Alert>
              )}
              
              {/* Barcode Scanner */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label={t('checkout.scanOrEnterBarcode')}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleScanProduct()}
                  disabled={productsLoading}
                  inputRef={barcodeInputRef}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: scannerMode ? 'action.hover' : 'background.paper',
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleScanProduct} disabled={productsLoading}>
                        {productsLoading ? <CircularProgress size={24} /> : <QrCodeScanner />}
                      </IconButton>
                    ),
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {t('checkout.pressF')}
                </Typography>
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
                      label={t('checkout.searchProducts')}
                      placeholder={t('checkout.typeToSearch')}
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
                                title={t('checkout.clearSearch')}
                              >
                                ×
                              </IconButton>
                            )}
                            <IconButton 
                              onClick={() => searchQuery && handleSearchProducts()} 
                              disabled={productsLoading || !searchQuery}
                              title={t('checkout.searchAllProducts')}
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
                              {option.category && `${option.category} • `}{t('checkout.stockLabel')} {option.quantity_in_stock}
                              {option.barcode && ` • ${option.barcode}`}
                            </Typography>
                            <Typography variant="body2" color="primary.main" fontWeight="bold">
                              ${option.price.toFixed(2)}
                            </Typography>
                          </Box>
                          {option.quantity_in_stock <= (option.low_stock_threshold || 10) && (
                            <Typography variant="caption" color="error.main">
                              {t('checkout.lowStockWarning')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  }}
                  noOptionsText={
                    searchQuery.length < 2 
                      ? t('checkout.typeToSearchProducts')
                      : productsLoading 
                        ? t('checkout.searching')
                        : searchQuery.length > 0
                          ? t('checkout.noProductsFound')
                          : t('checkout.startTypingToSearch')
                  }
                  loading={productsLoading}
                  loadingText={t('checkout.searching')}
                  openOnFocus={false} // Only open when there are suggestions
                  clearOnBlur={false} // Keep the input value when losing focus
                />
              </Box>

              {/* Categories/Products Display */}
              {viewMode === 'categories' && (
                <>
                  <Typography variant="subtitle1" gutterBottom>
                    {t('checkout.selectCategory')}
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
                        key={category.key} 
                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                        onClick={() => handleCategorySelect(category.key, category.name)}
                      >
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                          <Typography variant="h6" fontWeight="bold">
                            {category.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {category.product_count} {t('checkout.products')}
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
                      {viewMode === 'search' ? t('checkout.searchResults') : `${selectedCategoryName} ${t('checkout.products')}`}
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={handleBackToCategories}
                      sx={{ minWidth: 'auto' }}
                    >
                      {t('checkout.backToCategories')}
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
                              {t('checkout.stockLabel')} {product.quantity_in_stock}
                            </Typography>
                            {product.quantity_in_stock <= (product.low_stock_threshold || 10) && (
                              <Typography variant="caption" color="error.main" display="block">
                                {t('checkout.lowStockWarning')}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {viewMode === 'search' ? t('checkout.noProductsFound') : t('checkout.noProductsInCategory')}
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
                  <Typography variant="h6">{t('checkout.cart')} ({cart.length} {t('checkout.items')})</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('checkout.terminal')}: {terminalId || t('checkout.notConnected')}
                </Typography>
              </Box>
              
              <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                {cart.map((item) => (
                  <ListItem key={item.product_id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={item.product.name}
                      secondary={`$${item.unit_price.toFixed(2)} ${t('checkout.each')}`}
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
                      primary={t('checkout.noItemsInCart')}
                      secondary={t('checkout.scanProductToAdd')}
                    />
                  </ListItem>
                )}
              </List>

              <Divider sx={{ my: 2 }} />
              
              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>{t('checkout.subtotal')}:</Typography>
                  <Typography>${subtotal.toFixed(2)}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography>{t('checkout.tax')} ({(taxRate * 100).toFixed(0)}%):</Typography>
                  <Typography>${taxAmount.toFixed(2)}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Typography variant="h6">{t('checkout.total')}:</Typography>
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
                  {transactionLoading ? <CircularProgress size={24} /> : t('checkout.checkout')}
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Checkout Dialog */}
        <Dialog open={checkoutDialogOpen} onClose={() => setCheckoutDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('checkout.completePayment')}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {t('checkout.totalAmount')}: ${total.toFixed(2)}
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>{t('checkout.paymentMethod')}</InputLabel>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentType['method'])}
                  label={t('checkout.paymentMethod')}
                >
                  <MenuItem value="cash">{t('checkout.cash')}</MenuItem>
                  <MenuItem value="card">{t('checkout.card')}</MenuItem>
                  <MenuItem value="digital_wallet">{t('checkout.digitalWallet')}</MenuItem>
                </Select>
              </FormControl>

              {paymentMethod === 'cash' && (
                <TextField
                  fullWidth
                  label={t('checkout.amountReceived')}
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  helperText={
                    paymentAmount && parseFloat(paymentAmount) >= total
                      ? `${t('checkout.change')}: $${(parseFloat(paymentAmount) - total).toFixed(2)}`
                      : t('checkout.amountMustBeGreater')
                  }
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCheckoutDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button 
              onClick={handleCheckout}
              variant="contained"
              disabled={
                transactionLoading || 
                (paymentMethod === 'cash' && (!paymentAmount || parseFloat(paymentAmount) < total))
              }
            >
              {transactionLoading ? <CircularProgress size={24} /> : t('checkout.completeTransaction')}
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
                {t('checkout.transactionComplete')}
              </Typography>
              
              <Box sx={{ textAlign: 'left', width: '100%', maxWidth: 400 }}>
                <Typography variant="h6" gutterBottom>
                  {t('checkout.transactionDetails')}
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">{t('checkout.transactionId')}</Typography>
                  <Typography variant="body1" fontFamily="monospace" fontWeight="bold">
                    {completedTransactionData?.transactionId}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">{t('checkout.totalAmount')}:</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    ${completedTransactionData?.totalAmount.toFixed(2)}
                  </Typography>
                </Box>
                
                {completedTransactionData?.paymentMethod === 'cash' && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body1">{t('checkout.amountReceivedLabel')}</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        ${completedTransactionData?.amountReceived.toFixed(2)}
                      </Typography>
                    </Box>
                    
                    {completedTransactionData && completedTransactionData.changeAmount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body1" color="primary.main">{t('checkout.changeDue')}</Typography>
                        <Typography variant="h6" color="primary.main" fontWeight="bold">
                          ${completedTransactionData.changeAmount.toFixed(2)}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body1">{t('checkout.paymentMethod')}:</Typography>
                  <Typography variant="body1" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                    {completedTransactionData?.paymentMethod.replace('_', ' ')}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                {t('checkout.thankYou')}
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
              {t('checkout.newTransaction')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Product Not Found Snackbar */}
        <Snackbar
          open={productNotFoundSnackbar}
          autoHideDuration={3000}
          onClose={() => setProductNotFoundSnackbar(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setProductNotFoundSnackbar(false)} 
            severity="warning" 
            sx={{ width: '100%' }}
          >
            {t('checkout.productNotFound')}
          </Alert>
        </Snackbar>
      </Container>
    </>
  );
};

export default CheckoutPage;