import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import React from 'react';
import { BranchInventory, Product } from '../../services/api';

interface InventoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<BranchInventory>) => Promise<void>;
  inventoryItem?: BranchInventory & { product?: Product };
  isLoading?: boolean;
}

export const InventoryDialog: React.FC<InventoryDialogProps> = ({
  open,
  onClose,
  onSave,
  inventoryItem,
  isLoading = false,
}) => {
  const [formData, setFormData] = React.useState<Partial<BranchInventory>>({
    minStockLevel: 0,
    maxStockLevel: 0,
    reorderPoint: 0,
  });

  React.useEffect(() => {
    if (inventoryItem) {
      setFormData({
        minStockLevel: inventoryItem.minStockLevel,
        maxStockLevel: inventoryItem.maxStockLevel || undefined,
        reorderPoint: inventoryItem.reorderPoint || undefined,
      });
    } else {
      setFormData({
        minStockLevel: 0,
        maxStockLevel: 0,
        reorderPoint: 0,
      });
    }
  }, [inventoryItem, open]);

  const handleSave = async () => {
    await onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof typeof formData) => (event: any) => {
    const value = parseFloat(event.target.value) || 0;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Inventory Settings
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
            </Box>
          )}
          
          <TextField
            fullWidth
            label="Minimum Stock Level"
            type="number"
            value={formData.minStockLevel}
            onChange={handleChange('minStockLevel')}
            inputProps={{ min: 0 }}
            required
          />
          
          <TextField
            fullWidth
            label="Maximum Stock Level"
            type="number"
            value={formData.maxStockLevel || ''}
            onChange={handleChange('maxStockLevel')}
            inputProps={{ min: 0 }}
          />
          
          <TextField
            fullWidth
            label="Reorder Point"
            type="number"
            value={formData.reorderPoint || ''}
            onChange={handleChange('reorderPoint')}
            inputProps={{ min: 0 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={isLoading || !formData.minStockLevel}
        >
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
