import {
  AccountBalance,
  ArrowBack,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NavigationBar } from '../components/NavigationBar';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

// Import individual payment method settings components
import ClickPaySettings from '../components/payment-methods/ClickPaySettings';
import PaymeSettings from '../components/payment-methods/PaymeSettings';
import UzumBankSettings from '../components/payment-methods/UzumBankSettings';

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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`payment-method-tabpanel-${index}`}
      aria-labelledby={`payment-method-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const PaymentMethodsSettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  // Check admin access
  if (!user || user.role !== 'admin') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">
          {t('settings.accessDenied')}
        </Alert>
      </Container>
    );
  }

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getPaymentMethodsStatus();
      const methods = response.data?.payment_methods || [];

      // Filter only enabled methods for tabs
      const enabledMethods = methods.filter((method: PaymentMethod) => method.is_enabled);
      setPaymentMethods(enabledMethods);

      // Set active tab to first enabled method
      if (enabledMethods.length > 0) {
        setActiveTab(0);
      }
    } catch (error: any) {
      console.error('Failed to load payment methods:', error);
      setError(error.response?.data?.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getStatusIcon = (method: PaymentMethod) => {
    if (!method.credentials_configured) {
      return <Warning color="warning" />;
    }
    if (method.sync_status === 'error') {
      return <Error color="error" />;
    }
    return <CheckCircle color="success" />;
  };

  const getStatusText = (method: PaymentMethod) => {
    if (!method.credentials_configured) {
      return t('paymentMethods.configurationNeeded');
    }
    if (method.sync_status === 'error') {
      return t('paymentMethods.error');
    }
    return t('paymentMethods.ready');
  };

  const renderPaymentMethodSettings = (method: PaymentMethod) => {
    switch (method.payment_method_code) {
      case 'uzum_fastpay':
        return <UzumBankSettings paymentMethod={method} onUpdate={loadPaymentMethods} />;
      case 'click':
        return <ClickPaySettings paymentMethod={method} onUpdate={loadPaymentMethods} />;
      case 'payme':
        return <PaymeSettings paymentMethod={method} onUpdate={loadPaymentMethods} />;
      default:
        return (
          <Alert severity="info">
            {t('paymentMethods.settingsNotAvailable', { method: method.payment_method_name })}
          </Alert>
        );
    }
  };

  if (loading) {
    return (
      <>
        <NavigationBar />
        <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavigationBar />
        <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="outlined" onClick={loadPaymentMethods}>
            {t('common.retry')}
          </Button>
        </Container>
      </>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <>
        <NavigationBar />
        <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>
          <Box sx={{ mb: 4 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/settings')}
              sx={{ mb: 2 }}
            >
              {t('settings.backToSettings')}
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccountBalance sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
              <Typography variant="h4" fontWeight="bold">
                {t('paymentMethods.title')}
              </Typography>
            </Box>
          </Box>

          <Alert severity="info">
            {t('paymentMethods.noMethodsEnabled')}
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <NavigationBar />

      <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/settings')}
            sx={{ mb: 2 }}
          >
            {t('settings.backToSettings')}
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <AccountBalance sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight="bold">
              {t('paymentMethods.title')}
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {t('paymentMethods.subtitle')}
          </Typography>
        </Box>

        {/* Payment Methods Status Overview */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('paymentMethods.statusOverview')}
            </Typography>

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 2,
              mt: 2
            }}>
              {paymentMethods.map((method) => (
                <Box
                  key={method.payment_method_code}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}
                >
                  {getStatusIcon(method)}
                  <Box sx={{ ml: 2, flexGrow: 1 }}>
                    <Typography variant="subtitle2" fontWeight="medium">
                      {method.payment_method_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getStatusText(method)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Payment Method Tabs */}
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="payment method settings tabs">
              {paymentMethods.map((method, index) => (
                <Tab
                  key={method.payment_method_code}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getStatusIcon(method)}
                      <Box sx={{ ml: 1 }}>
                        {method.payment_method_name}
                      </Box>
                    </Box>
                  }
                  id={`payment-method-tab-${index}`}
                  aria-controls={`payment-method-tabpanel-${index}`}
                />
              ))}
            </Tabs>
          </Box>

          {/* Tab Panels */}
          {paymentMethods.map((method, index) => (
            <TabPanel key={method.payment_method_code} value={activeTab} index={index}>
              {renderPaymentMethodSettings(method)}
            </TabPanel>
          ))}
        </Card>
      </Container>
    </>
  );
};

export default PaymentMethodsSettingsPage;
