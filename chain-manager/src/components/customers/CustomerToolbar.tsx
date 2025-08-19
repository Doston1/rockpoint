import {
    Add as AddIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
    Box,
    Button,
    IconButton,
    Tooltip,
    Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CustomerToolbarProps {
  onAddCustomer: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const CustomerToolbar: React.FC<CustomerToolbarProps> = ({
  onAddCustomer,
  onRefresh,
  isLoading,
}) => {
  const { t } = useTranslation();

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3 
      }}
    >
      <Typography variant="h4" component="h1">
        {t('customers.title')}
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip title={t('common.refresh')}>
          <IconButton 
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddCustomer}
        >
          {t('customers.addCustomer')}
        </Button>
      </Box>
    </Box>
  );
};
