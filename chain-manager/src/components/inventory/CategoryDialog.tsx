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
  TextField,
} from '@mui/material';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Category } from '../../services/api';

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  category?: Category | null;
  categories?: Category[];
  isLoading?: boolean;
}

const CategoryDialog: React.FC<CategoryDialogProps> = ({
  open,
  onClose,
  onSave,
  category,
  categories = [],
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = React.useState({
    key: '',
    name: '',
    nameEn: '',
    nameRu: '',
    nameUz: '',
    description: '',
    descriptionRu: '',
    descriptionUz: '',
    parentId: '',
    sortOrder: 0,
    onecId: '',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setFormData({
        key: category.key || '',
        name: category.name || '',
        nameEn: category.nameEn || '',
        nameRu: category.nameRu || '',
        nameUz: category.nameUz || '',
        description: category.description || '',
        descriptionRu: category.descriptionRu || '',
        descriptionUz: category.descriptionUz || '',
        parentId: category.parentId || '',
        sortOrder: category.sortOrder || 0,
        onecId: category.oneCId || '',
      });
    } else {
      setFormData({
        key: '',
        name: '',
        nameEn: '',
        nameRu: '',
        nameUz: '',
        description: '',
        descriptionRu: '',
        descriptionUz: '',
        parentId: '',
        sortOrder: 0,
        onecId: '',
      });
    }
    setErrors({});
  }, [category, open]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.key.trim()) {
      newErrors.key = t('inventory.categoryKeyRequired');
    }
    if (!formData.name.trim()) {
      newErrors.name = t('inventory.categoryNameRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      await onSave({
        key: formData.key.trim(),
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || undefined,
        nameRu: formData.nameRu.trim() || undefined,
        nameUz: formData.nameUz.trim() || undefined,
        description: formData.description.trim() || undefined,
        descriptionRu: formData.descriptionRu.trim() || undefined,
        descriptionUz: formData.descriptionUz.trim() || undefined,
        parentId: formData.parentId || undefined,
        sortOrder: formData.sortOrder,
        oneCId: formData.onecId.trim() || undefined,
        isActive: true,
      });
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Filter out current category from parent options to prevent self-reference
  const availableParentCategories = categories.filter(cat =>
    !category || cat.id !== category.id
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {category ? t('inventory.editCategory') : t('inventory.addCategory')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label={t('inventory.categoryKey')}
            value={formData.key}
            onChange={handleChange('key')}
            error={!!errors.key}
            helperText={errors.key}
            fullWidth
            required
            disabled={isLoading}
          />

          <TextField
            label={t('inventory.categoryName')}
            value={formData.name}
            onChange={handleChange('name')}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
            disabled={isLoading}
          />

          <TextField
            label={t('inventory.categoryNameEn')}
            value={formData.nameEn}
            onChange={handleChange('nameEn')}
            fullWidth
            disabled={isLoading}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('inventory.categoryNameRu')}
              value={formData.nameRu}
              onChange={handleChange('nameRu')}
              fullWidth
              disabled={isLoading}
            />
            <TextField
              label={t('inventory.categoryNameUz')}
              value={formData.nameUz}
              onChange={handleChange('nameUz')}
              fullWidth
              disabled={isLoading}
            />
          </Box>

          <TextField
            label={t('inventory.description')}
            value={formData.description}
            onChange={handleChange('description')}
            multiline
            rows={2}
            fullWidth
            disabled={isLoading}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('inventory.descriptionRu')}
              value={formData.descriptionRu}
              onChange={handleChange('descriptionRu')}
              multiline
              rows={2}
              fullWidth
              disabled={isLoading}
            />
            <TextField
              label={t('inventory.descriptionUz')}
              value={formData.descriptionUz}
              onChange={handleChange('descriptionUz')}
              multiline
              rows={2}
              fullWidth
              disabled={isLoading}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth disabled={isLoading}>
              <InputLabel>{t('inventory.parentCategory')}</InputLabel>
              <Select
                value={formData.parentId}
                onChange={(event) => setFormData(prev => ({ ...prev, parentId: event.target.value }))}
                label={t('inventory.parentCategory')}
              >
                <MenuItem value="">
                  <em>{t('inventory.noParent')}</em>
                </MenuItem>
                {availableParentCategories.map(cat => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t('inventory.sortOrder')}
              type="number"
              value={formData.sortOrder}
              onChange={handleChange('sortOrder')}
              fullWidth
              disabled={isLoading}
              inputProps={{ min: 0 }}
            />
          </Box>

          <TextField
            label={t('inventory.oneCId')}
            value={formData.onecId}
            onChange={handleChange('onecId')}
            fullWidth
            disabled={isLoading}
            placeholder="e.g., CAT001"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { CategoryDialog };

