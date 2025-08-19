import {
    Search,
} from '@mui/icons-material';
import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CustomerFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  vipFilter: string;
  setVipFilter: (value: string) => void;
  customerCount: number;
}

export const CustomerFilters: React.FC<CustomerFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  vipFilter,
  setVipFilter,
  customerCount,
}) => {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            md: 'repeat(4, 1fr)' 
          },
          gap: 2,
          alignItems: 'center'
        }}
      >
        <TextField
          fullWidth
          label={t('customers.searchCustomers')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
          }}
        />
        
        <FormControl fullWidth size="small">
          <InputLabel>{t('customers.status')}</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label={t('customers.status')}
          >
            <MenuItem value="all">{t('customers.allStatuses')}</MenuItem>
            <MenuItem value="active">{t('customers.active')}</MenuItem>
            <MenuItem value="inactive">{t('customers.inactive')}</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>{t('customers.customerType')}</InputLabel>
          <Select
            value={vipFilter}
            onChange={(e) => setVipFilter(e.target.value)}
            label={t('customers.customerType')}
          >
            <MenuItem value="all">{t('customers.allTypes')}</MenuItem>
            <MenuItem value="vip">{t('customers.vipOnly')}</MenuItem>
            <MenuItem value="regular">{t('customers.regularOnly')}</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="body2" color="text.secondary">
          {t('customers.showingCustomers', { count: customerCount })}
        </Typography>
      </Box>
    </Paper>
  );
};
