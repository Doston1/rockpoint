import {
  Add,
  Delete,
  Payment as PaymentIcon,
  QrCodeScanner,
  Remove,
  Search,
  ShoppingCart,
} from '@mui/icons-material';
import {
  Alert,
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

interface CartItem extends TransactionItem {
  product: Product;
}

const CheckoutPage = () => {
  const { user } = useAuth();
  const { 
    getProductByBarcode, 
    searchProducts, 
    products, 
    loading: productsLoading, 
    error: productsError,
    clearError: clearProductsError
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentType['method']>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');

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
    if (!searchQuery.trim()) return;
    
    try {
      await searchProducts(searchQuery.trim());
    } catch (error) {
      console.error('Failed to search products:', error);
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

    const payment: PaymentType = {
      method: paymentMethod,
      amount: total,
      reference: paymentMethod === 'cash' ? undefined : `REF-${Date.now()}`,
      change_given: paymentMethod === 'cash' ? Math.max(0, parseFloat(paymentAmount) - total) : 0
    };

    const transactionData = {
      terminal_id: terminalId,
      employee_id: user.employeeId,
      subtotal,
      tax_amount: taxAmount,
      total_amount: total,
      items: cart.map(({ product, ...item }) => item),
      payments: [payment]
    };

    try {
      const transaction = await createTransaction(transactionData);
      
      if (transaction) {
        // Sync with WebSocket if connected
        if (isConnected) {
          syncTransaction(transaction);
        }
        
        // Clear cart and close dialog
        setCart([]);
        setCheckoutDialogOpen(false);
        setPaymentAmount('');
        
        alert(`Transaction completed successfully!\nTransaction ID: ${transaction.id}`);
      }
    } catch (error) {
      console.error('Checkout failed:', error);
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
            {productsError || transactionError}
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
                <TextField
                  fullWidth
                  label="Search products"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchProducts()}
                  disabled={productsLoading}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleSearchProducts} disabled={productsLoading}>
                        {productsLoading ? <CircularProgress size={24} /> : <Search />}
                      </IconButton>
                    ),
                  }}
                />
              </Box>

              {/* Search Results */}
              <Typography variant="subtitle1" gutterBottom>
                {products.length > 0 ? 'Search Results' : 'Quick Access Products'}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, 1fr)',
                    sm: 'repeat(4, 1fr)',
                    md: 'repeat(3, 1fr)',
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
                      sx={{ cursor: 'pointer' }}
                      onClick={() => addToCart(product)}
                    >
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {product.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ${product.price.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Stock: {product.quantity_in_stock}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  // Placeholder quick access items when no search results
                  ['Water 0.5L', 'Coffee', 'Sandwich', 'Chips'].map((productName) => (
                    <Card key={productName} sx={{ cursor: 'pointer', opacity: 0.6 }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2">{productName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Demo item
                        </Typography>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Box>
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
      </Container>
    </>
  );
};

export default CheckoutPage;