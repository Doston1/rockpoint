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
    Stack,
    Switch,
    TextField,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs from 'dayjs';
import React from 'react';
import { Category, Product, Promotion } from '../../services/api';

interface PromotionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (promotion: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  promotion?: Promotion;
  categories: Category[];
  products: Product[];
  branchId: string;
  isLoading?: boolean;
}

export const PromotionDialog: React.FC<PromotionDialogProps> = ({
  open,
  onClose,
  onSave,
  promotion,
  categories,
  products,
  branchId,
  isLoading = false,
}) => {
  const [formData, setFormData] = React.useState<Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>>({
    branchId,
    name: '',
    description: '',
    type: 'percentage',
    productId: '',
    categoryId: '',
    discountPercentage: 0,
    discountAmount: 0,
    minQuantity: 1,
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(1, 'month').format('YYYY-MM-DD'),
    isActive: true,
  });

  React.useEffect(() => {
    if (promotion) {
      setFormData({
        branchId: promotion.branchId,
        name: promotion.name,
        description: promotion.description || '',
        type: promotion.type,
        productId: promotion.productId || '',
        categoryId: promotion.categoryId || '',
        discountPercentage: promotion.discountPercentage || 0,
        discountAmount: promotion.discountAmount || 0,
        minQuantity: promotion.minQuantity || 1,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        isActive: promotion.isActive,
      });
    } else {
      setFormData({
        branchId,
        name: '',
        description: '',
        type: 'percentage',
        productId: '',
        categoryId: '',
        discountPercentage: 0,
        discountAmount: 0,
        minQuantity: 1,
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(1, 'month').format('YYYY-MM-DD'),
        isActive: true,
      });
    }
  }, [promotion, open, branchId]);

  const handleSave = async () => {
    await onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof typeof formData) => (event: any) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate') => (date: dayjs.Dayjs | null) => {
    if (date) {
      setFormData(prev => ({ ...prev, [field]: date.format('YYYY-MM-DD') }));
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {promotion ? 'Edit Promotion' : 'Add New Promotion'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Promotion Name"
              value={formData.name}
              onChange={handleChange('name')}
              required
            />
            
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={handleChange('description')}
              multiline
              rows={2}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Promotion Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={handleChange('type')}
                  label="Promotion Type"
                  required
                >
                  <MenuItem value="percentage">Percentage Discount</MenuItem>
                  <MenuItem value="fixed_amount">Fixed Amount Discount</MenuItem>
                  <MenuItem value="buy_x_get_y">Buy X Get Y</MenuItem>
                  <MenuItem value="bulk_discount">Bulk Discount</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label="Minimum Quantity"
                type="number"
                value={formData.minQuantity}
                onChange={handleChange('minQuantity')}
                inputProps={{ min: 1 }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Apply to Product</InputLabel>
                <Select
                  value={formData.productId}
                  onChange={handleChange('productId')}
                  label="Apply to Product"
                >
                  <MenuItem value="">All Products</MenuItem>
                  {products.map(product => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Apply to Category</InputLabel>
                <Select
                  value={formData.categoryId}
                  onChange={handleChange('categoryId')}
                  label="Apply to Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              {formData.type === 'percentage' || formData.type === 'bulk_discount' ? (
                <TextField
                  fullWidth
                  label="Discount Percentage (%)"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={handleChange('discountPercentage')}
                  inputProps={{ min: 0, max: 100 }}
                />
              ) : (
                <TextField
                  fullWidth
                  label="Discount Amount"
                  type="number"
                  value={formData.discountAmount}
                  onChange={handleChange('discountAmount')}
                  inputProps={{ min: 0 }}
                />
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DatePicker
                label="Start Date"
                value={dayjs(formData.startDate)}
                onChange={handleDateChange('startDate')}
                sx={{ width: '100%' }}
              />
              <DatePicker
                label="End Date"
                value={dayjs(formData.endDate)}
                onChange={handleDateChange('endDate')}
                sx={{ width: '100%' }}
              />
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={handleChange('isActive')}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={isLoading || !formData.name}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};
