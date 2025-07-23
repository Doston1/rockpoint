import { AccountCircle, Lock, Store } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const LoginPage = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const { login, isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Navigate based on role instead of previous location
      const defaultRoute = getDefaultRoute(user.role);
      navigate(defaultRoute, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const getDefaultRoute = (role: string) => {
    switch (role) {
      case 'admin':
      case 'manager':
        return '/dashboard';
      case 'cashier':
      case 'supervisor':
      default:
        return '/checkout';
    }
  };

  const handleLogin = async () => {
    if (!employeeId || !pin) {
      setError('Please enter both Employee ID and PIN');
      return;
    }

    setError('');
    setIsLoggingIn(true);

    try {
      const result = await login(employeeId, pin);
      
      if (result.success) {
        // Don't navigate here - let the useEffect handle it based on role
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error: any) {
      setError(error.message || 'Network error occurred');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoggingIn) {
      handleLogin();
    }
  };

  // Show loading if checking authentication status
  if (isLoading) {
    return (
      <Container maxWidth="sm">
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          gap={2}
        >
          <CircularProgress />
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

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
              Zentra POS
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
              disabled={isLoggingIn}
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
              disabled={isLoggingIn}
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
              disabled={isLoggingIn || !employeeId || !pin}
              sx={{ py: 1.5, fontSize: '1.1rem' }}
            >
              {isLoggingIn ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={20} color="inherit" />
                  Logging in...
                </Box>
              ) : (
                'Login'
              )}
            </Button>
          </Stack>

          <Box mt={3} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              Default: admin/admin1234 or cashier/1111
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Connect to backend server at localhost:3000
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;