import {
  Add,
  ArrowBack,
  Delete,
  Payment,
  QrCodeScanner,
  Remove,
  ShoppingCart,
} from '@mui/icons-material';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState<CartItem[]>([
    { id: '1', name: 'Coca Cola 0.5L', price: 2.50, quantity: 2 },
    { id: '2', name: 'Bread', price: 1.20, quantity: 1 },
  ]);

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleScanProduct = () => {
    // TODO: Implement barcode scanning
    console.log('Scanning:', barcode);
    setBarcode('');
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(prev => prev.map(item => 
      item.id === id 
        ? { ...item, quantity: Math.max(0, item.quantity + change) }
        : item
    ).filter(item => item.quantity > 0));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCheckout = () => {
    // TODO: Implement checkout process
    alert(`Checkout completed! Total: $${total.toFixed(2)}`);
    setCart([]);
  };

  return (
    <>
      <AppBar position="sticky">
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate('/dashboard')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Point of Sale
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 2, mb: 2 }}>
        <Box 
          sx={{
            display: 'flex',
            gap: 2,
            height: 'calc(100vh - 100px)',
            flexDirection: { xs: 'column', md: 'row' }
          }}
        >
          {/* Product Scanner */}
          <Box sx={{ flex: { xs: 1, md: 2 } }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Product Scanner
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  label="Scan or enter barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleScanProduct()}
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleScanProduct}>
                        <QrCodeScanner />
                      </IconButton>
                    ),
                  }}
                />
              </Box>

              {/* Quick Access Products */}
              <Typography variant="subtitle1" gutterBottom>
                Quick Access Products
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
                }}
              >
                {['Water 0.5L', 'Coffee', 'Sandwich', 'Chips'].map((product) => (
                  <Card key={product} sx={{ cursor: 'pointer' }}>
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="body2">{product}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          </Box>
          
          {/* Cart & Checkout */}
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box display="flex" alignItems="center" mb={2}>
                <ShoppingCart sx={{ mr: 1 }} />
                <Typography variant="h6">Cart ({cart.length} items)</Typography>
              </Box>
              
              <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                {cart.map((item) => (
                  <ListItem key={item.id} sx={{ px: 0 }}>
                    <ListItemText
                      primary={item.name}
                      secondary={`$${item.price.toFixed(2)} each`}
                    />
                    <ListItemSecondaryAction>
                      <Box display="flex" alignItems="center" gap={1}>
                        <IconButton size="small" onClick={() => updateQuantity(item.id, -1)}>
                          <Remove />
                        </IconButton>
                        <Typography>{item.quantity}</Typography>
                        <IconButton size="small" onClick={() => updateQuantity(item.id, 1)}>
                          <Add />
                        </IconButton>
                        <IconButton size="small" onClick={() => removeItem(item.id)}>
                          <Delete />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />
              
              <Box>
                <Typography variant="h5" textAlign="center" mb={2}>
                  Total: ${total.toFixed(2)}
                </Typography>
                
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<Payment />}
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  sx={{ py: 1.5 }}
                >
                  Checkout
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Container>
    </>
  );
};

export default CheckoutPage;