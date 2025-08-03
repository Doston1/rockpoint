import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React from 'react';
import { BranchInventory, Product } from '../../services/api';

interface StockAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    adjustment: number;
    type: 'add' | 'subtract' | 'set';
    reason: string;
  }) => Promise<void>;
  inventoryItem?: BranchInventory & { product?: Product };
  isLoading?: boolean;
}

export const StockAdjustmentDialog: React.FC<StockAdjustmentDialogProps> = ({
  open,
  onClose,
  onSave,
  inventoryItem,
  isLoading = false,
}) => {
  const [formData, setFormData] = React.useState({
    adjustment: 0,
    type: 'set' as 'add' | 'subtract' | 'set',
    reason: '',
  });

  React.useEffect(() => {
    if (inventoryItem) {
      setFormData({
        adjustment: inventoryItem.quantityInStock,
        type: 'set',
        reason: '',
      });
    } else {
      setFormData({
        adjustment: 0,
        type: 'set',
        reason: '',
      });
    }
  }, [inventoryItem, open]);

  const handleSave = async () => {
    await onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof typeof formData) => (event: any) => {
    let value = event.target.value;
    if (field === 'adjustment') {
      value = parseFloat(value) || 0;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getResultingStock = () => {
    if (!inventoryItem) return 0;
    
    switch (formData.type) {
      case 'add':
        return inventoryItem.quantityInStock + formData.adjustment;
      case 'subtract':
        return Math.max(0, inventoryItem.quantityInStock - formData.adjustment);
      case 'set':
        return formData.adjustment;
      default:
        return inventoryItem.quantityInStock;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Adjust Stock Quantity
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {inventoryItem?.product && (
            <Box>
              <Typography variant="h6">{inventoryItem.product.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                SKU: {inventoryItem.product.sku}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current Stock: {inventoryItem.quantityInStock}
              </Typography>
              <Typography variant="body2" color="primary">
                New Stock: {getResultingStock()}
              </Typography>
            </Box>
          )}
          
          <FormControl fullWidth>
            <InputLabel>Adjustment Type</InputLabel>
            <Select
              value={formData.type}
              onChange={handleChange('type')}
              label="Adjustment Type"
            >
              <MenuItem value="add">Add to Stock</MenuItem>
              <MenuItem value="subtract">Remove from Stock</MenuItem>
              <MenuItem value="set">Set Exact Quantity</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            label={
              formData.type === 'add' 
                ? 'Quantity to Add'
                : formData.type === 'subtract'
                ? 'Quantity to Remove'
                : 'Set Quantity To'
            }
            type="number"
            value={formData.adjustment}
            onChange={handleChange('adjustment')}
            inputProps={{ min: 0 }}
            required
          />
          
          <TextField
            fullWidth
            label="Reason for Adjustment"
            value={formData.reason}
            onChange={handleChange('reason')}
            multiline
            rows={3}
            required
            placeholder="e.g., Stock count correction, Product return, Damaged goods removal"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={isLoading || !formData.reason.trim() || formData.adjustment < 0}
        >
          {isLoading ? 'Adjusting...' : 'Adjust Stock'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
