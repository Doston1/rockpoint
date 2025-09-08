import {
  ArrowBack,
  Business,
  Cancel,
  ContentCopy,
  Edit,
  Info,
  Refresh,
  Save,
  Settings,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  SelectChangeEvent,
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
import type { Branch, BranchPaymentMethod, PaymentMethodCredential } from '../services/api';
import apiService from '../services/api';

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

type ConfigurationMode = 'overview' | 'basic' | 'payment';

const BranchDetailsPageNew: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { updateBranch } = useBranches();

  // Main state
  const [branch, setBranch] = useState<Branch | null>(null);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Configuration mode and tabs
  const [configMode, setConfigMode] = useState<ConfigurationMode>('overview');
  const [currentTab, setCurrentTab] = useState(0);

  // Basic configuration state
  const [basicFormData, setBasicFormData] = useState<Partial<Branch>>({});
  const [isBasicEditing, setIsBasicEditing] = useState(false);
  const [isBasicSaving, setIsBasicSaving] = useState(false);
  const [basicErrors, setBasicErrors] = useState<Record<string, string>>({});

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<BranchPaymentMethod[]>([]);
  const [paymentMethodsChanges, setPaymentMethodsChanges] = useState<Record<string, { isEnabled: boolean; }>>({});
  const [hasPaymentMethodsChanges, setHasPaymentMethodsChanges] = useState(false);
  const [isPaymentMethodsEditing, setIsPaymentMethodsEditing] = useState(false);
  const [isPaymentMethodsSaving, setIsPaymentMethodsSaving] = useState(false);
  const [isPaymentMethodsLoading, setIsPaymentMethodsLoading] = useState(false);
  const [paymentCredentials, setPaymentCredentials] = useState<Record<string, PaymentMethodCredential[]>>({});
  const [expandedCredentials, setExpandedCredentials] = useState<Record<string, boolean>>({});
  const [credentialVisibility, setCredentialVisibility] = useState<Record<string, boolean>>({});

  // Common state
  const [showApiKey, setShowApiKey] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Fetch branch data
  const fetchBranch = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.getBranch(id);
      if (response.success && response.data) {
        setBranch(response.data);
        setBasicFormData({
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

  // Fetch payment methods
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

  useEffect(() => {
    if (id) {
      fetchBranch();
      fetchBranchStats();
    }
  }, [id]);

  useEffect(() => {
    if (branch?.id && configMode === 'payment') {
      fetchPaymentMethods(branch.id);
    }
  }, [branch?.id, configMode]);

  // Configuration mode handlers
  const handleConfigModeChange = (event: SelectChangeEvent<ConfigurationMode>) => {
    const newMode = event.target.value as ConfigurationMode;

    // Cancel any active editing and reset changes when switching modes
    if (isBasicEditing) {
      handleBasicCancel();
    }

    if (isPaymentMethodsEditing) {
      handlePaymentMethodsCancel();
    }

    setConfigMode(newMode);
    setCurrentTab(0); // Reset to first tab when changing mode
  };

  // Basic configuration handlers
  const generateApiKey = () => {
    return 'br_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const validateBasicForm = () => {
    const newErrors: Record<string, string> = {};

    if (!basicFormData.name?.trim()) {
      newErrors.name = t('branches.branchNameRequired');
    }

    if (!basicFormData.code?.trim()) {
      newErrors.code = t('branches.branchCodeRequired');
    }

    if (basicFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basicFormData.email)) {
      newErrors.email = t('branches.invalidEmail');
    }

    if (basicFormData.taxRate !== undefined && (basicFormData.taxRate < 0 || basicFormData.taxRate > 100)) {
      newErrors.taxRate = t('branches.invalidTaxRate');
    }

    setBasicErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBasicInputChange = (field: keyof Branch, value: any) => {
    setBasicFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (basicErrors[field]) {
      setBasicErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleBasicSave = async () => {
    if (!validateBasicForm() || !id) return;

    setIsBasicSaving(true);

    try {
      // Ensure proper type conversion for backend
      const dataToSend = {
        ...basicFormData,
        taxRate: typeof basicFormData.taxRate === 'string' ? parseFloat(basicFormData.taxRate) || 0 : basicFormData.taxRate,
      };

      await updateBranch(id, dataToSend);
      setIsBasicEditing(false);
      await fetchBranch(); // Refresh branch data

      // Send sync request to branch
      try {
        // const syncResponse = await apiService.syncBranchConfig(id);
        // console.log('Branch config sync response:', syncResponse);
        setSnackbar({
          open: true,
          message: 'Branch updated successfully', // t('branches.branchUpdatedAndSynced'),
          severity: 'success',
        });
      } catch (syncError) {
        console.warn('Branch config sync failed, but database update succeeded:', syncError);
        setSnackbar({
          open: true,
          message: 'Branch updated, but sync failed', // t('branches.branchUpdatedSyncFailed'),
          severity: 'warning',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('branches.failedToUpdate'),
        severity: 'error',
      });
    } finally {
      setIsBasicSaving(false);
    }
  };

  const handleBasicCancel = () => {
    setIsBasicEditing(false);
    // Reset form data to current branch data
    if (branch) {
      setBasicFormData({
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
      });
    }
    setBasicErrors({});
  };

  // Payment methods handlers
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

  const handlePaymentMethodsSave = async () => {
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
        setSnackbar({
          open: true,
          message: 'Payment methods configuration saved and synced to branch successfully',
          severity: 'success',
        });
      } catch (syncError) {
        console.warn('Payment methods config sync failed, but database update succeeded:', syncError);
        setSnackbar({
          open: true,
          message: 'Payment methods updated, but branch sync failed. Changes may take time to reflect.',
          severity: 'warning',
        });
      }

      setIsPaymentMethodsEditing(false);
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

  const handlePaymentMethodsCancel = () => {
    setIsPaymentMethodsEditing(false);
    setPaymentMethodsChanges({});
    setHasPaymentMethodsChanges(false);
    // Refresh payment methods to original state
    if (branch?.id) {
      fetchPaymentMethods(branch.id);
    }
  };

  // Credential management functions
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
          const fieldVisibilityKey = `${paymentMethod.id}-${field.key}`;
          const isVisible = credentialVisibility[fieldVisibilityKey] || false;
          const fieldType = field.type === 'password' && !isVisible ? 'password' : 'text';

          return (
            <TextField
              key={field.key}
              label={field.label}
              type={fieldType}
              value={credential?.credentialValue || ''}
              onChange={(e) => handleCredentialUpdate(paymentMethod.id, field.key, e.target.value)}
              disabled={!isPaymentMethodsEditing}
              fullWidth
              size="small"
              placeholder={`Enter ${field.label.toLowerCase()}`}
              InputProps={{
                endAdornment: field.type === 'password' ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={() => toggleCredentialVisibility(fieldVisibilityKey)}
                    >
                      {isVisible ? <VisibilityOff /> : <Visibility />}
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
                disabled={!isPaymentMethodsEditing}
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

  const toggleCredentialVisibility = (fieldKey: string) => {
    setCredentialVisibility(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  // Common handlers
  const handleCopyApiKey = async () => {
    if (basicFormData.apiKey) {
      try {
        await navigator.clipboard.writeText(basicFormData.apiKey);
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
    handleBasicInputChange('apiKey', newApiKey);
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

  // Render helper functions
  const renderActionButtons = () => {
    if (configMode === 'overview') {
      return (
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchBranchStats}
          disabled={isStatsLoading}
        >
          Refresh
        </Button>
      );
    }

    if (configMode === 'basic') {
      return (
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchBranch}
            disabled={isLoading}
          >
            Refresh
          </Button>
          {isBasicEditing ? (
            <>
              <Button
                variant="outlined"
                startIcon={<Cancel />}
                onClick={handleBasicCancel}
                disabled={isBasicSaving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleBasicSave}
                disabled={isBasicSaving}
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => setIsBasicEditing(true)}
            >
              Edit
            </Button>
          )}
        </Stack>
      );
    }

    if (configMode === 'payment') {
      return (
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => branch?.id && fetchPaymentMethods(branch.id)}
            disabled={isPaymentMethodsLoading}
          >
            Refresh
          </Button>
          {isPaymentMethodsEditing ? (
            <>
              <Button
                variant="outlined"
                startIcon={<Cancel />}
                onClick={handlePaymentMethodsCancel}
                disabled={isPaymentMethodsSaving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handlePaymentMethodsSave}
                disabled={isPaymentMethodsSaving || !hasPaymentMethodsChanges}
              >
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => setIsPaymentMethodsEditing(true)}
            >
              Edit
            </Button>
          )}
        </Stack>
      );
    }

    return null;
  };

  const renderTabs = () => {
    if (configMode === 'overview') {
      return (
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          sx={{ px: 3 }}
        >
          <Tab label="Overview" />
          <Tab label="Sales Performance" />
        </Tabs>
      );
    }

    if (configMode === 'basic') {
      return (
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          sx={{ px: 3 }}
        >
          <Tab label="Basic Information" />
          <Tab label="Contact Information" />
          <Tab label="Operational Settings" />
        </Tabs>
      );
    }

    if (configMode === 'payment') {
      return (
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          sx={{ px: 3 }}
        >
          <Tab label="Payment Methods" />
        </Tabs>
      );
    }

    return null;
  };

  const renderTabContent = () => {
    if (configMode === 'overview') {
      return (
        <>
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
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3 }}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Employees
                    </Typography>
                    <Typography variant="h4">
                      {stats?.employeeCount || 0}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Today's Sales
                    </Typography>
                    <Typography variant="h4">
                      {formatCurrency(stats?.todaySales || 0)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Products
                    </Typography>
                    <Typography variant="h4">
                      {stats?.productCount || 0}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Low Stock Items
                    </Typography>
                    <Typography variant="h4" color="warning.main">
                      {stats?.lowStockCount || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
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
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Monthly Sales
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {formatCurrency(stats?.monthSales || 0)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Recent Transactions
                    </Typography>
                    <Typography variant="h4">
                      {stats?.recentTransactions || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            )}
          </TabPanel>
        </>
      );
    }

    if (configMode === 'basic') {
      return (
        <>
          {/* Basic Information Tab */}
          <TabPanel value={currentTab} index={0}>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label={t('branches.name')}
                  value={basicFormData.name || ''}
                  onChange={(e) => handleBasicInputChange('name', e.target.value)}
                  error={!!basicErrors.name}
                  helperText={basicErrors.name}
                  required
                  disabled={!isBasicEditing}
                />
                <TextField
                  fullWidth
                  label={t('branches.code')}
                  value={basicFormData.code || ''}
                  onChange={(e) => handleBasicInputChange('code', e.target.value.toUpperCase())}
                  error={!!basicErrors.code}
                  helperText={basicErrors.code}
                  required
                  placeholder={t('branches.branchCodePlaceholder')}
                  disabled={!isBasicEditing}
                />
              </Stack>
              <TextField
                fullWidth
                label={t('branches.address')}
                value={basicFormData.address || ''}
                onChange={(e) => handleBasicInputChange('address', e.target.value)}
                multiline
                rows={2}
                disabled={!isBasicEditing}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={basicFormData.isActive ?? true}
                    onChange={(e) => handleBasicInputChange('isActive', e.target.checked)}
                    disabled={!isBasicEditing}
                  />
                }
                label={t('branches.isActive')}
              />
            </Stack>
          </TabPanel>

          {/* Contact Information Tab */}
          <TabPanel value={currentTab} index={1}>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label={t('branches.phone')}
                  value={basicFormData.phone || ''}
                  onChange={(e) => handleBasicInputChange('phone', e.target.value)}
                  placeholder={t('branches.phonePlaceholder')}
                  disabled={!isBasicEditing}
                />
                <TextField
                  fullWidth
                  label={t('branches.email')}
                  type="email"
                  value={basicFormData.email || ''}
                  onChange={(e) => handleBasicInputChange('email', e.target.value)}
                  error={!!basicErrors.email}
                  helperText={basicErrors.email}
                  disabled={!isBasicEditing}
                />
              </Stack>
              <TextField
                fullWidth
                label={t('branches.managerName')}
                value={basicFormData.managerName || ''}
                onChange={(e) => handleBasicInputChange('managerName', e.target.value)}
                disabled={!isBasicEditing}
              />
            </Stack>
          </TabPanel>

          {/* Operational Settings Tab */}
          <TabPanel value={currentTab} index={2}>
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControl fullWidth disabled={!isBasicEditing}>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={basicFormData.timezone || 'Asia/Tashkent'}
                    onChange={(e) => handleBasicInputChange('timezone', e.target.value)}
                    label="Timezone"
                  >
                    {timezones.map((tz) => (
                      <MenuItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth disabled={!isBasicEditing}>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={basicFormData.currency || 'UZS'}
                    onChange={(e) => handleBasicInputChange('currency', e.target.value)}
                    label="Currency"
                  >
                    {currencies.map((currency) => (
                      <MenuItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <TextField
                fullWidth
                label={t('branches.taxRate')}
                type="number"
                value={basicFormData.taxRate || 0}
                onChange={(e) => handleBasicInputChange('taxRate', parseFloat(e.target.value) || 0)}
                error={!!basicErrors.taxRate}
                helperText={basicErrors.taxRate}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                disabled={!isBasicEditing}
              />

              <Divider />

              <Typography variant="h6" gutterBottom>
                API Configuration
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                This API key is used for secure communication between the chain management system and this branch.
              </Alert>

              <TextField
                fullWidth
                label={t('branches.apiKey')}
                value={basicFormData.apiKey || ''}
                type={showApiKey ? 'text' : 'password'}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          onClick={() => setShowApiKey(!showApiKey)}
                          edge="end"
                        >
                          {showApiKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                        <IconButton onClick={handleCopyApiKey} edge="end">
                          <ContentCopy />
                        </IconButton>
                        {isBasicEditing && (
                          <Button
                            size="small"
                            onClick={handleGenerateNewApiKey}
                            variant="outlined"
                          >
                            Generate New
                          </Button>
                        )}
                      </Stack>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>
          </TabPanel>
        </>
      );
    }

    if (configMode === 'payment') {
      return (
        <TabPanel value={currentTab} index={0}>
          <Stack spacing={3}>
            <Alert severity="info">
              Configure which payment methods are available for this branch. Changes will be synced to the branch server.
            </Alert>

            {isPaymentMethodsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
                {paymentMethods.map((method) => (
                  <Card key={method.id} variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="h6">
                            {method.paymentMethod.methodName}
                          </Typography>
                          <Chip
                            size="small"
                            label={method.paymentMethod.methodCode.toUpperCase()}
                            variant="outlined"
                          />
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={method.isEnabled}
                              onChange={(e) => handlePaymentMethodToggle(method.id, e.target.checked)}
                              disabled={!isPaymentMethodsEditing}
                            />
                          }
                          label="Enabled"
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" paragraph>
                        {method.paymentMethod.description}
                      </Typography>

                      {method.paymentMethod.methodCode !== 'cash' && (
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                              Payment Credentials
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
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </TabPanel>
      );
    }

    return null;
  };

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
        {renderActionButtons()}
      </Box>

      {/* Configuration Mode Selector */}
      <Box sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 250 }}>
          <InputLabel>Configuration Mode</InputLabel>
          <Select
            value={configMode}
            onChange={handleConfigModeChange}
            label="Configuration Mode"
          >
            <MenuItem value="overview">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Info fontSize="small" />
                Overview
              </Box>
            </MenuItem>
            <MenuItem value="basic">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Business fontSize="small" />
                Basic Configuration
              </Box>
            </MenuItem>
            <MenuItem value="payment">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings fontSize="small" />
                Payment Methods Configuration
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Main Content */}
      <Paper sx={{ minHeight: '600px' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {renderTabs()}
        </Box>

        <Box sx={{ px: 3 }}>
          {renderTabContent()}
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

export default BranchDetailsPageNew;
