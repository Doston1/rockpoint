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
    Typography,
} from '@mui/material';
import React from 'react';
import { Category, Product } from '../../services/api';

interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  product?: Product;
  categories: Category[];
  isLoading?: boolean;
  selectedBranchId?: string | null; // Add branch context
}

export const ProductDialog: React.FC<ProductDialogProps> = ({
  open,
  onClose,
  onSave,
  product,
  categories,
  isLoading = false,
  selectedBranchId,
}) => {
  const [formData, setFormData] = React.useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>({
    sku: '',
    barcode: '',
    name: '',
    nameRu: '',
    nameUz: '',
    description: '',
    descriptionRu: '',
    descriptionUz: '',
    categoryId: '',
    brand: '',
    unitOfMeasure: 'pcs',
    basePrice: 0,
    cost: 0,
    taxRate: 0,
    imageUrl: '',
    images: [],
    attributes: {},
    isActive: true,
    oneCId: '',
  });

  React.useEffect(() => {
    if (product) {
      // Use branch-specific pricing if available and branch is selected, otherwise use global pricing
      const effectivePrice = selectedBranchId && product.branch_price !== undefined 
        ? product.branch_price 
        : product.basePrice;
      const effectiveCost = selectedBranchId && product.branch_cost !== undefined 
        ? product.branch_cost 
        : (product.cost || 0);

      setFormData({
        sku: product.sku,
        barcode: product.barcode || '',
        name: product.name,
        nameRu: product.nameRu || '',
        nameUz: product.nameUz || '',
        description: product.description || '',
        descriptionRu: product.descriptionRu || '',
        descriptionUz: product.descriptionUz || '',
        categoryId: product.categoryId || '',
        brand: product.brand || '',
        unitOfMeasure: product.unitOfMeasure,
        basePrice: effectivePrice,
        cost: effectiveCost,
        taxRate: product.taxRate,
        imageUrl: product.imageUrl || '',
        images: product.images || [],
        attributes: product.attributes || {},
        isActive: product.isActive,
        oneCId: product.oneCId || '',
      });
    } else {
      setFormData({
        sku: '',
        barcode: '',
        name: '',
        nameRu: '',
        nameUz: '',
        description: '',
        descriptionRu: '',
        descriptionUz: '',
        categoryId: '',
        brand: '',
        unitOfMeasure: 'pcs',
        basePrice: 0,
        cost: 0,
        taxRate: 0,
        imageUrl: '',
        images: [],
        attributes: {},
        isActive: true,
        oneCId: '',
      });
    }
  }, [product, open, selectedBranchId]);

  const handleSave = async () => {
    await onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof typeof formData) => (event: any) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {product ? 'Edit Product' : 'Add New Product'}
      </DialogTitle>
      <DialogContent>
        {selectedBranchId && (
          <Box sx={{ 
            mb: 2, 
            p: 2, 
            bgcolor: 'primary.50', 
            border: 1, 
            borderColor: 'primary.200', 
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <Box sx={{ 
              width: 8, 
              height: 8, 
              bgcolor: 'primary.main', 
              borderRadius: '50%' 
            }} />
            <Box>
              <strong>Branch-Specific Editing Mode</strong>
              <br />
              <small>Price and cost changes will only affect this branch. Other product details update globally.</small>
            </Box>
          </Box>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="SKU"
              value={formData.sku}
              onChange={handleChange('sku')}
              required
            />
            <TextField
              fullWidth
              label="Barcode"
              value={formData.barcode}
              onChange={handleChange('barcode')}
            />
          </Box>
          
          <TextField
            fullWidth
            label="Product Name"
            value={formData.name}
            onChange={handleChange('name')}
            required
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Name (Russian)"
              value={formData.nameRu}
              onChange={handleChange('nameRu')}
            />
            <TextField
              fullWidth
              label="Name (Uzbek)"
              value={formData.nameUz}
              onChange={handleChange('nameUz')}
            />
          </Box>
          
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={handleChange('description')}
            multiline
            rows={3}
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.categoryId}
                onChange={handleChange('categoryId')}
                label="Category"
              >
                {categories.map(category => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Brand"
              value={formData.brand}
              onChange={handleChange('brand')}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Unit of Measure"
              value={formData.unitOfMeasure}
              onChange={handleChange('unitOfMeasure')}
              required
            />
            <TextField
              fullWidth
              label={selectedBranchId ? "Branch Price" : "Base Price"}
              type="number"
              value={formData.basePrice}
              onChange={handleChange('basePrice')}
              required
              helperText={
                selectedBranchId 
                  ? "Price for this specific branch (see global reference below)" 
                  : "Global base price for all branches"
              }
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={selectedBranchId ? "Branch Cost" : "Base Cost"}
              type="number"
              value={formData.cost}
              onChange={handleChange('cost')}
              helperText={
                selectedBranchId 
                  ? "Cost for this specific branch (see global reference below)" 
                  : "Global cost for all branches"
              }
            />
            <TextField
              fullWidth
              label="Tax Rate (%)"
              type="number"
              value={formData.taxRate}
              onChange={handleChange('taxRate')}
            />
          </Box>

          {/* Global Pricing Reference - Only show when in branch mode */}
          {selectedBranchId && product && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: 'grey.50', 
              border: 1, 
              borderColor: 'grey.300', 
              borderRadius: 1 
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                Global Reference (Read-only)
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Global Base Price"
                  type="number"
                  value={Number(product.basePrice).toFixed(2)}
                  InputProps={{
                    readOnly: true,
                  }}
                  variant="filled"
                  size="small"
                  helperText="Base price used across all branches"
                />
                <TextField
                  fullWidth
                  label="Global Base Cost"
                  type="number"
                  value={product.cost ? Number(product.cost).toFixed(2) : '0.00'}
                  InputProps={{
                    readOnly: true,
                  }}
                  variant="filled"
                  size="small"
                  helperText="Base cost used across all branches"
                />
              </Box>
            </Box>
          )}
          
          <TextField
            fullWidth
            label="Image URL"
            value={formData.imageUrl}
            onChange={handleChange('imageUrl')}
          />
          
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
          disabled={isLoading || !formData.sku || !formData.name}
        >
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
