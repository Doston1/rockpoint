import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Customer } from '../../services/api';

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
      id={`customer-tabpanel-${index}`}
      aria-labelledby={`customer-tab-${index}`}
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

interface CustomerDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  transactions: any[];
}

export const CustomerDetailsDialog: React.FC<CustomerDetailsDialogProps> = ({
  open,
  onClose,
  customer,
  transactions,
}) => {
  const { t } = useTranslation();
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const getVipColor = (isVip: boolean) => {
    return isVip ? 'warning' : 'default';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!customer) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
    >
      <DialogTitle>{t('customers.customerDetails')}</DialogTitle>
      <DialogContent>
        <Box>
          <Tabs value={selectedTabIndex} onChange={(_, newValue) => setSelectedTabIndex(newValue)}>
            <Tab label={t('customers.basicInformation')} />
            <Tab label={t('customers.transactionHistory')} />
          </Tabs>

          <TabPanel value={selectedTabIndex} index={0}>
            <Box 
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                gap: 3
              }}
            >
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('customers.personalInformation')}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.name')}
                      </Typography>
                      <Typography variant="h6">{customer.name}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.phone')}
                      </Typography>
                      <Typography>{customer.phone || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.email')}
                      </Typography>
                      <Typography>{customer.email || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.address')}
                      </Typography>
                      <Typography>{customer.address || '-'}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('customers.loyaltyInformation')}
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.loyaltyCardNumber')}
                      </Typography>
                      <Typography>{customer.loyalty_card_number || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.loyaltyPoints')}
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {customer.loyalty_points?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.discountPercentage')}
                      </Typography>
                      <Typography>{customer.discount_percentage || 0}%</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.customerType')}
                      </Typography>
                      <Chip 
                        label={customer.is_vip ? t('customers.vip') : t('customers.regular')} 
                        color={getVipColor(customer.is_vip)} 
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('customers.totalSpent')}
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(customer.total_spent || 0)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </TabPanel>

          <TabPanel value={selectedTabIndex} index={1}>
            <Typography variant="h6" gutterBottom>
              {t('customers.recentTransactions')}
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('customers.transactionNumber')}</TableCell>
                    <TableCell>{t('customers.date')}</TableCell>
                    <TableCell>{t('customers.amount')}</TableCell>
                    <TableCell>{t('customers.paymentMethod')}</TableCell>
                    <TableCell>{t('customers.branch')}</TableCell>
                    <TableCell>{t('customers.cashier')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.length > 0 ? (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.transaction_number}</TableCell>
                        <TableCell>
                          {new Date(transaction.transaction_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(transaction.total_amount)}
                        </TableCell>
                        <TableCell>
                          {transaction.payment_method || '-'}
                        </TableCell>
                        <TableCell>
                          {transaction.branch_name || '-'}
                        </TableCell>
                        <TableCell>
                          {transaction.cashier_name || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {t('customers.noTransactions')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
