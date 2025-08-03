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
import React from 'react';
import { Category, Product } from '../../services/api';

interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  product?: Product;
  categories: Category[];
  isLoading?: boolean;
}

export const ProductDialog: React.FC<ProductDialogProps> = ({
  open,
  onClose,
  onSave,
  product,
  categories,
  isLoading = false,
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
        basePrice: product.basePrice,
        cost: product.cost || 0,
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
  }, [product, open]);

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
              label="Base Price"
              type="number"
              value={formData.basePrice}
              onChange={handleChange('basePrice')}
              required
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Cost"
              type="number"
              value={formData.cost}
              onChange={handleChange('cost')}
            />
            <TextField
              fullWidth
              label="Tax Rate (%)"
              type="number"
              value={formData.taxRate}
              onChange={handleChange('taxRate')}
            />
          </Box>
          
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
