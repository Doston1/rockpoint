import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Customer } from '../../services/api';

interface DeleteCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  customer: Customer | null;
}

export const DeleteCustomerDialog: React.FC<DeleteCustomerDialogProps> = ({
  open,
  onClose,
  onConfirm,
  customer,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t('customers.deleteCustomer')}</DialogTitle>
      <DialogContent>
        <Typography>
          {customer && t('customers.deleteCustomerConfirm', { name: customer.name })}
        </Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('customers.deleteWarning')}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          {t('customers.deactivate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
