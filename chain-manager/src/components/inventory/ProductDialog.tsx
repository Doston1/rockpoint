import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Branch, Category, Product } from '../../services/api';

interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, selectedBranches: string[]) => Promise<void>;
  product?: Product;
  categories: Category[];
  branches: Branch[];
  isLoading?: boolean;
  selectedBranchId?: string | null; // Add branch context
}

export const ProductDialog: React.FC<ProductDialogProps> = ({
  open,
  onClose,
  onSave,
  product,
  categories,
  branches,
  isLoading = false,
  selectedBranchId,
}) => {
  const { t } = useTranslation();
  
  // Branch selection state (only for new products in general inventory)
  const [selectedBranches, setSelectedBranches] = React.useState<string[]>([]);
  
  // Only show branch selection for new products when not viewing a specific branch
  const showBranchSelection = !product && !selectedBranchId;
  
  const [formData, setFormData] = React.useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>({
    sku: '',
    barcode: '',
    name: '',
    nameEn: '',
    nameRu: '',
    nameUz: '',
    description: '',
    descriptionEn: '',
    descriptionRu: '',
    descriptionUz: '',
    categoryId: '',
    categoryName: '',
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

      // Find category name from categoryId
      const selectedCategory = categories.find(cat => cat.id === product.categoryId);

      setFormData({
        sku: product.sku,
        barcode: product.barcode || '',
        name: product.name,
        nameEn: product.nameEn || '',
        nameRu: product.nameRu || '',
        nameUz: product.nameUz || '',
        description: product.description || '',
        descriptionEn: product.descriptionEn || '',
        descriptionRu: product.descriptionRu || '',
        descriptionUz: product.descriptionUz || '',
        categoryId: product.categoryId || '',
        categoryName: selectedCategory?.name || '',
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
        nameEn: '',
        nameRu: '',
        nameUz: '',
        description: '',
        descriptionEn: '',
        descriptionRu: '',
        descriptionUz: '',
        categoryId: '',
        categoryName: '',
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
  }, [product, open, selectedBranchId, categories]);

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name?.trim()) {
      alert(t('inventory.nameRequired'));
      return;
    }
    if (!formData.sku?.trim()) {
      alert(t('inventory.skuRequired'));
      return;
    }
    if (formData.basePrice <= 0) {
      alert(t('inventory.priceRequired'));
      return;
    }

    await onSave(formData, selectedBranches);
    onClose();
  };

  const handleChange = (field: keyof typeof formData) => (event: any) => {
    let value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    
    // Convert numeric fields to numbers
    if (field === 'basePrice' || field === 'cost' || field === 'taxRate') {
      value = parseFloat(value) || 0;
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {product ? t('inventory.editProduct') : t('inventory.addProduct')}
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
              <strong>{t('inventory.branchSpecificEditingMode')}</strong>
              <br />
              <small>{t('inventory.branchSpecificEditingDescription')}</small>
            </Box>
          </Box>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={t('inventory.sku')}
              value={formData.sku}
              onChange={handleChange('sku')}
              required
            />
            <TextField
              fullWidth
              label={t('inventory.barcode')}
              value={formData.barcode}
              onChange={handleChange('barcode')}
            />
          </Box>
          
          {/* Product Names Section */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            {t('inventory.productNames')}
          </Typography>
          
          <TextField
            fullWidth
            label={t('inventory.productName') + ' (' + t('inventory.primary') + ')'}
            value={formData.name}
            onChange={handleChange('name')}
            required
            helperText={t('inventory.primaryNameHelper')}
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={t('inventory.nameEnglish')}
              value={formData.nameEn}
              onChange={handleChange('nameEn')}
              helperText={t('inventory.nameEnglishHelper')}
            />
            <TextField
              fullWidth
              label={t('inventory.nameRussian')}
              value={formData.nameRu}
              onChange={handleChange('nameRu')}
              helperText={t('inventory.nameRussianHelper')}
            />
          </Box>
          
          <TextField
            fullWidth
            label={t('inventory.nameUzbek')}
            value={formData.nameUz}
            onChange={handleChange('nameUz')}
            helperText={t('inventory.nameUzbekHelper')}
          />
          
          {/* Product Descriptions Section */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            {t('inventory.productDescriptions')}
          </Typography>
          
          <TextField
            fullWidth
            label={t('inventory.description') + ' (' + t('inventory.primary') + ')'}
            value={formData.description}
            onChange={handleChange('description')}
            multiline
            rows={2}
            helperText={t('inventory.primaryDescriptionHelper')}
          />
          
          <TextField
            fullWidth
            label={t('inventory.descriptionEnglish')}
            value={formData.descriptionEn}
            onChange={handleChange('descriptionEn')}
            multiline
            rows={2}
            helperText={t('inventory.descriptionEnglishHelper')}
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={t('inventory.descriptionRussian')}
              value={formData.descriptionRu}
              onChange={handleChange('descriptionRu')}
              multiline
              rows={2}
              helperText={t('inventory.descriptionRussianHelper')}
            />
            <TextField
              fullWidth
              label={t('inventory.descriptionUzbek')}
              value={formData.descriptionUz}
              onChange={handleChange('descriptionUz')}
              multiline
              rows={2}
              helperText={t('inventory.descriptionUzbekHelper')}
            />
          </Box>
          
          {/* Category and Brand Section */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            {t('inventory.categoryAndBrand')}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={t('inventory.categoryName')}
              value={formData.categoryName}
              onChange={handleChange('categoryName')}
              helperText={t('inventory.categoryNameHelper')}
            />
            <TextField
              fullWidth
              label={t('inventory.brand')}
              value={formData.brand}
              onChange={handleChange('brand')}
            />
          </Box>
          
          {/* Pricing Section */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            {t('inventory.pricingInformation')}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={t('inventory.unitOfMeasure')}
              value={formData.unitOfMeasure}
              onChange={handleChange('unitOfMeasure')}
              required
            />
            <TextField
              fullWidth
              label={selectedBranchId ? t('inventory.branchPrice') : t('inventory.basePrice')}
              type="number"
              value={formData.basePrice}
              onChange={handleChange('basePrice')}
              required
              helperText={
                selectedBranchId 
                  ? t('inventory.branchPriceHelper') 
                  : t('inventory.basePriceHelper')
              }
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={selectedBranchId ? t('inventory.branchCost') : t('inventory.baseCost')}
              type="number"
              value={formData.cost}
              onChange={handleChange('cost')}
              helperText={
                selectedBranchId 
                  ? t('inventory.branchCostHelper') 
                  : t('inventory.baseCostHelper')
              }
            />
            <TextField
              fullWidth
              label={t('inventory.taxRate')}
              type="number"
              value={formData.taxRate}
              onChange={handleChange('taxRate')}
              helperText={t('inventory.taxRateHelper')}
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
                {t('inventory.globalReference')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label={t('inventory.globalBasePrice')}
                  type="number"
                  value={Number(product.basePrice).toFixed(2)}
                  InputProps={{
                    readOnly: true,
                  }}
                  variant="filled"
                  size="small"
                  helperText={t('inventory.globalBasePriceHelper')}
                />
                <TextField
                  fullWidth
                  label={t('inventory.globalBaseCost')}
                  type="number"
                  value={product.cost ? Number(product.cost).toFixed(2) : '0.00'}
                  InputProps={{
                    readOnly: true,
                  }}
                  variant="filled"
                  size="small"
                  helperText={t('inventory.globalBaseCostHelper')}
                />
              </Box>
            </Box>
          )}
          
          {/* Branch Selection Section (only for new products in general inventory) */}
          {showBranchSelection && (
            <>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                {t('inventory.branchDistribution')}
              </Typography>
              
              <Autocomplete
                multiple
                options={branches}
                getOptionLabel={(option) => option.name}
                value={branches.filter(branch => selectedBranches.includes(branch.id))}
                onChange={(_, newValue) => {
                  setSelectedBranches(newValue.map(branch => branch.id));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('inventory.selectBranches')}
                    helperText={t('inventory.selectBranchesHelper')}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option.name}
                      {...getTagProps({ index })}
                      key={option.id}
                    />
                  ))
                }
              />
            </>
          )}
          
          {/* Additional Information Section */}
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            {t('inventory.additionalInformation')}
          </Typography>
          
          <TextField
            fullWidth
            label={t('inventory.imageUrl')}
            value={formData.imageUrl}
            onChange={handleChange('imageUrl')}
            helperText={t('inventory.imageUrlHelper')}
          />
          
          <TextField
            fullWidth
            label={t('inventory.oneCId')}
            value={formData.oneCId}
            onChange={handleChange('oneCId')}
            helperText={t('inventory.oneCIdHelper')}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={handleChange('isActive')}
              />
            }
            label={t('inventory.active')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={isLoading || !formData.sku || !formData.name}
        >
          {isLoading ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
