import {
  ArrowBack,
  Business,
  ContentCopy,
  CreditCard,
  Edit,
  Inventory,
  People,
  QrCode,
  Receipt,
  Refresh,
  Save,
  TrendingUp,
  Visibility,
  VisibilityOff,
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
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useBranches } from '../hooks/useBranches';
import apiService, { Branch, BranchPaymentMethod, PaymentMethodCredential } from '../services/api';

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
      id={`branch-details-tabpanel-${index}`}
      aria-labelledby={`branch-details-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface BranchStats {
  employeeCount: number;
  todaySales: number;
  monthSales: number;
  productCount: number;
  lowStockCount: number;
  recentTransactions: number;
}

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent (GMT+5)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (GMT+6)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (GMT+3)' },
];

const currencies = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'UZS', label: 'Uzbek Som (UZS)' },
  { value: 'KZT', label: 'Kazakhstani Tenge (KZT)' },
  { value: 'RUB', label: 'Russian Ruble (RUB)' },
  { value: 'EUR', label: 'Euro (EUR)' },
];

const BranchDetailsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { updateBranch } = useBranches();

  const [currentTab, setCurrentTab] = useState(0);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Branch & {
    server_ip?: string;
    server_port?: number;
    vpn_ip?: string;
    network_status?: string;
  }>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<BranchPaymentMethod[]>([]);
  const [paymentMethodsChanges, setPaymentMethodsChanges] = useState<Record<string, { isEnabled: boolean; }>>({});
  const [hasPaymentMethodsChanges, setHasPaymentMethodsChanges] = useState(false);
  const [isPaymentMethodsSaving, setIsPaymentMethodsSaving] = useState(false);
  const [paymentCredentials, setPaymentCredentials] = useState<Record<string, PaymentMethodCredential[]>>({});
  const [isPaymentMethodsLoading, setIsPaymentMethodsLoading] = useState(false);
  const [expandedCredentials, setExpandedCredentials] = useState<Record<string, boolean>>({});

  // Fetch branch data
  const fetchBranch = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.getBranch(id);
      if (response.success && response.data) {
        setBranch(response.data);
        setFormData({
          name: response.data.name || '',
          code: response.data.code || '',
          address: response.data.address || '',
          phone: response.data.phone || '',
          email: response.data.email || '',
          managerName: response.data.managerName || '',
          timezone: response.data.timezone || 'Asia/Tashkent',
          currency: response.data.currency || 'UZS',
          taxRate: response.data.taxRate || 12,
          isActive: response.data.isActive ?? true,
          apiKey: response.data.apiKey || '',
          // Network fields are optional and may not be available
          server_ip: '',
          server_port: 3000,
          vpn_ip: '',
          network_status: 'unknown',
        });
      } else {
        setError(response.error || t('branches.failedToLoadBranch'));
      }
    } catch (err) {
      setError(t('branches.failedToLoadBranch'));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch branch statistics
  const fetchBranchStats = async () => {
    if (!id) return;

    setIsStatsLoading(true);
    setStatsError(null);

    try {
      const response = await apiService.getBranchStats(id);
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setStatsError(response.error || t('branches.stats.failedToFetchStats'));
      }
    } catch (err) {
      setStatsError(t('branches.stats.failedToFetchData'));
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchBranch();
      fetchBranchStats();
    }
  }, [id]);

  const generateApiKey = () => {
    return 'br_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = t('branches.branchNameRequired');
    }

    if (!formData.code?.trim()) {
      newErrors.code = t('branches.branchCodeRequired');
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('branches.invalidEmail');
    }

    if (formData.taxRate !== undefined && (formData.taxRate < 0 || formData.taxRate > 100)) {
      newErrors.taxRate = t('branches.invalidTaxRate');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof Branch | 'server_ip' | 'server_port' | 'vpn_ip' | 'network_status', value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleSave = async () => {
    if (!validateForm() || !id) return;

    setIsSaving(true);

    try {
      // Ensure proper type conversion for backend
      const dataToSend = {
        ...formData,
        taxRate: typeof formData.taxRate === 'string' ? parseFloat(formData.taxRate) || 0 : formData.taxRate,
        // Remove network fields as they're not part of the main branches table
        server_ip: undefined,
        server_port: undefined,
        vpn_ip: undefined,
        network_status: undefined,
      };

      await updateBranch(id, dataToSend);
      setIsEditing(false);
      await fetchBranch(); // Refresh branch data
      setSnackbar({
        open: true,
        message: t('branches.branchUpdated'),
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('branches.failedToUpdate'),
        severity: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (formData.apiKey) {
      try {
        await navigator.clipboard.writeText(formData.apiKey);
        setSnackbar({
          open: true,
          message: t('branches.apiKeyCopied'),
          severity: 'success',
        });
      } catch (err) {
        setSnackbar({
          open: true,
          message: t('branches.failedToCopyApiKey'),
          severity: 'error',
        });
      }
    }
  };

  const handleGenerateNewApiKey = () => {
    const newApiKey = generateApiKey();
    handleInputChange('apiKey', newApiKey);
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: branch?.currency || 'USD',
    }).format(amount);
  };

  // Payment Methods Functions
  const fetchPaymentMethods = async (branchId: string) => {
    setIsPaymentMethodsLoading(true);
    try {
      const response = await apiService.getBranchPaymentMethods(branchId);
      if (response.success && response.data) {
        setPaymentMethods(response.data);
        
        // Fetch credentials for each payment method
        const credentialsData: Record<string, PaymentMethodCredential[]> = {};
        for (const method of response.data) {
          if (method.paymentMethod.methodCode !== 'cash') {
            const credResponse = await apiService.getBranchPaymentCredentials(branchId, method.paymentMethodId);
            if (credResponse.success && credResponse.data) {
              credentialsData[method.paymentMethodId] = credResponse.data;
            }
          }
        }
        setPaymentCredentials(credentialsData);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load payment methods',
        severity: 'error',
      });
    } finally {
      setIsPaymentMethodsLoading(false);
    }
  };

  const handlePaymentMethodToggle = (paymentMethodId: string, enabled: boolean) => {
    // Store the change in local state instead of immediately saving
    setPaymentMethodsChanges(prev => ({
      ...prev,
      [paymentMethodId]: { isEnabled: enabled }
    }));
    
    // Update the display immediately for UI feedback
    setPaymentMethods(prev => 
      prev.map(method => 
        method.id === paymentMethodId 
          ? { ...method, isEnabled: enabled }
          : method
      )
    );
    
    setHasPaymentMethodsChanges(true);
  };

  const handleSavePaymentMethods = async () => {
    if (!branch?.id || !hasPaymentMethodsChanges) return;
    
    setIsPaymentMethodsSaving(true);
    try {
      // Apply all changes to the backend
      const updatePromises = Object.entries(paymentMethodsChanges).map(async ([paymentMethodId, changes]) => {
        if (changes.isEnabled !== undefined) {
          const response = await apiService.updateBranchPaymentMethod(branch.id, paymentMethodId, {
            is_enabled: changes.isEnabled,
          });
          if (!response.success) {
            throw new Error(response.error);
          }
        }
      });

      await Promise.all(updatePromises);

      // Send config-sync request to branch server
      try {
        const syncResponse = await apiService.syncPaymentMethodsConfig(branch.id);
        console.log('Payment methods config sync response:', syncResponse);
      } catch (syncError) {
        console.warn('Payment methods config sync failed, but database update succeeded:', syncError);
        setSnackbar({
          open: true,
          message: 'Payment methods updated, but branch sync failed. Changes may take time to reflect.',
          severity: 'warning',
        });
        setPaymentMethodsChanges({});
        setHasPaymentMethodsChanges(false);
        setIsPaymentMethodsSaving(false);
        return;
      }

      setSnackbar({
        open: true,
        message: 'Payment methods configuration saved and synced to branch successfully',
        severity: 'success',
      });
      
      // Clear changes tracking
      setPaymentMethodsChanges({});
      setHasPaymentMethodsChanges(false);
    } catch (error) {
      console.error('Error saving payment methods:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save payment methods configuration',
        severity: 'error',
      });
    } finally {
      setIsPaymentMethodsSaving(false);
    }
  };

  const handlePaymentMethodUpdate = async (paymentMethodId: string, field: string, value: any) => {
    if (!branch?.id) return;
    
    // Update local state immediately for better UX
    setPaymentMethods(prev => 
      prev.map(method => 
        method.id === paymentMethodId 
          ? { ...method, [field]: value }
          : method
      )
    );

    // Debounce API calls for real-time updates
    clearTimeout((window as any).paymentMethodUpdateTimeout);
    (window as any).paymentMethodUpdateTimeout = setTimeout(async () => {
      try {
        const updateData: any = { is_enabled: true }; // Keep enabled state
        updateData[field === 'dailyLimit' ? 'daily_limit' : 
                   field === 'transactionLimit' ? 'transaction_limit' : 
                   field] = value;

        const response = await apiService.updateBranchPaymentMethod(branch.id!, paymentMethodId, updateData);
        
        if (!response.success) {
          throw new Error(response.error);
        }
      } catch (error) {
        console.error('Error updating payment method:', error);
        setSnackbar({
          open: true,
          message: 'Failed to update payment method',
          severity: 'error',
        });
        // Refresh data on error
        fetchPaymentMethods(branch.id!);
      }
    }, 1000);
  };

  const toggleCredentialsExpansion = (paymentMethodId: string) => {
    setExpandedCredentials(prev => ({
      ...prev,
      [paymentMethodId]: !prev[paymentMethodId]
    }));
  };

  const renderCredentialsForm = (paymentMethod: any) => {
    const credentials = paymentCredentials[paymentMethod.id] || [];
    
    const getCredentialFields = (methodCode: string) => {
      switch (methodCode) {
        case 'uzum_fastpay':
          return [
            { key: 'merchant_service_user_id', label: 'Merchant Service User ID', type: 'text' },
            { key: 'secret_key', label: 'Secret Key', type: 'password' },
            { key: 'service_id', label: 'Service ID', type: 'text' },
            { key: 'cashbox_code_prefix', label: 'Cashbox Code Prefix', type: 'text' },
          ];
        case 'click':
          return [
            { key: 'merchant_id', label: 'Merchant ID', type: 'text' },
            { key: 'service_id', label: 'Service ID', type: 'text' },
            { key: 'merchant_user_id', label: 'Merchant User ID', type: 'text' },
            { key: 'secret_key', label: 'Secret Key', type: 'password' },
            { key: 'cashbox_code', label: 'Cashbox Code', type: 'text' },
          ];
        case 'payme':
          return [
            { key: 'cashbox_id', label: 'Cashbox ID', type: 'text' },
            { key: 'key_password', label: 'Key Password', type: 'password' },
          ];
        default:
          return [];
      }
    };

    const fields = getCredentialFields(paymentMethod.methodCode);
    
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Configure the credentials for {paymentMethod.methodName}. These values are securely encrypted.
        </Typography>
        
        {fields.map((field) => {
          const credential = credentials.find(c => c.credentialKey === field.key);
          return (
            <TextField
              key={field.key}
              label={field.label}
              type={field.type}
              value={credential?.credentialValue || ''}
              onChange={(e) => handleCredentialUpdate(paymentMethod.id, field.key, e.target.value)}
              disabled={!isEditing}
              fullWidth
              size="small"
              placeholder={`Enter ${field.label.toLowerCase()}`}
              InputProps={{
                endAdornment: field.type === 'password' ? (
                  <InputAdornment position="end">
                    <IconButton size="small" edge="end">
                      {field.type === 'password' ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
            />
          );
        })}
        
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={credentials.some(c => c.isTestEnvironment)}
                onChange={(e) => handleTestModeToggle(paymentMethod.id, e.target.checked)}
                disabled={!isEditing}
              />
            }
            label="Test Environment"
          />
          <Typography variant="caption" display="block" color="text.secondary">
            Enable this for testing/sandbox environment
          </Typography>
        </Box>
      </Stack>
    );
  };

  const handleCredentialUpdate = async (paymentMethodId: string, credentialKey: string, value: string) => {
    // Update local state immediately
    setPaymentCredentials(prev => ({
      ...prev,
      [paymentMethodId]: (prev[paymentMethodId] || []).map(cred => 
        cred.credentialKey === credentialKey 
          ? { ...cred, credentialValue: value }
          : cred
      ).concat(
        (prev[paymentMethodId] || []).find(c => c.credentialKey === credentialKey) ? [] : 
        [{ 
          id: `temp-${credentialKey}`,
          branchId: branch?.id || '',
          paymentMethodId,
          credentialKey,
          credentialValue: value,
          isEncrypted: credentialKey.includes('secret') || credentialKey.includes('password'),
          isTestEnvironment: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]
      )
    }));
  };

  const handleTestModeToggle = async (paymentMethodId: string, isTest: boolean) => {
    setPaymentCredentials(prev => ({
      ...prev,
      [paymentMethodId]: (prev[paymentMethodId] || []).map(cred => ({
        ...cred,
        isTestEnvironment: isTest
      }))
    }));
  };

  // Load payment methods when branch changes
  useEffect(() => {
    if (branch?.id) {
      fetchPaymentMethods(branch.id);
    }
  }, [branch?.id]);

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (error || !branch) {
    return (
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={() => navigate('/branches')}>
            {t('common.goBack')}
          </Button>
        }>
          {error || t('branches.branchNotFound')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/branches')} sx={{ mr: 1 }}>
            <ArrowBack />
          </IconButton>
          <Business sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {branch.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {branch.code} • {branch.address}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchBranchStats} disabled={isStatsLoading}>
            <Refresh />
          </IconButton>
          {isEditing ? (
            <>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: branch.name || '',
                    code: branch.code || '',
                    address: branch.address || '',
                    phone: branch.phone || '',
                    email: branch.email || '',
                    managerName: branch.managerName || '',
                    timezone: branch.timezone || 'Asia/Tashkent',
                    currency: branch.currency || 'UZS',
                    taxRate: branch.taxRate || 12,
                    isActive: branch.isActive ?? true,
                    apiKey: branch.apiKey || '',
                    // Network fields are optional
                    server_ip: '',
                    server_port: 3000,
                    vpn_ip: '',
                    network_status: 'unknown',
                  });
                  setErrors({});
                }}
                disabled={isSaving}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => setIsEditing(true)}
            >
              {t('common.edit')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Main Content */}
      <Paper sx={{ minHeight: '600px' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={currentTab} 
            onChange={(_, newValue) => setCurrentTab(newValue)} 
            sx={{ px: 3 }}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab label={t('branches.stats.overview')} />
            <Tab label={t('branches.stats.salesPerformance')} />
            <Tab label={t('branches.basicInformation')} />
            <Tab label={t('branches.contactInformation')} />
            <Tab label={t('branches.operationalSettings')} />
            <Tab label="Network Configuration" />
            <Tab label="Payment Methods" />
          </Tabs>
        </Box>

        <Box sx={{ px: 3 }}>
          {/* Overview Tab */}
          <TabPanel value={currentTab} index={0}>
            {statsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {statsError}
              </Alert>
            )}

            {isStatsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mb: 4 }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <People color="primary" />
                        <Typography color="textSecondary" gutterBottom>
                          {t('branches.stats.activeEmployees')}
                        </Typography>
                      </Box>
                      <Typography variant="h4">
                        {stats?.employeeCount || 0}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TrendingUp color="success" />
                        <Typography color="textSecondary" gutterBottom>
                          {t('branches.stats.todaysSales')}
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="success.main">
                        {stats ? formatCurrency(stats.todaySales) : '$0'}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Inventory color="info" />
                        <Typography color="textSecondary" gutterBottom>
                          {t('branches.stats.totalProducts')}
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="info.main">
                        {stats?.productCount || 0}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Warning color="warning" />
                        <Typography color="textSecondary" gutterBottom>
                          {t('branches.stats.lowStockItems')}
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="warning.main">
                        {stats?.lowStockCount || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Receipt color="primary" />
                      <Typography variant="h6">
                        {t('branches.stats.recentActivity')}
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="primary">
                      {stats?.recentTransactions || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('branches.stats.transactionsLast24Hours')}
                    </Typography>
                  </CardContent>
                </Card>
              </>
            )}
          </TabPanel>

          {/* Sales Performance Tab */}
          <TabPanel value={currentTab} index={1}>
            {statsError && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {statsError}
              </Alert>
            )}

            {isStatsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {t('branches.stats.salesSummary')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">{t('branches.stats.todaysSales')}:</Typography>
                        <Typography variant="h6" color="primary">
                          {stats ? formatCurrency(stats.todaySales) : '$0'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">{t('branches.stats.thisMonth')}:</Typography>
                        <Typography variant="h6" color="success.main">
                          {stats ? formatCurrency(stats.monthSales) : '$0'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">{t('branches.stats.dailyAverage')}:</Typography>
                        <Typography variant="h6">
                          {stats ? formatCurrency(stats.monthSales / new Date().getDate()) : '$0'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {t('branches.stats.inventoryStatus')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">{t('branches.stats.totalProducts')}:</Typography>
                        <Typography variant="h6">
                          {stats?.productCount || 0}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" color="warning.main">
                          {t('branches.stats.lowStockItems')}:
                        </Typography>
                        <Typography variant="h6" color="warning.main">
                          {stats?.lowStockCount || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            )}
          </TabPanel>

          {/* Basic Information Tab */}
          <TabPanel value={currentTab} index={2}>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label={t('branches.name')}
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  required
                  disabled={!isEditing}
                />
                <TextField
                  fullWidth
                  label={t('branches.code')}
                  value={formData.code || ''}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                  error={!!errors.code}
                  helperText={errors.code}
                  required
                  placeholder={t('branches.branchCodePlaceholder')}
                  disabled={!isEditing}
                />
              </Stack>
              <TextField
                fullWidth
                label={t('branches.address')}
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                multiline
                rows={2}
                disabled={!isEditing}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive ?? true}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    disabled={!isEditing}
                  />
                }
                label={t('branches.isActive')}
              />
            </Stack>
          </TabPanel>

          {/* Contact Information Tab */}
          <TabPanel value={currentTab} index={3}>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label={t('branches.phone')}
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder={t('branches.phonePlaceholder')}
                  disabled={!isEditing}
                />
                <TextField
                  fullWidth
                  label={t('branches.email')}
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  error={!!errors.email}
                  helperText={errors.email}
                  disabled={!isEditing}
                />
              </Stack>
              <TextField
                fullWidth
                label={t('branches.managerName')}
                value={formData.managerName || ''}
                onChange={(e) => handleInputChange('managerName', e.target.value)}
                disabled={!isEditing}
              />
            </Stack>
          </TabPanel>

          {/* Operational Settings Tab */}
          <TabPanel value={currentTab} index={4}>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>{t('branches.timezone')}</InputLabel>
                  <Select
                    value={formData.timezone || 'Asia/Tashkent'}
                    label={t('branches.timezone')}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    disabled={!isEditing}
                  >
                    {timezones.map((tz) => (
                      <MenuItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>{t('branches.currency')}</InputLabel>
                  <Select
                    value={formData.currency || 'UZS'}
                    label={t('branches.currency')}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    disabled={!isEditing}
                  >
                    {currencies.map((curr) => (
                      <MenuItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <TextField
                fullWidth
                label={t('branches.taxRate')}
                type="number"
                value={formData.taxRate || 0}
                onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value) || 0)}
                error={!!errors.taxRate}
                helperText={errors.taxRate}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                disabled={!isEditing}
              />

              <Divider />

              <Typography variant="h6" gutterBottom>
                {t('branches.token')}
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('branches.tokenInfo')}
              </Alert>
              
              <TextField
                fullWidth
                label={t('branches.apiKey')}
                value={formData.apiKey || ''}
                type={showApiKey ? 'text' : 'password'}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowApiKey(!showApiKey)}
                        edge="end"
                      >
                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                      <IconButton
                        onClick={handleCopyApiKey}
                        edge="end"
                        title={t('branches.copyToken')}
                      >
                        <ContentCopy />
                      </IconButton>
                      {isEditing && (
                        <IconButton
                          onClick={handleGenerateNewApiKey}
                          edge="end"
                          title={t('branches.regenerateToken')}
                        >
                          <Refresh />
                        </IconButton>
                      )}
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          </TabPanel>

          {/* Network Configuration Tab */}
          <TabPanel value={currentTab} index={5}>
            <Stack spacing={3}>
              <Typography variant="h6" gutterBottom>
                Branch Server Configuration
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Configure the network settings for this branch's server to enable communication with the chain core.
              </Alert>
              
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Server IP Address"
                  value={formData.server_ip || ''}
                  onChange={(e) => handleInputChange('server_ip', e.target.value)}
                  placeholder="192.168.1.100"
                  helperText="LAN IP address of the branch server"
                  disabled={!isEditing}
                />
                <TextField
                  label="Server Port"
                  type="number"
                  value={formData.server_port || 3000}
                  onChange={(e) => handleInputChange('server_port', parseInt(e.target.value) || 3000)}
                  inputProps={{ min: 1000, max: 65535 }}
                  sx={{ minWidth: 150 }}
                  disabled={!isEditing}
                />
              </Stack>

              <TextField
                fullWidth
                label="VPN IP Address (Optional)"
                value={formData.vpn_ip || ''}
                onChange={(e) => handleInputChange('vpn_ip', e.target.value)}
                placeholder="10.0.1.100"
                helperText="VPN IP address for secure communication between branches"
                disabled={!isEditing}
              />

              <Divider />

              <Typography variant="h6" gutterBottom>
                Connection Status
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Network Status:
                </Typography>
                <Box
                  sx={{
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: formData.network_status === 'online' ? 'success.light' : 
                            formData.network_status === 'offline' ? 'error.light' : 'grey.200',
                    color: formData.network_status === 'online' ? 'success.dark' : 
                           formData.network_status === 'offline' ? 'error.dark' : 'text.secondary',
                    fontWeight: 'medium',
                    textTransform: 'capitalize',
                  }}
                >
                  {formData.network_status || 'Unknown'}
                </Box>
              </Box>

              <Alert severity="warning">
                <Typography variant="body2">
                  <strong>Note:</strong> Network configuration changes will require the branch server to be restarted to take effect.
                </Typography>
              </Alert>
            </Stack>
          </TabPanel>

          {/* Payment Methods Tab */}
          <TabPanel value={currentTab} index={6}>
            <Stack spacing={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" gutterBottom>
                  Payment Methods Configuration
                </Typography>
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSavePaymentMethods}
                    disabled={!hasPaymentMethodsChanges || isPaymentMethodsSaving}
                    color="primary"
                  >
                    {isPaymentMethodsSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => {
                      if (branch?.id) {
                        fetchPaymentMethods(branch.id);
                        setPaymentMethodsChanges({});
                        setHasPaymentMethodsChanges(false);
                      }
                    }}
                    disabled={isPaymentMethodsLoading || isPaymentMethodsSaving}
                  >
                    Refresh
                  </Button>
                </Box>
              </Box>

              {hasPaymentMethodsChanges && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  You have unsaved changes. Click "Save Changes" to apply them to the branch.
                </Alert>
              )}

              <Alert severity="info" sx={{ mb: 2 }}>
                Configure which payment methods are available for this branch and manage their credentials.
                Available methods: Cash (no configuration), Uzum Bank FastPay, Click Pay, Payme QR.
              </Alert>

              {isPaymentMethodsLoading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : (
                <Stack spacing={2}>
                  {paymentMethods.map((method) => (
                    <Card key={method.id} variant="outlined">
                      <CardContent>
                        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 1,
                                bgcolor: method.isEnabled ? 'success.light' : 'grey.300',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {method.paymentMethod.requiresQr ? (
                                <QrCode sx={{ color: method.isEnabled ? 'white' : 'grey.600' }} />
                              ) : (
                                <CreditCard sx={{ color: method.isEnabled ? 'white' : 'grey.600' }} />
                              )}
                            </Box>
                            <Box>
                              <Typography variant="h6" component="div">
                                {method.paymentMethod.methodName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {method.paymentMethod.description}
                              </Typography>
                            </Box>
                          </Box>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={method.isEnabled}
                                onChange={(e) => handlePaymentMethodToggle(method.id, e.target.checked)}
                                disabled={!isEditing}
                              />
                            }
                            label={method.isEnabled ? "Enabled" : "Disabled"}
                          />
                        </Box>

                        {method.isEnabled && (
                          <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                              <TextField
                                label="Priority"
                                type="number"
                                value={method.priority}
                                onChange={(e) => handlePaymentMethodUpdate(method.id, 'priority', parseInt(e.target.value))}
                                inputProps={{ min: 0, max: 10 }}
                                sx={{ maxWidth: 120 }}
                                disabled={!isEditing}
                                helperText="Display order (0=highest)"
                              />
                              <TextField
                                label="Daily Limit"
                                type="number"
                                value={method.dailyLimit || ''}
                                onChange={(e) => handlePaymentMethodUpdate(method.id, 'dailyLimit', parseFloat(e.target.value) || undefined)}
                                InputProps={{
                                  endAdornment: <InputAdornment position="end">UZS</InputAdornment>,
                                }}
                                disabled={!isEditing}
                                helperText="Maximum daily transaction amount"
                              />
                              <TextField
                                label="Transaction Limit"
                                type="number"
                                value={method.transactionLimit || ''}
                                onChange={(e) => handlePaymentMethodUpdate(method.id, 'transactionLimit', parseFloat(e.target.value) || undefined)}
                                InputProps={{
                                  endAdornment: <InputAdornment position="end">UZS</InputAdornment>,
                                }}
                                disabled={!isEditing}
                                helperText="Maximum per-transaction amount"
                              />
                            </Stack>

                            <TextField
                              label="Notes"
                              multiline
                              rows={2}
                              value={method.notes || ''}
                              onChange={(e) => handlePaymentMethodUpdate(method.id, 'notes', e.target.value)}
                              disabled={!isEditing}
                              placeholder="Optional notes about this payment method configuration"
                            />

                            {/* Credentials Configuration */}
                            {method.paymentMethod.methodCode !== 'cash' && (
                              <Box>
                                <Box display="flex" justifyContent="between" alignItems="center" mb={1}>
                                  <Typography variant="subtitle2" color="primary">
                                    Credentials Configuration
                                  </Typography>
                                  <Button
                                    size="small"
                                    onClick={() => toggleCredentialsExpansion(method.paymentMethod.id)}
                                    endIcon={expandedCredentials[method.paymentMethod.id] ? <VisibilityOff /> : <Visibility />}
                                  >
                                    {expandedCredentials[method.paymentMethod.id] ? 'Hide' : 'Show'} Credentials
                                  </Button>
                                </Box>
                                
                                {expandedCredentials[method.paymentMethod.id] && (
                                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                                    {renderCredentialsForm(method.paymentMethod)}
                                  </Box>
                                )}
                              </Box>
                            )}
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {paymentMethods.length === 0 && !isPaymentMethodsLoading && (
                    <Alert severity="warning">
                      No payment methods configured for this branch. Please contact the system administrator.
                    </Alert>
                  )}
                </Stack>
              )}
            </Stack>
          </TabPanel>
        </Box>
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default BranchDetailsPage;
