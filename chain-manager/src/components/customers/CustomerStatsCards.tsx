import {
    Business,
    Group,
    Star,
    TrendingUp,
} from '@mui/icons-material';
import {
    Box,
    Card,
    CardContent,
    Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Customer } from '../../services/api';

interface CustomerStatsCardsProps {
  customers: Customer[];
  totalCount?: number;
}

export const CustomerStatsCards: React.FC<CustomerStatsCardsProps> = ({
  customers,
  totalCount,
}) => {
  const { t } = useTranslation();

  return (
    <Box 
      sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: 3,
        mb: 3 
      }}
    >
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center">
            <Group sx={{ mr: 1, color: 'primary.main' }} />
            <Box>
              <Typography color="textSecondary" variant="body2">
                {t('customers.totalCustomers')}
              </Typography>
              <Typography variant="h4">
                {totalCount || customers.length}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center">
            <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
            <Box>
              <Typography color="textSecondary" variant="body2">
                {t('customers.activeCustomers')}
              </Typography>
              <Typography variant="h4" color="success.main">
                {customers.filter(c => c.is_active).length}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center">
            <Star sx={{ mr: 1, color: 'warning.main' }} />
            <Box>
              <Typography color="textSecondary" variant="body2">
                {t('customers.vipCustomers')}
              </Typography>
              <Typography variant="h4" color="warning.main">
                {customers.filter(c => c.is_vip).length}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center">
            <Business sx={{ mr: 1, color: 'info.main' }} />
            <Box>
              <Typography color="textSecondary" variant="body2">
                {t('customers.totalLoyaltyPoints')}
              </Typography>
              <Typography variant="h4" color="info.main">
                {customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
