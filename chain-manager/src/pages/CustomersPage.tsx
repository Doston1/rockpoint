import {
  Alert,
  Container,
  LinearProgress,
  Paper,
  Snackbar,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CustomerDetailsDialog,
  CustomerFilters,
  CustomerFormDialog,
  CustomerStatsCards,
  CustomerTable,
  CustomerToolbar,
  DeleteCustomerDialog,
} from '../components/customers';
import { useCustomers } from '../hooks/useCustomers';
import type { Customer } from '../services/api';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other' | '';
  loyalty_card_number: string;
  loyalty_points: number;
  discount_percentage: number;
  is_vip: boolean;
  notes: string;
}

const CustomersPage = () => {
  const { t } = useTranslation();
  
  // State for filters and pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [vipFilter, setVipFilter] = useState<string>('all');

  // Use customers hook with filters
  const {
    customers,
    pagination,
    isLoading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerTransactions,
    clearError,
    refetch,
  } = useCustomers({
    page: page + 1,
    limit: rowsPerPage,
    search: searchQuery,
    is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
    is_vip: vipFilter === 'vip' ? true : vipFilter === 'regular' ? false : undefined,
  });

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    phone: '',
    email: '',
    address: '',
    date_of_birth: '',
    gender: '',
    loyalty_card_number: '',
    loyalty_points: 0,
    discount_percentage: 0,
    is_vip: false,
    notes: '',
  });

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      date_of_birth: '',
      gender: '',
      loyalty_card_number: '',
      loyalty_points: 0,
      discount_percentage: 0,
      is_vip: false,
      notes: '',
    });
  };

  const handleAddCustomer = async () => {
    try {
      const customerData = {
        ...formData,
        gender: formData.gender || undefined,
        date_of_birth: formData.date_of_birth || undefined,
      };
      const result = await createCustomer(customerData);
      if (result) {
        setSnackbar({
          open: true,
          message: t('customers.customerCreated'),
          severity: 'success',
        });
        setAddDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      date_of_birth: (customer as any).date_of_birth || '',
      gender: (customer as any).gender || '',
      loyalty_card_number: (customer as any).loyalty_card_number || '',
      loyalty_points: (customer as any).loyalty_points || 0,
      discount_percentage: (customer as any).discount_percentage || 0,
      is_vip: customer.is_vip || false,
      notes: (customer as any).notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;

    try {
      const customerData = {
        ...formData,
        gender: formData.gender || undefined,
        date_of_birth: formData.date_of_birth || undefined,
      };
      const result = await updateCustomer(editingCustomer.id.toString(), customerData);
      if (result) {
        setSnackbar({
          open: true,
          message: t('customers.customerUpdated'),
          severity: 'success',
        });
        setEditDialogOpen(false);
        setEditingCustomer(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const handleViewDetails = async (customer: Customer) => {
    setEditingCustomer(customer);
    
    try {
      // Fetch customer transactions
      const transactionData = await getCustomerTransactions(customer.id.toString(), {
        limit: 20
      });
      
      if (transactionData) {
        setCustomerTransactions(transactionData.transactions);
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
      setSnackbar({
        open: true,
        message: t('customers.errorLoadingDetails'),
        severity: 'error',
      });
    }
    
    setDetailsDialogOpen(true);
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      const result = await deleteCustomer(customerToDelete.id.toString());
      if (result) {
        setSnackbar({
          open: true,
          message: t('customers.customerDeleted'),
          severity: 'success',
        });
        setDeleteDialogOpen(false);
        setCustomerToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const handleRefresh = () => {
    if (refetch) {
      refetch();
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header and Actions */}
      <CustomerToolbar
        onAddCustomer={() => setAddDialogOpen(true)}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      {/* Stats Cards */}
      <CustomerStatsCards
        customers={customers}
        totalCount={pagination?.total || customers.length}
      />

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <CustomerFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        vipFilter={vipFilter}
        setVipFilter={setVipFilter}
        customerCount={customers.length}
      />

      {/* Loading */}
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Customers Table */}
      <Paper>
        <CustomerTable
          customers={customers}
          page={page}
          rowsPerPage={rowsPerPage}
          totalCustomers={pagination?.total || customers.length}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          onViewDetails={handleViewDetails}
          onEditCustomer={handleEditCustomer}
          onDeleteCustomer={(customer) => {
            setCustomerToDelete(customer);
            setDeleteDialogOpen(true);
          }}
        />
      </Paper>

      {/* Add Customer Dialog */}
      <CustomerFormDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleAddCustomer}
        title={t('customers.addNewCustomer')}
        submitLabel={t('customers.addCustomer')}
      />

      {/* Edit Customer Dialog */}
      <CustomerFormDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleUpdateCustomer}
        title={t('customers.editCustomerDetails')}
        submitLabel={t('customers.updateCustomer')}
      />

      {/* Customer Details Dialog */}
      <CustomerDetailsDialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        customer={editingCustomer}
        transactions={customerTransactions}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteCustomerDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        customer={customerToDelete}
        onConfirm={handleDeleteCustomer}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default CustomersPage;
