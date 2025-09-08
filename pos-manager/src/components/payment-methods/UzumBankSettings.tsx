import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface PaymentMethod {
  payment_method_code: string;
  payment_method_name: string;
  is_enabled: boolean;
  priority: number;
  daily_limit?: number;
  transaction_limit?: number;
  credentials_configured: boolean;
  last_sync_at?: string;
  sync_status: 'pending' | 'synced' | 'error';
  error_message?: string;
}

interface UzumBankSettingsProps {
  paymentMethod: PaymentMethod;
  onUpdate: () => void;
}

interface UzumBankCredentials {
  merchant_service_user_id?: string;
  secret_key?: string;
  service_id?: string;
  api_base_url?: string;
  request_timeout_ms?: string;
  cashbox_code_prefix?: string;
  max_retry_attempts?: string;
  enable_logging?: string;
}

const UzumBankSettings: React.FC<UzumBankSettingsProps> = ({ paymentMethod, onUpdate }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<UzumBankCredentials>({});
  const [statusData, setStatusData] = useState<any>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await api.getPaymentMethodCredentials('uzum_fastpay');
      
      if (response.success && response.data) {
        const creds: UzumBankCredentials = {};
        Object.entries(response.data.credentials).forEach(([key, value]: [string, any]) => {
          creds[key as keyof UzumBankCredentials] = value.value;
        });
        setCredentials(creds);
      }
    } catch (error: any) {
      console.error('Failed to load credentials:', error);
      setAlert({ type: 'error', message: t('uzumBank.configurationLoadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialChange = (key: keyof UzumBankCredentials, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setAlert(null);

      // Prepare credentials for saving
      const credentialsToSave: Record<string, string> = {};
      Object.entries(credentials).forEach(([key, value]) => {
        if (value) {
          credentialsToSave[key] = value;
        }
      });

      const response = await api.updatePaymentMethodCredentials('uzum_fastpay', {
        credentials: credentialsToSave,
        is_test_environment: true // Default to test environment
      });

      if (response.success) {
        setAlert({ type: 'success', message: t('uzumBank.configurationSavedSuccess') });
        onUpdate(); // Refresh parent component
      } else {
        setAlert({ type: 'error', message: response.error || t('uzumBank.configurationSaveFailed') });
      }
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      setAlert({ type: 'error', message: t('uzumBank.configurationSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setAlert(null);

      const response = await api.testPaymentMethodConnection('uzum_fastpay');

      if (response.success) {
        setStatusData(response.data);
        setAlert({ type: 'success', message: t('uzumBank.connectionTestSuccess') });
      } else {
        setAlert({ type: 'error', message: response.error || t('uzumBank.connectionTestFailed') });
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setAlert({ type: 'error', message: t('uzumBank.connectionTestFailed') });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800 }}>
      {/* Alert Messages */}
      {alert && (
        <Alert severity={alert.type} sx={{ mb: 3 }} onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      {/* Status Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('uzumBank.configurationStatus')}
          </Typography>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: 2,
            mt: 2
          }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  {t('uzumBank.fastPayIntegration')}:
                </Typography>
                <Chip 
                  label={paymentMethod.credentials_configured ? t('uzumBank.ready') : t('uzumBank.configurationNeeded')}
                  color={paymentMethod.credentials_configured ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  {t('uzumBank.requiredFields')}:
                </Typography>
                <Chip 
                  label={
                    credentials.merchant_service_user_id && credentials.secret_key && credentials.service_id
                      ? t('uzumBank.allRequiredFieldsConfigured')
                      : t('uzumBank.missingRequiredFields')
                  }
                  color={
                    credentials.merchant_service_user_id && credentials.secret_key && credentials.service_id
                      ? 'success' 
                      : 'error'
                  }
                  size="small"
                />
              </Box>
            </Box>
            
            <Box>
              {statusData && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {t('uzumBank.integrationInfo')}:
                  </Typography>
                  <Typography variant="caption" display="block">
                    {t('uzumBank.apiVersion')}: {statusData.connection_test?.api_version || 'N/A'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Response Time: {statusData.connection_test?.response_time_ms || 'N/A'}ms
                  </Typography>
                  <Typography variant="caption" display="block">
                    Environment: {statusData.connection_test?.environment || 'N/A'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('uzumBank.configuration')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('uzumBank.configurationDescription')}
          </Typography>

          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: 3 
          }}>
            {/* Required Fields */}
            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.merchantServiceUserId')}
                value={credentials.merchant_service_user_id || ''}
                onChange={(e) => handleCredentialChange('merchant_service_user_id', e.target.value)}
                placeholder={t('uzumBank.merchantServiceUserIdPlaceholder')}
                helperText={t('uzumBank.merchantServiceUserIdDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.secretKey')}
                type="password"
                value={credentials.secret_key || ''}
                onChange={(e) => handleCredentialChange('secret_key', e.target.value)}
                placeholder={t('uzumBank.secretKeyPlaceholder')}
                helperText={t('uzumBank.secretKeyDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.serviceId')}
                value={credentials.service_id || ''}
                onChange={(e) => handleCredentialChange('service_id', e.target.value)}
                placeholder={t('uzumBank.serviceIdPlaceholder')}
                helperText={t('uzumBank.serviceIdDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            {/* Optional Configuration Fields */}
            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.apiBaseUrl')}
                value={credentials.api_base_url || ''}
                onChange={(e) => handleCredentialChange('api_base_url', e.target.value)}
                placeholder={t('uzumBank.apiBaseUrlPlaceholder')}
                helperText={t('uzumBank.apiBaseUrlDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.requestTimeout')}
                type="number"
                value={credentials.request_timeout_ms || ''}
                onChange={(e) => handleCredentialChange('request_timeout_ms', e.target.value)}
                placeholder={t('uzumBank.requestTimeoutPlaceholder')}
                helperText={t('uzumBank.requestTimeoutDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.cashboxCodePrefix')}
                value={credentials.cashbox_code_prefix || ''}
                onChange={(e) => handleCredentialChange('cashbox_code_prefix', e.target.value)}
                placeholder={t('uzumBank.cashboxCodePrefixPlaceholder')}
                helperText={t('uzumBank.cashboxCodePrefixDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.maxRetryAttempts')}
                type="number"
                value={credentials.max_retry_attempts || ''}
                onChange={(e) => handleCredentialChange('max_retry_attempts', e.target.value)}
                placeholder={t('uzumBank.maxRetryAttemptsPlaceholder')}
                helperText={t('uzumBank.maxRetryAttemptsDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('uzumBank.enableLogging')}
                value={credentials.enable_logging || ''}
                onChange={(e) => handleCredentialChange('enable_logging', e.target.value)}
                placeholder={t('uzumBank.enableLoggingPlaceholder')}
                helperText={t('uzumBank.enableLoggingDescription')}
                sx={{ mb: 2 }}
              />
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !credentials.merchant_service_user_id || !credentials.secret_key || !credentials.service_id}
              startIcon={saving ? <CircularProgress size={20} /> : undefined}
            >
              {saving ? t('uzumBank.saving') : t('uzumBank.saveConfiguration')}
            </Button>

            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testing || !paymentMethod.credentials_configured}
              startIcon={testing ? <CircularProgress size={20} /> : undefined}
            >
              {testing ? t('uzumBank.testing') : t('uzumBank.testConnection')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UzumBankSettings;
