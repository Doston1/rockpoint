import { AccountCircle, Lock, Store } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    if (!employeeId || !pin) {
      setError('Please enter both Employee ID and PIN');
      return;
    }

    // TODO: Implement real authentication with local server
    if (employeeId === 'admin' && pin === '1234') {
      navigate('/dashboard');
    } else if (employeeId === 'cashier' && pin === '1111') {
      navigate('/checkout');
    } else {
      setError('Invalid credentials');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        sx={{ bgcolor: 'background.default' }}
      >
        <Paper elevation={4} sx={{ p: 4, width: '100%', borderRadius: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
            <Store sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
            <Typography variant="h4" color="primary" fontWeight="bold">
              POS System
            </Typography>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="Employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: <AccountCircle sx={{ mr: 1, color: 'action.active' }} />,
              }}
              variant="outlined"
            />
            
            <TextField
              fullWidth
              type="password"
              label="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: <Lock sx={{ mr: 1, color: 'action.active' }} />,
              }}
              variant="outlined"
            />
            
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleLogin}
              sx={{ py: 1.5, fontSize: '1.1rem' }}
            >
              Login
            </Button>
          </Stack>

          <Box mt={3} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              Demo: admin/1234 or cashier/1111
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;