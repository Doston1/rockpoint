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

interface PaymeSettingsProps {
  paymentMethod: PaymentMethod;
  onUpdate: () => void;
}

interface PaymeCredentials {
  cashbox_id?: string;
  key_password?: string;
  api_base_url?: string;
  request_timeout_ms?: string;
  receipt_lifetime_ms?: string;
  status_check_interval_ms?: string;
  max_status_checks?: string;
  max_retry_attempts?: string;
  enable_fiscal_receipts?: string;
  enable_logging?: string;
}

const PaymeSettings: React.FC<PaymeSettingsProps> = ({ paymentMethod, onUpdate }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<PaymeCredentials>({});
  const [statusData, setStatusData] = useState<any>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await api.getPaymentMethodCredentials('payme');
      
      if (response.success && response.data) {
        const creds: PaymeCredentials = {};
        Object.entries(response.data.credentials).forEach(([key, value]: [string, any]) => {
          creds[key as keyof PaymeCredentials] = value.value;
        });
        setCredentials(creds);
      }
    } catch (error: any) {
      console.error('Failed to load credentials:', error);
      setAlert({ type: 'error', message: t('payme.configurationLoadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialChange = (key: keyof PaymeCredentials, value: string) => {
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

      const response = await api.updatePaymentMethodCredentials('payme', {
        credentials: credentialsToSave,
        is_test_environment: true // Default to test environment
      });

      if (response.success) {
        setAlert({ type: 'success', message: t('payme.configurationSavedSuccess') });
        onUpdate(); // Refresh parent component
      } else {
        setAlert({ type: 'error', message: response.error || t('payme.configurationSaveFailed') });
      }
    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      setAlert({ type: 'error', message: t('payme.configurationSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setAlert(null);

      const response = await api.testPaymentMethodConnection('payme');

      if (response.success) {
        setStatusData(response.data);
        setAlert({ type: 'success', message: t('payme.connectionTestSuccess') });
      } else {
        setAlert({ type: 'error', message: response.error || t('payme.connectionTestFailed') });
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setAlert({ type: 'error', message: t('payme.connectionTestFailed') });
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
            {t('payme.configurationStatus')}
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
                  {t('payme.integration')}:
                </Typography>
                <Chip 
                  label={paymentMethod.credentials_configured ? t('payme.ready') : t('payme.configurationNeeded')}
                  color={paymentMethod.credentials_configured ? 'success' : 'warning'}
                  size="small"
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  {t('payme.requiredFields')}:
                </Typography>
                <Chip 
                  label={
                    credentials.cashbox_id && credentials.key_password
                      ? t('payme.allRequiredFieldsConfigured')
                      : t('payme.missingRequiredFields')
                  }
                  color={
                    credentials.cashbox_id && credentials.key_password
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
                    {t('payme.integrationInfo')}:
                  </Typography>
                  <Typography variant="caption" display="block">
                    {t('payme.apiVersion')}: {statusData.connection_test?.api_version || 'N/A'}
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
            {t('payme.configuration')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('payme.configurationDescription')}
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
                label={t('payme.cashboxId')}
                value={credentials.cashbox_id || ''}
                onChange={(e) => handleCredentialChange('cashbox_id', e.target.value)}
                placeholder={t('payme.cashboxIdPlaceholder')}
                helperText={t('payme.cashboxIdDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.keyPassword')}
                type="password"
                value={credentials.key_password || ''}
                onChange={(e) => handleCredentialChange('key_password', e.target.value)}
                placeholder={t('payme.keyPasswordPlaceholder')}
                helperText={t('payme.keyPasswordDescription')}
                required
                sx={{ mb: 2 }}
              />
            </Box>

            {/* Optional Configuration Fields */}
            <Box>
              <TextField
                fullWidth
                label={t('payme.apiBaseUrl')}
                value={credentials.api_base_url || ''}
                onChange={(e) => handleCredentialChange('api_base_url', e.target.value)}
                placeholder={t('payme.apiBaseUrlPlaceholder')}
                helperText={t('payme.apiBaseUrlDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.requestTimeout')}
                type="number"
                value={credentials.request_timeout_ms || ''}
                onChange={(e) => handleCredentialChange('request_timeout_ms', e.target.value)}
                placeholder={t('payme.requestTimeoutPlaceholder')}
                helperText={t('payme.requestTimeoutDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.receiptLifetime')}
                type="number"
                value={credentials.receipt_lifetime_ms || ''}
                onChange={(e) => handleCredentialChange('receipt_lifetime_ms', e.target.value)}
                placeholder={t('payme.receiptLifetimePlaceholder')}
                helperText={t('payme.receiptLifetimeDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.statusCheckInterval')}
                type="number"
                value={credentials.status_check_interval_ms || ''}
                onChange={(e) => handleCredentialChange('status_check_interval_ms', e.target.value)}
                placeholder={t('payme.statusCheckIntervalPlaceholder')}
                helperText={t('payme.statusCheckIntervalDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.maxStatusChecks')}
                type="number"
                value={credentials.max_status_checks || ''}
                onChange={(e) => handleCredentialChange('max_status_checks', e.target.value)}
                placeholder={t('payme.maxStatusChecksPlaceholder')}
                helperText={t('payme.maxStatusChecksDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.maxRetryAttempts')}
                type="number"
                value={credentials.max_retry_attempts || ''}
                onChange={(e) => handleCredentialChange('max_retry_attempts', e.target.value)}
                placeholder={t('payme.maxRetryAttemptsPlaceholder')}
                helperText={t('payme.maxRetryAttemptsDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.enableFiscalReceipts')}
                value={credentials.enable_fiscal_receipts || ''}
                onChange={(e) => handleCredentialChange('enable_fiscal_receipts', e.target.value)}
                placeholder={t('payme.enableFiscalReceiptsPlaceholder')}
                helperText={t('payme.enableFiscalReceiptsDescription')}
                sx={{ mb: 2 }}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('payme.enableLogging')}
                value={credentials.enable_logging || ''}
                onChange={(e) => handleCredentialChange('enable_logging', e.target.value)}
                placeholder={t('payme.enableLoggingPlaceholder')}
                helperText={t('payme.enableLoggingDescription')}
                sx={{ mb: 2 }}
              />
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !credentials.cashbox_id || !credentials.key_password}
              startIcon={saving ? <CircularProgress size={20} /> : undefined}
            >
              {saving ? t('payme.saving') : t('payme.saveConfiguration')}
            </Button>

            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testing || !paymentMethod.credentials_configured}
              startIcon={testing ? <CircularProgress size={20} /> : undefined}
            >
              {testing ? t('payme.testing') : t('payme.testConnection')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymeSettings;
