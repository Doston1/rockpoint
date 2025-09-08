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

interface ClickPaySettingsProps {
  paymentMethod: PaymentMethod;
  onUpdate: () => void;
}

interface ClickCredentials {
  merchant_id?: string;
  service_id?: string;
  merchant_user_id?: string;
  secret_key?: string;
  cashbox_code?: string;
  api_base_url?: string;
  request_timeout_ms?: string;
  max_retry_attempts?: string;
  confirmation_mode?: string;
  enable_logging?: string;
}

const ClickPaySettings: React.FC<ClickPaySettingsProps> = ({ paymentMethod, onUpdate }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<ClickCredentials>({});
  const [statusData, setStatusData] = useState<any>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await api.getPaymentMethodCredentials('click');
      
      if (response.success && response.data) {
        const creds: ClickCredentials = {};
        Object.entries(response.data.credentials).forEach(([key, value]: [string, any]) => {
          creds[key as keyof ClickCredentials] = value.value;
        });
        setCredentials(creds);
      }
    } catch (error: any) {
      console.error('Failed to load credentials:', error);
      setAlert({ type: 'error', message: t('clickPay.configurationLoadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialChange = (key: keyof ClickCredentials, value: string) => {
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

      const response = await api.updatePaymentMethodCredentials('click', {
        credentials: credentialsToSave,
        is_test_environment: true // Default to test environment
      });

      if (response.success) {
        setAlert({ type: 'success', message: t('clickPay.configurationSavedSuccess') });
        onUpdate(); // Refresh parent component
      } else {
        setAlert({ type: 'error', message: response.error || t('clickPay.configurationSaveFailed') });
      }
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      setAlert({ type: 'error', message: t('clickPay.configurationSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setAlert(null);

      const response = await api.testPaymentMethodConnection('click');

      if (response.success) {
        setStatusData(response.data);
        setAlert({ type: 'success', message: t('clickPay.connectionTestSuccess') });
      } else {
        setAlert({ type: 'error', message: response.error || t('clickPay.connectionTestFailed') });
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setAlert({ type: 'error', message: t('clickPay.connectionTestFailed') });
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
            {t('clickPay.configurationStatus')}
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
                  {t('clickPay.integration')}:
                </Typography>
                <Chip 
                  label={paymentMethod.credentials_configured ? t('clickPay.ready') : t('clickPay.configurationNeeded')}
                  color={paymentMethod.credentials_configured ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  {t('clickPay.requiredFields')}:
                </Typography>
                <Chip 
                  label={
                    credentials.merchant_id && credentials.service_id && credentials.merchant_user_id && credentials.secret_key
                      ? t('clickPay.allRequiredFieldsConfigured')
                      : t('clickPay.missingRequiredFields')
                  }
                  color={
                    credentials.merchant_id && credentials.service_id && credentials.merchant_user_id && credentials.secret_key
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
                    {t('clickPay.integrationInfo')}:
                  </Typography>
                  <Typography variant="caption" display="block">
                    {t('clickPay.apiVersion')}: {statusData.connection_test?.api_version || 'N/A'}
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
            {t('clickPay.configuration')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('clickPay.configurationDescription')}
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
                label={t('clickPay.merchantId')}
                value={credentials.merchant_id || ''}
                onChange={(e) => handleCredentialChange('merchant_id', e.target.value)}
                placeholder={t('clickPay.merchantIdPlaceholder')}
                helperText={t('clickPay.merchantIdDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.serviceId')}
                value={credentials.service_id || ''}
                onChange={(e) => handleCredentialChange('service_id', e.target.value)}
                placeholder={t('clickPay.serviceIdPlaceholder')}
                helperText={t('clickPay.serviceIdDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.merchantUserId')}
                value={credentials.merchant_user_id || ''}
                onChange={(e) => handleCredentialChange('merchant_user_id', e.target.value)}
                placeholder={t('clickPay.merchantUserIdPlaceholder')}
                helperText={t('clickPay.merchantUserIdDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.secretKey')}
                type="password"
                value={credentials.secret_key || ''}
                onChange={(e) => handleCredentialChange('secret_key', e.target.value)}
                placeholder={t('clickPay.secretKeyPlaceholder')}
                helperText={t('clickPay.secretKeyDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            {/* Optional Configuration Fields */}
            <Box>
              <TextField
                fullWidth
                label={t('clickPay.cashboxCode')}
                value={credentials.cashbox_code || ''}
                onChange={(e) => handleCredentialChange('cashbox_code', e.target.value)}
                placeholder={t('clickPay.cashboxCodePlaceholder')}
                helperText={t('clickPay.cashboxCodeDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.apiBaseUrl')}
                value={credentials.api_base_url || ''}
                onChange={(e) => handleCredentialChange('api_base_url', e.target.value)}
                placeholder={t('clickPay.apiBaseUrlPlaceholder')}
                helperText={t('clickPay.apiBaseUrlDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.requestTimeout')}
                type="number"
                value={credentials.request_timeout_ms || ''}
                onChange={(e) => handleCredentialChange('request_timeout_ms', e.target.value)}
                placeholder={t('clickPay.requestTimeoutPlaceholder')}
                helperText={t('clickPay.requestTimeoutDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.maxRetryAttempts')}
                type="number"
                value={credentials.max_retry_attempts || ''}
                onChange={(e) => handleCredentialChange('max_retry_attempts', e.target.value)}
                placeholder={t('clickPay.maxRetryAttemptsPlaceholder')}
                helperText={t('clickPay.maxRetryAttemptsDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.confirmationMode')}
                value={credentials.confirmation_mode || ''}
                onChange={(e) => handleCredentialChange('confirmation_mode', e.target.value)}
                placeholder={t('clickPay.confirmationModePlaceholder')}
                helperText={t('clickPay.confirmationModeDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('clickPay.enableLogging')}
                value={credentials.enable_logging || ''}
                onChange={(e) => handleCredentialChange('enable_logging', e.target.value)}
                placeholder={t('clickPay.enableLoggingPlaceholder')}
                helperText={t('clickPay.enableLoggingDescription')}
                sx={{ mb: 2 }}
              />
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !credentials.merchant_id || !credentials.service_id || !credentials.merchant_user_id || !credentials.secret_key}
              startIcon={saving ? <CircularProgress size={20} /> : undefined}
            >
              {saving ? t('clickPay.saving') : t('clickPay.saveConfiguration')}
            </Button>

            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testing || !paymentMethod.credentials_configured}
              startIcon={testing ? <CircularProgress size={20} /> : undefined}
            >
              {testing ? t('clickPay.testing') : t('clickPay.testConnection')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClickPaySettings;
