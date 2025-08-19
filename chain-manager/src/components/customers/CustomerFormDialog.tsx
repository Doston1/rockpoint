import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Customer } from '../../services/api';

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

interface CustomerFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  customer?: Customer | null;
  formData: CustomerFormData;
  setFormData: (data: CustomerFormData) => void;
  title: string;
  submitLabel: string;
}

export const CustomerFormDialog: React.FC<CustomerFormDialogProps> = ({
  open,
  onClose,
  onSubmit,
  customer,
  formData,
  setFormData,
  title,
  submitLabel,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 2,
            mt: 1
          }}
        >
          <TextField
            fullWidth
            label={t('customers.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          
          <TextField
            fullWidth
            label={t('customers.phone')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          
          <TextField
            fullWidth
            label={t('customers.email')}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          
          <FormControl fullWidth>
            <InputLabel>{t('customers.gender')}</InputLabel>
            <Select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
              label={t('customers.gender')}
            >
              <MenuItem value="">{t('customers.notSpecified')}</MenuItem>
              <MenuItem value="male">{t('customers.male')}</MenuItem>
              <MenuItem value="female">{t('customers.female')}</MenuItem>
              <MenuItem value="other">{t('customers.other')}</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            label={t('customers.dateOfBirth')}
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          
          {customer && (
            <TextField
              fullWidth
              label={t('customers.loyaltyCardNumber')}
              value={formData.loyalty_card_number}
              onChange={(e) => setFormData({ ...formData, loyalty_card_number: e.target.value })}
            />
          )}
          
          <TextField
            fullWidth
            label={t('customers.loyaltyPoints')}
            type="number"
            value={formData.loyalty_points}
            onChange={(e) => setFormData({ ...formData, loyalty_points: parseInt(e.target.value) || 0 })}
            inputProps={{ min: 0 }}
          />
          
          <TextField
            fullWidth
            label={t('customers.discountPercentage')}
            type="number"
            value={formData.discount_percentage}
            onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            InputProps={{ endAdornment: '%' }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_vip}
                onChange={(e) => setFormData({ ...formData, is_vip: e.target.checked })}
              />
            }
            label={t('customers.vipCustomer')}
          />
          
          <TextField
            fullWidth
            label={t('customers.address')}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            sx={{ gridColumn: { md: 'span 2' } }}
          />
          
          <TextField
            fullWidth
            label={t('customers.notes')}
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            sx={{ gridColumn: { md: 'span 2' } }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button 
          onClick={onSubmit} 
          variant="contained"
          disabled={!formData.name}
        >
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
