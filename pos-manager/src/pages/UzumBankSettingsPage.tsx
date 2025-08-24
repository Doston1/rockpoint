import {
  ArrowBack,
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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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

const UzumBankSettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const CONFIG_FIELDS: ConfigField[] = [
    {
      key: 'merchant_service_user_id',
      label: t('uzumBank.merchantServiceUserId'),
      type: 'text',
      required: true,
      description: t('uzumBank.merchantServiceUserIdDescription'),
      placeholder: t('uzumBank.merchantServiceUserIdPlaceholder'),
    },
    {
      key: 'secret_key',
      label: t('uzumBank.secretKey'),
      type: 'password',
      required: true,
      description: t('uzumBank.secretKeyDescription'),
      placeholder: t('uzumBank.secretKeyPlaceholder'),
    },
    {
      key: 'service_id',
      label: t('uzumBank.serviceId'),
      type: 'text',
      required: true,
      description: t('uzumBank.serviceIdDescription'),
      placeholder: t('uzumBank.serviceIdPlaceholder'),
    },
    {
      key: 'api_base_url',
      label: t('uzumBank.apiBaseUrl'),
      type: 'url',
      required: true,
      description: t('uzumBank.apiBaseUrlDescription'),
      placeholder: t('uzumBank.apiBaseUrlPlaceholder'),
    },
    {
      key: 'request_timeout_ms',
      label: t('uzumBank.requestTimeout'),
      type: 'number',
      required: false,
      description: t('uzumBank.requestTimeoutDescription'),
      placeholder: t('uzumBank.requestTimeoutPlaceholder'),
    },
    {
      key: 'cashbox_code_prefix',
      label: t('uzumBank.cashboxCodePrefix'),
      type: 'text',
      required: false,
      description: t('uzumBank.cashboxCodePrefixDescription'),
      placeholder: t('uzumBank.cashboxCodePrefixPlaceholder'),
    },
    {
      key: 'max_retry_attempts',
      label: t('uzumBank.maxRetryAttempts'),
      type: 'number',
      required: false,
      description: t('uzumBank.maxRetryAttemptsDescription'),
      placeholder: t('uzumBank.maxRetryAttemptsPlaceholder'),
    },
    {
      key: 'enable_logging',
      label: t('uzumBank.enableLogging'),
      type: 'text',
      required: false,
      description: t('uzumBank.enableLoggingDescription'),
      placeholder: t('uzumBank.enableLoggingPlaceholder'),
    },
  ];

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
        setError(response.error || t('uzumBank.configurationLoadFailed'));
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      setError(t('uzumBank.configurationLoadFailed'));
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
        setSuccess(t('uzumBank.configurationSavedSuccess'));
      } else {
        setError(response.error || t('uzumBank.configurationSaveFailed'));
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setError(t('uzumBank.configurationSaveFailed'));
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
        {/* Header with Back Button */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/settings')}
              sx={{ mr: 2 }}
            >
              {t('settings.backToSettings')}
            </Button>
            <SettingsIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight="bold">
              {t('uzumBank.title')}
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {t('uzumBank.subtitle')}
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
                {t('uzumBank.configuration')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                {t('uzumBank.configurationDescription')}
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
                  {testing ? t('uzumBank.testing') : t('uzumBank.testConnection')}
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSave}
                  disabled={saving || !isConfigValid()}
                  startIcon={saving ? <Warning /> : <Save />}
                  sx={{ px: 4 }}
                >
                  {saving ? t('uzumBank.saving') : t('uzumBank.saveConfiguration')}
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* Side Panel */}
          <Box sx={{ width: { xs: '100%', lg: 350 } }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  {t('uzumBank.configurationStatus')}
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('uzumBank.requiredFields')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isConfigValid() ? (
                      <>
                        <Check color="success" />
                        <Typography variant="body2" color="success.main">
                          {t('uzumBank.allRequiredFieldsConfigured')}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Warning color="error" />
                        <Typography variant="body2" color="error.main">
                          {t('uzumBank.missingRequiredFields')}
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('uzumBank.fastPayIntegration')}
                  </Typography>
                  <Typography variant="body2" color={isConfigValid() ? 'success.main' : 'warning.main'}>
                    {isConfigValid() ? `✅ ${t('uzumBank.ready')}` : `⚠️ ${t('uzumBank.configurationNeeded')}`}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.lastUpdated')}
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
                  {t('uzumBank.integrationInfo')}
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>{t('uzumBank.apiVersion')}:</strong> FastPay v1.0
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>{t('uzumBank.supportedMethods')}:</strong> {t('uzumBank.qrCodePayments')}
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>{t('uzumBank.security')}:</strong> {t('uzumBank.security')}
                </Typography>
                
                <Typography variant="body2">
                  <strong>{t('uzumBank.documentation')}:</strong>{' '}
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    {t('uzumBank.fastPayGuide')}
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

export default UzumBankSettingsPage;
