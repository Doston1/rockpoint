import {
  ContentCopy,
  Refresh,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Branch } from '../../services/api';

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
      id={`branch-tabpanel-${index}`}
      aria-labelledby={`branch-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

interface BranchDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (branchData: Partial<Branch>) => Promise<void>;
  branch?: Branch | null;
  isLoading?: boolean;
}

const timezones = [
  { value: 'UTC', label: 'UTC' },
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

const BranchDialog: React.FC<BranchDialogProps> = ({
  open,
  onClose,
  onSave,
  branch,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  const [formData, setFormData] = useState<Partial<Branch>>({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    managerName: '',
    timezone: 'Asia/Tashkent',
    currency: 'UZS',
    taxRate: 12,
    isActive: true,
    apiKey: '',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (branch) {
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
      });
    } else {
      // Reset form for new branch
      setFormData({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        managerName: '',
        timezone: 'Asia/Tashkent',
        currency: 'UZS',
        taxRate: 12,
        isActive: true,
        apiKey: generateApiKey(),
      });
    }
    setErrors({});
    setCurrentTab(0);
  }, [branch, open]);

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

  const handleInputChange = (field: keyof Branch, value: any) => {
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
    if (!validateForm()) return;

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving branch:', error);
    }
  };

  const handleCopyApiKey = async () => {
    if (formData.apiKey) {
      try {
        await navigator.clipboard.writeText(formData.apiKey);
        // You could add a toast notification here
      } catch (err) {
        console.error('Failed to copy API key:', err);
      }
    }
  };

  const handleGenerateNewApiKey = () => {
    const newApiKey = generateApiKey();
    handleInputChange('apiKey', newApiKey);
  };

  const isEditing = !!branch;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        {isEditing ? t('branches.editBranch') : t('branches.addBranch')}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label={t('branches.basicInformation')} />
            <Tab label={t('branches.contactInformation')} />
            <Tab label={t('branches.operationalSettings')} />
          </Tabs>
        </Box>

        {/* Basic Information Tab */}
        <TabPanel value={currentTab} index={0}>
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
              />
            </Stack>
            <TextField
              fullWidth
              label={t('branches.address')}
              value={formData.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive ?? true}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
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
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder={t('branches.phonePlaceholder')}
              />
              <TextField
                fullWidth
                label={t('branches.email')}
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
              />
            </Stack>
            <TextField
              fullWidth
              label={t('branches.managerName')}
              value={formData.managerName || ''}
              onChange={(e) => handleInputChange('managerName', e.target.value)}
            />
          </Stack>
        </TabPanel>

        {/* Operational Settings Tab */}
        <TabPanel value={currentTab} index={2}>
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>{t('branches.timezone')}</InputLabel>
                <Select
                  value={formData.timezone || 'Asia/Tashkent'}
                  label={t('branches.timezone')}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
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
                    <IconButton
                      onClick={handleGenerateNewApiKey}
                      edge="end"
                      title={t('branches.regenerateToken')}
                    >
                      <Refresh />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? t('common.loading') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BranchDialog;
