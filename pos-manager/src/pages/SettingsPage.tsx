import {
  Check,
  Save,
  Settings as SettingsIcon,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { NavigationBar } from '../components/NavigationBar';
import { useAuth } from '../hooks/useAuth';
import { apiService, type UzumBankConfig } from '../services/api';

interface ConfigField {
  key: keyof UzumBankConfig;
  label: string;
  type: 'text' | 'password' | 'number' | 'url';
  required: boolean;
  description: string;
  placeholder?: string;
}

const CONFIG_FIELDS: ConfigField[] = [
  {
    key: 'merchant_service_user_id',
    label: 'Merchant Service User ID',
    type: 'text',
    required: true,
    description: 'Cash register ID provided by Uzum Bank',
    placeholder: 'Enter your cash register ID',
  },
  {
    key: 'secret_key',
    label: 'Secret Key',
    type: 'password',
    required: true,
    description: 'Secret key provided by Uzum Bank for authentication',
    placeholder: 'Enter your secret key',
  },
  {
    key: 'service_id',
    label: 'Service ID',
    type: 'text',
    required: true,
    description: 'Branch/service identifier provided by Uzum Bank',
    placeholder: 'Enter your service ID',
  },
  {
    key: 'api_base_url',
    label: 'API Base URL',
    type: 'url',
    required: true,
    description: 'Uzum Bank FastPay API base URL',
    placeholder: 'https://mobile.apelsin.uz',
  },
  {
    key: 'request_timeout_ms',
    label: 'Request Timeout (ms)',
    type: 'number',
    required: false,
    description: 'HTTP request timeout in milliseconds',
    placeholder: '15000',
  },
  {
    key: 'cashbox_code_prefix',
    label: 'Cashbox Code Prefix',
    type: 'text',
    required: false,
    description: 'Prefix for cash register codes',
    placeholder: 'RockPoint',
  },
  {
    key: 'max_retry_attempts',
    label: 'Max Retry Attempts',
    type: 'number',
    required: false,
    description: 'Maximum number of retry attempts for failed payments',
    placeholder: '3',
  },
  {
    key: 'enable_logging',
    label: 'Enable Logging',
    type: 'text',
    required: false,
    description: 'Enable detailed logging for debugging (true/false)',
    placeholder: 'true',
  },
];

const SettingsPage = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<UzumBankConfig>({
    merchant_service_user_id: '',
    secret_key: '',
    service_id: '',
    api_base_url: 'https://mobile.apelsin.uz',
    request_timeout_ms: '15000',
    cashbox_code_prefix: 'RockPoint',
    max_retry_attempts: '3',
    enable_logging: 'true',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUzumBankConfig();
      
      if (response.success && response.data) {
        setConfig(response.data);
      } else {
        setError(response.error || 'Failed to load configuration');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key: keyof UzumBankConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await apiService.updateUzumBankConfig(config);
      
      if (response.success) {
        setSuccess('Configuration saved successfully!');
      } else {
        setError(response.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setError(null);
      
      const response = await apiService.testUzumBankConnection();
      
      if (response.success) {
        setSuccess('Connection test successful!');
      } else {
        setError(response.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setError('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const togglePasswordVisibility = (fieldKey: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  const isConfigValid = () => {
    const requiredFields = CONFIG_FIELDS.filter(field => field.required);
    return requiredFields.every(field => config[field.key]?.trim() !== '');
  };

  if (!user || user.role !== 'admin') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">
          Access denied. Admin privileges required.
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <NavigationBar />
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <SettingsIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight="bold">
              System Settings
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Configure Uzum Bank FastPay integration settings and system preferences.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', lg: 'row' } }}>
          {/* Main Configuration Panel */}
          <Box sx={{ flex: 1 }}>
            <Paper sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom fontWeight="bold" color="primary">
                🏦 Uzum Bank FastPay Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Configure your Uzum Bank integration settings. These credentials are provided by your Uzum Bank account manager.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {CONFIG_FIELDS.map((field) => (
                  <Box key={field.key} sx={{ display: 'flex', flexDirection: 'column' }}>
                    <TextField
                      fullWidth
                      label={field.label}
                      type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                      value={config[field.key] || ''}
                      onChange={(e) => handleConfigChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      disabled={loading}
                      helperText={field.description}
                      InputProps={{
                        ...(field.type === 'password' && {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => togglePasswordVisibility(field.key)}
                                edge="end"
                              >
                                {showPasswords[field.key] ? '🙈' : '👁️'}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }),
                      }}
                      sx={{
                        mb: 1,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: field.required && !config[field.key] ? 'error.lighter' : 'background.paper',
                        }
                      }}
                    />
                  </Box>
                ))}
              </Box>

              <Divider sx={{ my: 4 }} />

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleTestConnection}
                  disabled={testing || !isConfigValid()}
                  startIcon={testing ? <Warning /> : <SettingsIcon />}
                  sx={{ px: 4 }}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSave}
                  disabled={saving || !isConfigValid()}
                  startIcon={saving ? <Warning /> : <Save />}
                  sx={{ px: 4 }}
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* Side Panel */}
          <Box sx={{ width: { xs: '100%', lg: 350 } }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  📊 Configuration Status
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Required Fields
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isConfigValid() ? (
                      <>
                        <Check color="success" />
                        <Typography variant="body2" color="success.main">
                          All required fields configured
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Warning color="error" />
                        <Typography variant="body2" color="error.main">
                          Missing required fields
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    FastPay Integration
                  </Typography>
                  <Typography variant="body2" color={isConfigValid() ? 'success.main' : 'warning.main'}>
                    {isConfigValid() ? '✅ Ready' : '⚠️ Configuration needed'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {new Date().toLocaleString()}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  ℹ️ Integration Info
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>API Version:</strong> FastPay v1.0
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Supported Methods:</strong> QR Code Payments
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Security:</strong> SHA1 Authentication
                </Typography>
                
                <Typography variant="body2">
                  <strong>Documentation:</strong>{' '}
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    FastPay Integration Guide
                  </a>
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Success Snackbar */}
        <Snackbar
          open={!!success}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
            {success}
          </Alert>
        </Snackbar>
      </Container>
    </>
  );
};

export default SettingsPage;
