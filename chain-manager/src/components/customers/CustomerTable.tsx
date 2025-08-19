import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
    Chip,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tooltip,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Customer } from '../../services/api';

interface CustomerTableProps {
  customers: Customer[];
  page: number;
  rowsPerPage: number;
  totalCustomers: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onViewDetails: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  page,
  rowsPerPage,
  totalCustomers,
  onPageChange,
  onRowsPerPageChange,
  onViewDetails,
  onEditCustomer,
  onDeleteCustomer,
}) => {
  const { t } = useTranslation();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('customers.name')}</TableCell>
              <TableCell>{t('customers.contact')}</TableCell>
              <TableCell>{t('customers.status')}</TableCell>
              <TableCell>{t('customers.type')}</TableCell>
              <TableCell align="center">{t('customers.totalPurchases')}</TableCell>
              <TableCell align="right">{t('customers.totalSpent')}</TableCell>
              <TableCell>{t('customers.joinDate')}</TableCell>
              <TableCell align="center">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id} hover>
                <TableCell>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    {customer.email && (
                      <div style={{ fontSize: '0.875rem' }}>{customer.email}</div>
                    )}
                    {customer.phone && (
                      <div style={{ fontSize: '0.875rem', color: '#666' }}>{customer.phone}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Chip
                    label={customer.is_active ? t('customers.active') : t('customers.inactive')}
                    color={customer.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={customer.is_vip ? t('customers.vip') : t('customers.regular')}
                    color={customer.is_vip ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">{customer.transaction_count || 0}</TableCell>
                <TableCell align="right">{formatCurrency(customer.total_spent || 0)}</TableCell>
                <TableCell>{customer.createdAt ? formatDate(customer.createdAt) : '-'}</TableCell>
                <TableCell align="center">
                  <Tooltip title={t('customers.viewDetails')}>
                    <IconButton 
                      size="small" 
                      onClick={() => onViewDetails(customer)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.edit')}>
                    <IconButton 
                      size="small" 
                      onClick={() => onEditCustomer(customer)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('common.delete')}>
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => onDeleteCustomer(customer)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      <TablePagination
        component="div"
        count={totalCustomers}
        page={page}
        onPageChange={onPageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage={t('common.rowsPerPage')}
        labelDisplayedRows={({ from, to, count }) =>
          t('common.paginationLabel', { from, to, count })
        }
      />
    </>
  );
};
