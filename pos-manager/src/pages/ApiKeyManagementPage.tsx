import {
  Add,
  ContentCopy,
  Delete,
  Edit,
  Key,
  Refresh,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationBar } from '../components/NavigationBar';

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  branch_id?: string;
  branch_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  last_used_at?: string;
  usage_count: number;
  key_preview: string;
}

interface ApiKeyFormData {
  name: string;
  description?: string;
  permissions: string[];
  branch_id?: string;
  expires_at?: string;
}

interface Permission {
  name: string;
  description: string;
}

const ApiKeyManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null);
  const [newApiKeyData, setNewApiKeyData] = useState<{ key: string; warning: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [apiKeyFormData, setApiKeyFormData] = useState<ApiKeyFormData>({
    name: '',
    description: '',
    permissions: [],
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [apiKeysResponse, permissionsResponse, branchesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/api-keys`),
        fetch(`${API_BASE_URL}/admin/api-keys/permissions`),
        fetch(`${API_BASE_URL}/admin/branches`),
      ]);

      if (apiKeysResponse.ok) {
        const apiKeysData = await apiKeysResponse.json();
        setApiKeys(apiKeysData.data?.api_keys || []);
      }
      
      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        setAvailablePermissions(permissionsData.data?.permissions || []);
      }
      
      if (branchesResponse.ok) {
        const branchesData = await branchesResponse.json();
        setBranches(branchesData.data?.branches || []);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetApiKeyForm = () => {
    setApiKeyFormData({
      name: '',
      description: '',
      permissions: [],
    });
  };

  const handleCreateApiKey = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiKeyFormData),
      });

      if (response.ok) {
        const data = await response.json();
        setNewApiKeyData({
          key: data.data.api_key,
          warning: data.data.warning
        });
        await loadData();
        resetApiKeyForm();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create API key');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleUpdateApiKey = async (id: string, updates: Partial<ApiKeyFormData>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/api-keys/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadData();
        setEditingApiKey(null);
        setApiKeyDialogOpen(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update API key');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/api-keys/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete API key');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleRegenerateApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to regenerate this API key? The old key will stop working immediately.')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/api-keys/${id}/regenerate`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setNewApiKeyData({
          key: data.data.api_key,
          warning: data.data.warning
        });
        await loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to regenerate API key');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleEditApiKey = (apiKey: ApiKey) => {
    setEditingApiKey(apiKey);
    setApiKeyFormData({
      name: apiKey.name,
      description: apiKey.description || '',
      permissions: apiKey.permissions,
      branch_id: apiKey.branch_id,
      expires_at: apiKey.expires_at,
    });
    setApiKeyDialogOpen(true);
  };

  return (
    <>
      <NavigationBar />
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Key sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">
            {t('apiKeys.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={loadData} disabled={isLoading}>
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetApiKeyForm();
              setEditingApiKey(null);
              setApiKeyDialogOpen(true);
            }}
          >
            {t('apiKeys.createApiKey')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* New API Key Display */}
      {newApiKeyData && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <IconButton
              onClick={() => setNewApiKeyData(null)}
              size="small"
            >
              ×
            </IconButton>
          }
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {newApiKeyData.warning}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <TextField
              value={newApiKeyData.key}
              size="small"
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton
                    onClick={() => copyToClipboard(newApiKeyData.key)}
                    size="small"
                  >
                    <ContentCopy />
                  </IconButton>
                ),
              }}
            />
          </Box>
        </Alert>
      )}

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Key sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('apiKeys.noApiKeysFound')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t('apiKeys.createFirstApiKey')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetApiKeyForm();
              setEditingApiKey(null);
              setApiKeyDialogOpen(true);
            }}
            sx={{ mt: 2 }}
          >
            {t('apiKeys.createFirstKey')}
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {apiKey.name}
                      </Typography>
                      <Chip
                        label={apiKey.is_active ? t('apiKeys.active') : t('apiKeys.inactive')}
                        color={apiKey.is_active ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                    {apiKey.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {apiKey.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2">
                        <strong>{t('apiKeys.key')}:</strong>
                      </Typography>
                      <TextField
                        size="small"
                        value={showApiKey[apiKey.id] ? apiKey.key_preview : '••••••••••••••••'}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={() => setShowApiKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                              >
                                {showApiKey[apiKey.id] ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => copyToClipboard(apiKey.key_preview || 'Key not available')}
                                title="Copy key preview"
                              >
                                <ContentCopy />
                              </IconButton>
                            </Box>
                          ),
                        }}
                        sx={{ width: 300 }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>{t('apiKeys.permissions')}:</strong> {apiKey.permissions.join(', ') || 'None'}
                    </Typography>
                    {apiKey.branch_name && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>{t('apiKeys.branch')}:</strong> {apiKey.branch_name}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>{t('apiKeys.usageCount')}:</strong> {apiKey.usage_count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('apiKeys.created')}: {new Date(apiKey.created_at).toLocaleString()}
                      {apiKey.last_used_at && ` • ${t('apiKeys.lastUsed')}: ${new Date(apiKey.last_used_at).toLocaleString()}`}
                      {apiKey.expires_at && ` • ${t('apiKeys.expires')}: ${new Date(apiKey.expires_at).toLocaleString()}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => handleEditApiKey(apiKey)}
                    >
                      {t('apiKeys.edit')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={() => handleRegenerateApiKey(apiKey.id)}
                    >
                      {t('apiKeys.regenerate')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => handleDeleteApiKey(apiKey.id)}
                    >
                      {t('apiKeys.delete')}
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* API Key Dialog */}
      <Dialog open={apiKeyDialogOpen} onClose={() => setApiKeyDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingApiKey ? 'Edit API Key' : 'Create New API Key'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={apiKeyFormData.name}
              onChange={(e) => setApiKeyFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              helperText="A descriptive name for this API key (e.g., 'Chain-Core Integration', 'Backup System')"
            />

            <TextField
              label="Description"
              value={apiKeyFormData.description}
              onChange={(e) => setApiKeyFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              helperText="Optional description of what this API key is used for"
            />

            <FormControl fullWidth>
              <InputLabel>Branch (Optional)</InputLabel>
              <Select
                value={apiKeyFormData.branch_id || ''}
                label="Branch (Optional)"
                onChange={(e) => setApiKeyFormData(prev => ({ ...prev, branch_id: e.target.value || undefined }))}
              >
                <MenuItem value="">All Branches</MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Permissions</InputLabel>
              <Select
                multiple
                value={apiKeyFormData.permissions}
                label="Permissions"
                onChange={(e) => setApiKeyFormData(prev => ({ 
                  ...prev, 
                  permissions: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value 
                }))}
                renderValue={(selected) => selected.join(', ')}
              >
                {availablePermissions.map((permission) => (
                  <MenuItem key={permission.name} value={permission.name}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {permission.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {permission.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Expires At (Optional)"
              type="datetime-local"
              value={apiKeyFormData.expires_at || ''}
              onChange={(e) => setApiKeyFormData(prev => ({ ...prev, expires_at: e.target.value }))}
              fullWidth
              helperText="Leave empty for no expiration"
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={editingApiKey ? 
              () => handleUpdateApiKey(editingApiKey.id, apiKeyFormData) : 
              handleCreateApiKey
            } 
            variant="contained"
          >
            {editingApiKey ? 'Update' : 'Create'} API Key
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </>
  );
};

export default ApiKeyManagementPage;
