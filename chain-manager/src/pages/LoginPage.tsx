import { Business, Lock, Person } from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    console.log('🔥 Login button clicked');
    setError('');
    
    if (!email || !password) {
      console.log('❌ Missing credentials:', { email: !!email, password: !!password });
      setError(t('auth.pleaseEnterCredentials'));
      return;
    }

    // Trim whitespace from inputs
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    console.log('🧹 Trimmed credentials:', { email: trimmedEmail, password: '***' });

    console.log('🔄 Setting loading state to true');
    setIsLoggingIn(true);
    
    try {
      console.log('📞 Calling login function...');
      const result = await login(trimmedEmail, trimmedPassword);
      console.log('📋 Login result received:', result);
      
      if (result.success) {
        console.log('🎉 Login successful, navigating to dashboard');
        navigate('/dashboard');
      } else {
        console.log('❌ Login failed with error:', result.error);
        setError(result.error || t('auth.loginFailed'));
      }
    } catch (err) {
      console.error('💥 Login exception caught:', err);
      setError(t('auth.loginFailed'));
    } finally {
      console.log('🔄 Setting loading state to false');
      setIsLoggingIn(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  if (isLoading) {
    return (
      <Container 
        maxWidth="sm" 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh' 
        }}
      >
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          py: 3,
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Business sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                {t('auth.mainOfficeLogin')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('auth.signInDescription')}
              </Typography>
            </Box>

            {/* Default Credentials Information */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>{t('auth.defaultCredentials')}</strong>
                  </Typography>
                  <Typography variant="body2" component="div">
                    {t('auth.defaultEmail')}<br />
                    {t('auth.defaultPassword')}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setEmail('admin@rockpoint.com');
                    setPassword('admin123');
                  }}
                  disabled={isLoggingIn}
                >
                  {t('auth.useDefault')}
                </Button>
              </Box>
            </Alert>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Stack spacing={3}>
              <TextField
                fullWidth
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person />
                    </InputAdornment>
                  ),
                }}
                disabled={isLoggingIn}
              />

              <TextField
                fullWidth
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock />
                    </InputAdornment>
                  ),
                }}
                disabled={isLoggingIn}
              />

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLogin}
                disabled={isLoggingIn || !email || !password}
                sx={{ py: 1.5 }}
              >
                {isLoggingIn ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  t('auth.signIn')
                )}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default LoginPage;
