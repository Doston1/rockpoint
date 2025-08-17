import {
  Add,
  ContentCopy,
  Delete,
  Edit,
  Key,
  NetworkCheck,
  Refresh,
  Router,
  Search,
  Settings,
  SettingsEthernet,
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
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import apiService from '../services/api';

interface BranchServer {
  id: string;
  branch_id: string;
  branch_name: string;
  branch_code: string;
  server_name: string;
  ip_address: string;
  port: number;
  api_port: number;
  websocket_port: number;
  vpn_ip_address?: string;
  public_ip_address?: string;
  network_type: 'lan' | 'vpn' | 'public';
  status: 'online' | 'offline' | 'maintenance' | 'error';
  last_ping?: string;
  response_time_ms?: number;
  server_info?: any;
  api_key?: string; // Key that branch uses to authenticate to chain-core
  outbound_api_key?: string; // Key that chain-core uses to authenticate to branch
}

interface NetworkSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
  category: string;
  is_system: boolean;
}

interface BranchServerFormData {
  branch_id: string;
  server_name: string;
  ip_address: string;
  port: number;
  api_port: number;
  websocket_port: number;
  vpn_ip_address?: string;
  public_ip_address?: string;
  network_type: 'lan' | 'vpn' | 'public';
  api_key?: string; // Key that branch uses to authenticate to chain-core
  outbound_api_key?: string; // Key that chain-core uses to authenticate to branch
}

interface ApiKey {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
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
  expires_at?: string;
}

interface Permission {
  name: string;
  description: string;
}

const NetworkManagementPage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [branchServers, setBranchServers] = useState<BranchServer[]>([]);
  const [networkSettings, setNetworkSettings] = useState<NetworkSetting[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  
  // Dialog states
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<BranchServer | null>(null);
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null);
  const [newApiKeyData, setNewApiKeyData] = useState<{ key: string; warning: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<BranchServerFormData>({
    branch_id: '',
    server_name: '',
    ip_address: '',
    port: 3000,
    api_port: 3000,
    websocket_port: 3001,
    network_type: 'lan',
  });
  const [apiKeyFormData, setApiKeyFormData] = useState<ApiKeyFormData>({
    name: '',
    description: '',
    permissions: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [serversResponse, settingsResponse, branchesResponse, apiKeysResponse, permissionsResponse] = await Promise.all([
        apiService.request('GET', '/network/branch-servers'),
        apiService.request('GET', '/network/settings'),
        apiService.getBranches(),
        apiService.request('GET', '/admin/api-keys'),
        apiService.request('GET', '/admin/api-keys/permissions'),
      ]);

      if (serversResponse.success) setBranchServers(serversResponse.data);
      if (settingsResponse.success) setNetworkSettings(settingsResponse.data);
      if (branchesResponse.success) {
        setBranches(Array.isArray(branchesResponse.data) ? branchesResponse.data : branchesResponse.data?.branches || []);
      }
      if (apiKeysResponse.success) setApiKeys(apiKeysResponse.data.api_keys || []);
      if (permissionsResponse.success) setAvailablePermissions(permissionsResponse.data.permissions || []);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServer = async () => {
    try {
      const response = await apiService.request('POST', '/network/branch-servers', formData);
      if (response.success) {
        await loadData();
        setServerDialogOpen(false);
        setEditingServer(null);
        resetForm();
      } else {
        setError(response.error || 'Failed to save server configuration');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleTestConnection = async (serverId: string) => {
    try {
      setTestingServerId(serverId);
      const response = await apiService.request('POST', `/network/branch-servers/${serverId}/test-connection`);
      
      if (response.success) {
        // Show success message with connection details
        const data = response.data;
        let message = 'Connection test successful!';
        
        if (data.response_time_ms) {
          message += ` (${data.response_time_ms}ms)`;
        }
        
        if (data.authenticated === false) {
          message += '\n⚠️ Warning: Authentication failed - check outbound API key';
        } else if (data.authenticated === true) {
          message += '\n✅ Authentication successful';
        }
        
        alert(message);
        await loadData(); // Reload to get updated status
      } else {
        // Show failure message
        const errorMessage = response.data?.message || response.error || 'Connection test failed';
        alert(`❌ Connection test failed:\n${errorMessage}`);
        await loadData(); // Reload to get updated status
      }
    } catch (error: any) {
      alert(`❌ Connection test error:\n${error.message}`);
      setError(error.message);
    } finally {
      setTestingServerId(null);
    }
  };

  const handleEditServer = (server: BranchServer) => {
    setEditingServer(server);
    setFormData({
      branch_id: server.branch_id,
      server_name: server.server_name,
      ip_address: server.ip_address,
      port: server.port,
      api_port: server.api_port,
      websocket_port: server.websocket_port,
      vpn_ip_address: server.vpn_ip_address,
      public_ip_address: server.public_ip_address,
      network_type: server.network_type,
      api_key: server.api_key,
      outbound_api_key: server.outbound_api_key,
    });
    setServerDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      branch_id: '',
      server_name: '',
      ip_address: '',
      port: 3000,
      api_port: 3000,
      websocket_port: 3001,
      network_type: 'lan',
    });
  };

  const resetApiKeyForm = () => {
    setApiKeyFormData({
      name: '',
      description: '',
      permissions: [],
    });
  };

  // API Key Management Functions
  const handleCreateApiKey = async () => {
    try {
      const response = await apiService.request('POST', '/admin/api-keys', apiKeyFormData);
      if (response.success) {
        setNewApiKeyData({
          key: response.data.api_key,
          warning: response.data.warning
        });
        await loadData();
        resetApiKeyForm();
      } else {
        setError(response.error || 'Failed to create API key');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleUpdateApiKey = async (id: string, updates: Partial<ApiKeyFormData>) => {
    try {
      const response = await apiService.request('PUT', `/admin/api-keys/${id}`, updates);
      if (response.success) {
        await loadData();
        setEditingApiKey(null);
        setApiKeyDialogOpen(false);
      } else {
        setError(response.error || 'Failed to update API key');
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
      const response = await apiService.request('DELETE', `/admin/api-keys/${id}`);
      if (response.success) {
        await loadData();
      } else {
        setError(response.error || 'Failed to delete API key');
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleTestBranchConnections = async () => {
    try {
      setIsLoading(true);
      
      // Get all server IDs to test
      const serverIds = branchServers.map(server => server.id);
      
      if (serverIds.length === 0) {
        alert('No branch servers to test');
        return;
      }
      
      let successCount = 0;
      let failureCount = 0;
      const results: string[] = [];
      
      // Test each server individually
      for (const serverId of serverIds) {
        const server = branchServers.find(s => s.id === serverId);
        if (!server) continue;
        
        try {
          const response = await apiService.request('POST', `/network/branch-servers/${serverId}/test-connection`);
          if (response.success && response.data.status === 'online') {
            successCount++;
            results.push(`✅ ${server.branch_name}: Connected${response.data.authenticated ? ' & Authenticated' : ' (Auth Failed)'}`);
          } else {
            failureCount++;
            results.push(`❌ ${server.branch_name}: ${response.data?.message || 'Failed'}`);
          }
        } catch (error: any) {
          failureCount++;
          results.push(`❌ ${server.branch_name}: ${error.message}`);
        }
      }
      
      await loadData(); // Reload to get updated statuses
      
      // Show detailed results
      const message = `Connection Test Results:\n\n${results.join('\n')}\n\nSummary:\n✅ Online: ${successCount}\n❌ Offline: ${failureCount}`;
      alert(message);
      
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to regenerate this API key? The old key will stop working immediately.')) {
      return;
    }
    
    try {
      const response = await apiService.request('POST', `/admin/api-keys/${id}/regenerate`);
      if (response.success) {
        setNewApiKeyData({
          key: response.data.api_key,
          warning: response.data.warning
        });
        await loadData();
      } else {
        setError(response.error || 'Failed to regenerate API key');
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
      expires_at: apiKey.expires_at,
    });
    setApiKeyDialogOpen(true);
  };

  const getStatusChip = (status: string, responseTime?: number) => {
    const statusConfig = {
      online: { color: 'success' as const, icon: '🟢' },
      offline: { color: 'error' as const, icon: '🔴' },
      maintenance: { color: 'warning' as const, icon: '🟡' },
      error: { color: 'error' as const, icon: '❌' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.error;
    
    return (
      <Chip
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>{config.icon}</span>
            <span>{status}</span>
            {responseTime && <span>({responseTime}ms)</span>}
          </Box>
        }
        color={config.color}
        size="small"
      />
    );
  };

  const filteredServers = branchServers.filter(server => {
    const matchesSearch = server.branch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         server.ip_address.includes(searchTerm) ||
                         server.server_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || server.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const TabPanel = ({ children, value, index }: { children: React.ReactNode; value: number; index: number }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsEthernet sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">
            Network Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={loadData} disabled={isLoading}>
            <Refresh />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<NetworkCheck />}
            onClick={handleTestBranchConnections}
            disabled={isLoading}
          >
            Test All Connections
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetForm();
              setEditingServer(null);
              setServerDialogOpen(true);
            }}
          >
            Add Branch Server
          </Button>
        </Box>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label="Branch Servers" icon={<Router />} />
          <Tab label="Network Settings" icon={<Settings />} />
          <Tab label="1C API Keys" icon={<Key />} />
        </Tabs>
      </Paper>

      {/* Branch Servers Tab */}
      <TabPanel value={currentTab} index={0}>
        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              placeholder="Search branch servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: '100%', sm: '300px' } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={statusFilter}
                label="Filter by Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="online">Online</MenuItem>
                <MenuItem value="offline">Offline</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="error">Error</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {filteredServers.length} servers
            </Typography>
          </Stack>
        </Paper>

        {/* Branch Servers Grid */}
        {filteredServers.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Router sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No branch servers found
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetForm();
                setEditingServer(null);
                setServerDialogOpen(true);
              }}
              sx={{ mt: 2 }}
            >
              Add First Branch Server
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 3 }}>
            {filteredServers.map((server) => (
              <Card key={server.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold">
                      {server.branch_name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {getStatusChip(server.status, server.response_time_ms)}
                      <IconButton size="small" onClick={() => handleEditServer(server)}>
                        <Edit />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>Branch Code:</strong> {server.branch_code}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Server Name:</strong> {server.server_name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>IP Address:</strong> {server.ip_address}:{server.port}
                    </Typography>
                    <Typography variant="body2">
                      <strong>API Port:</strong> {server.api_port}
                    </Typography>
                    <Typography variant="body2">
                      <strong>WebSocket Port:</strong> {server.websocket_port}
                    </Typography>
                    {server.vpn_ip_address && (
                      <Typography variant="body2">
                        <strong>VPN IP:</strong> {server.vpn_ip_address}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Network Type:</strong> {server.network_type.toUpperCase()}
                    </Typography>
                    {server.api_key && (
                      <Typography variant="body2">
                        <strong>Branch API Key:</strong> {server.api_key.substring(0, 8)}...
                      </Typography>
                    )}
                    {server.outbound_api_key && (
                      <Typography variant="body2">
                        <strong>Outbound API Key:</strong> {server.outbound_api_key.substring(0, 8)}...
                      </Typography>
                    )}
                    {server.last_ping && (
                      <Typography variant="caption" color="text.secondary">
                        Last Ping: {new Date(server.last_ping).toLocaleString()}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={
                        testingServerId === server.id ? 
                          <Refresh sx={{ 
                            '@keyframes spin': {
                              '0%': { transform: 'rotate(0deg)' },
                              '100%': { transform: 'rotate(360deg)' }
                            },
                            animation: 'spin 1s linear infinite' 
                          }} /> : 
                          <NetworkCheck />
                      }
                      onClick={() => handleTestConnection(server.id)}
                      disabled={testingServerId === server.id}
                    >
                      {testingServerId === server.id ? 'Testing...' : 'Test Connection'}
                    </Button>
                    {server.outbound_api_key && (
                      <Chip
                        label="Outbound Auth Configured"
                        color="success"
                        size="small"
                        icon={<Key />}
                      />
                    )}
                    {!server.outbound_api_key && (
                      <Chip
                        label="No Outbound Auth"
                        color="warning"
                        size="small"
                        icon={<Key />}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Network Settings Tab */}
      <TabPanel value={currentTab} index={1}>
        <Box sx={{ display: 'grid', gap: 3 }}>
          {['general', 'ports', 'timeouts', 'security'].map(category => {
            const categorySettings = networkSettings.filter(s => s.category === category);
            if (categorySettings.length === 0) return null;

            return (
              <Card key={category}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, textTransform: 'capitalize' }}>
                    {category} Settings
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 2 }}>
                    {categorySettings.map((setting) => (
                      <Box key={setting.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" fontWeight="medium">
                            {setting.setting_key}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {setting.description}
                          </Typography>
                        </Box>
                        <TextField
                          size="small"
                          value={setting.setting_value}
                          disabled={setting.is_system}
                          sx={{ minWidth: 200 }}
                        />
                        {setting.is_system && (
                          <Chip label="System" size="small" color="secondary" />
                        )}
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </TabPanel>

      {/* 1C API Keys Tab */}
      <TabPanel value={currentTab} index={2}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            1C Integration API Keys
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetApiKeyForm();
              setEditingApiKey(null);
              setApiKeyDialogOpen(true);
            }}
          >
            Create API Key
          </Button>
        </Box>

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
              No API keys found
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Create your first API key to allow 1C system integration
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
              Create First API Key
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
                          label={apiKey.is_active ? 'Active' : 'Inactive'}
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
                          <strong>Key:</strong>
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
                        <strong>Permissions:</strong> {apiKey.permissions.join(', ') || 'None'}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Usage Count:</strong> {apiKey.usage_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(apiKey.created_at).toLocaleString()}
                        {apiKey.last_used_at && ` • Last used: ${new Date(apiKey.last_used_at).toLocaleString()}`}
                        {apiKey.expires_at && ` • Expires: ${new Date(apiKey.expires_at).toLocaleString()}`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Edit />}
                        onClick={() => handleEditApiKey(apiKey)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={() => handleRegenerateApiKey(apiKey.id)}
                      >
                        Regenerate
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Server Configuration Dialog */}
      <Dialog open={serverDialogOpen} onClose={() => setServerDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingServer ? 'Edit Branch Server' : 'Add Branch Server'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Branch</InputLabel>
              <Select
                value={formData.branch_id}
                label="Branch"
                onChange={(e) => setFormData(prev => ({ ...prev, branch_id: e.target.value }))}
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Server Name"
              value={formData.server_name}
              onChange={(e) => setFormData(prev => ({ ...prev, server_name: e.target.value }))}
              fullWidth
            />

            <TextField
              label="IP Address"
              value={formData.ip_address}
              onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
              fullWidth
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField
                label="Port"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
              />
              <TextField
                label="API Port"
                type="number"
                value={formData.api_port}
                onChange={(e) => setFormData(prev => ({ ...prev, api_port: parseInt(e.target.value) }))}
              />
              <TextField
                label="WebSocket Port"
                type="number"
                value={formData.websocket_port}
                onChange={(e) => setFormData(prev => ({ ...prev, websocket_port: parseInt(e.target.value) }))}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="VPN IP Address (Optional)"
                value={formData.vpn_ip_address || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, vpn_ip_address: e.target.value }))}
              />
              <TextField
                label="Public IP Address (Optional)"
                value={formData.public_ip_address || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, public_ip_address: e.target.value }))}
              />
            </Box>

            <FormControl fullWidth>
              <InputLabel>Network Type</InputLabel>
              <Select
                value={formData.network_type}
                label="Network Type"
                onChange={(e) => setFormData(prev => ({ ...prev, network_type: e.target.value as 'lan' | 'vpn' | 'public' }))}
              >
                <MenuItem value="lan">LAN</MenuItem>
                <MenuItem value="vpn">VPN</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Branch API Key (Optional)"
              value={formData.api_key || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
              fullWidth
              helperText="API key that the branch uses to authenticate to chain-core"
            />

            <TextField
              label="Chain-Core Outbound API Key (Optional)"
              value={formData.outbound_api_key || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, outbound_api_key: e.target.value }))}
              fullWidth
              helperText="API key that chain-core uses to authenticate to this branch"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setServerDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveServer} variant="contained">
            {editingServer ? 'Update' : 'Add'} Server
          </Button>
        </DialogActions>
      </Dialog>

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
              helperText="A descriptive name for this API key (e.g., '1C Production', '1C Testing')"
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
  );
};

export default NetworkManagementPage;
