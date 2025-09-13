import {
  Add,
  ArrowBack,
  Computer,
  Edit,
  NetworkCheck,
  Refresh,
  Search,
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
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NavigationBar } from '../components/NavigationBar';

// This would be imported from your API service
// import apiService from '../services/api';

interface POSTerminal {
  id: string;
  terminal_id: string;
  name: string;
  ip_address: string;
  port: number;
  mac_address?: string;
  location?: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  assigned_employee_role?: string;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  last_seen?: string;
  hardware_info?: any;
  software_version?: string;
}

interface Employee {
  id: string;
  name: string;
  employee_id: string;
  role: string;
  status: string;
}

interface POSTerminalFormData {
  terminal_id: string;
  name: string;
  ip_address: string;
  port: number;
  mac_address?: string;
  location?: string;
  assigned_employee_id?: string;
  software_version?: string;
}

const POSTerminalManagementPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [terminals, setTerminals] = useState<POSTerminal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<POSTerminal | null>(null);
  const [formData, setFormData] = useState<POSTerminalFormData>({
    terminal_id: '',
    name: '',
    ip_address: '',
    port: 5173,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Mock data for demonstration - replace with actual API calls
      setTerminals([
        {
          id: '1',
          terminal_id: 'POS-001',
          name: 'Checkout Counter 1',
          ip_address: '192.168.1.101',
          port: 5173,
          mac_address: '00:11:22:33:44:55',
          location: 'Front Counter - Left',
          assigned_employee_id: '1',
          assigned_employee_name: 'John Doe',
          assigned_employee_role: 'cashier',
          status: 'online',
          last_seen: new Date().toISOString(),
          software_version: '1.0.0',
        },
        {
          id: '2',
          terminal_id: 'POS-002',
          name: 'Checkout Counter 2',
          ip_address: '192.168.1.102',
          port: 5173,
          mac_address: '00:11:22:33:44:56',
          location: 'Front Counter - Right',
          status: 'offline',
          last_seen: new Date(Date.now() - 3600000).toISOString(),
          software_version: '1.0.0',
        },
        {
          id: '3',
          terminal_id: 'POS-003',
          name: 'Self-Service Kiosk',
          ip_address: '192.168.1.103',
          port: 5173,
          mac_address: '00:11:22:33:44:57',
          location: 'Customer Service Area',
          status: 'maintenance',
          last_seen: new Date(Date.now() - 7200000).toISOString(),
          software_version: '0.9.5',
        },
      ]);

      setEmployees([
        { id: '1', name: 'John Doe', employee_id: 'EMP001', role: 'cashier', status: 'active' },
        { id: '2', name: 'Jane Smith', employee_id: 'EMP002', role: 'supervisor', status: 'active' },
        { id: '3', name: 'Mike Johnson', employee_id: 'EMP003', role: 'cashier', status: 'active' },
      ]);

      // Real API calls would look like this:
      // const [terminalsResponse, employeesResponse] = await Promise.all([
      //   apiService.request('GET', '/network/terminals'),
      //   apiService.getEmployees(),
      // ]);
      // if (terminalsResponse.success) setTerminals(terminalsResponse.data);
      // if (employeesResponse.success) setEmployees(employeesResponse.data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTerminal = async () => {
    try {
      // Mock save - replace with actual API call
      const newTerminal: POSTerminal = {
        id: editingTerminal?.id || Date.now().toString(),
        ...formData,
        status: 'offline',
        last_seen: new Date().toISOString(),
      };

      if (editingTerminal) {
        setTerminals(prev => prev.map(t => t.id === editingTerminal.id ? { ...t, ...newTerminal } : t));
      } else {
        setTerminals(prev => [...prev, newTerminal]);
      }

      setTerminalDialogOpen(false);
      setEditingTerminal(null);
      resetForm();

      // Real API call:
      // const response = await apiService.request('POST', '/network/terminals', formData);
      // if (response.success) {
      //   await loadData();
      //   setTerminalDialogOpen(false);
      //   setEditingTerminal(null);
      //   resetForm();
      // }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleTestConnection = async (terminalId: string) => {
    try {
      // Mock test connection - replace with actual API call
      setTerminals(prev => prev.map(t =>
        t.id === terminalId
          ? { ...t, status: Math.random() > 0.5 ? 'online' : 'error', last_seen: new Date().toISOString() }
          : t
      ));

      // Real API call:
      // const response = await apiService.request('POST', `/network/terminals/${terminalId}/test-connection`);
      // if (response.success) {
      //   await loadData();
      // }
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleEditTerminal = (terminal: POSTerminal) => {
    setEditingTerminal(terminal);
    setFormData({
      terminal_id: terminal.terminal_id,
      name: terminal.name,
      ip_address: terminal.ip_address,
      port: terminal.port,
      mac_address: terminal.mac_address,
      location: terminal.location,
      assigned_employee_id: terminal.assigned_employee_id,
      software_version: terminal.software_version,
    });
    setTerminalDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      terminal_id: '',
      name: '',
      ip_address: '',
      port: 5173,
    });
  };

  const getStatusChip = (status: string) => {
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
          </Box>
        }
        color={config.color}
        size="small"
      />
    );
  };

  const filteredTerminals = terminals.filter(terminal => {
    const matchesSearch = terminal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      terminal.terminal_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      terminal.ip_address.includes(searchTerm) ||
      terminal.location?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || terminal.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <NavigationBar />
      <Container maxWidth={false} sx={{ mt: 2, mb: 4, px: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/settings')}
              sx={{ mr: 2 }}
            >
              Back to Settings
            </Button>
            <Computer sx={{ mr: 1, fontSize: 32 }} />
            <Typography variant="h4" fontWeight="bold">
              {t('terminals.title')}
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
                resetForm();
                setEditingTerminal(null);
                setTerminalDialogOpen(true);
              }}
            >
              {t('terminals.addTerminal')}
            </Button>
          </Box>
        </Box>

        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3, mb: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('terminals.totalTerminals')}
              </Typography>
              <Typography variant="h4">
                {terminals.length}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('terminals.onlineTerminals')}
              </Typography>
              <Typography variant="h4" color="success.main">
                {terminals.filter(t => t.status === 'online').length}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('terminals.offlineTerminals')}
              </Typography>
              <Typography variant="h4" color="error.main">
                {terminals.filter(t => t.status === 'offline').length}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('terminals.maintenanceTerminals')}
              </Typography>
              <Typography variant="h4" color="warning.main">
                {terminals.filter(t => t.status === 'maintenance').length}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              placeholder={t('terminals.searchTerminals')}
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
              <InputLabel>{t('terminals.filterByStatus')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('terminals.filterByStatus')}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">{t('terminals.allStatuses')}</MenuItem>
                <MenuItem value="online">{t('terminals.online')}</MenuItem>
                <MenuItem value="offline">{t('terminals.offline')}</MenuItem>
                <MenuItem value="maintenance">{t('terminals.maintenance')}</MenuItem>
                <MenuItem value="error">{t('terminals.error')}</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {filteredTerminals.length} {t('terminals.terminals')}
            </Typography>
          </Stack>
        </Paper>

        {/* Terminals Grid */}
        {filteredTerminals.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Computer sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('terminals.noTerminalsFound')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetForm();
                setEditingTerminal(null);
                setTerminalDialogOpen(true);
              }}
              sx={{ mt: 2 }}
            >
              {t('terminals.addFirstTerminal')}
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 3 }}>
            {filteredTerminals.map((terminal) => (
              <Card key={terminal.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" fontWeight="bold">
                      {terminal.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {getStatusChip(terminal.status)}
                      <IconButton size="small" onClick={() => handleEditTerminal(terminal)}>
                        <Edit />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>{t('terminals.terminalId')}:</strong> {terminal.terminal_id}
                    </Typography>
                    <Typography variant="body2">
                      <strong>{t('terminals.ipAddress')}:</strong> {terminal.ip_address}:{terminal.port}
                    </Typography>
                    {terminal.mac_address && (
                      <Typography variant="body2">
                        <strong>{t('terminals.macAddress')}:</strong> {terminal.mac_address}
                      </Typography>
                    )}
                    {terminal.location && (
                      <Typography variant="body2">
                        <strong>{t('terminals.location')}:</strong> {terminal.location}
                      </Typography>
                    )}
                    {terminal.assigned_employee_name && (
                      <Typography variant="body2">
                        <strong>{t('terminals.assignedTo')}:</strong> {terminal.assigned_employee_name} ({terminal.assigned_employee_role})
                      </Typography>
                    )}
                    {terminal.software_version && (
                      <Typography variant="body2">
                        <strong>{t('terminals.softwareVersion')}:</strong> {terminal.software_version}
                      </Typography>
                    )}
                    {terminal.last_seen && (
                      <Typography variant="caption" color="text.secondary">
                        {t('terminals.lastSeen')}: {new Date(terminal.last_seen).toLocaleString()}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<NetworkCheck />}
                      onClick={() => handleTestConnection(terminal.id)}
                    >
                      {t('terminals.testConnection')}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Terminal Configuration Dialog */}
        <Dialog open={terminalDialogOpen} onClose={() => setTerminalDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingTerminal ? t('terminals.editTerminal') : t('terminals.addTerminal')}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
              <TextField
                label={t('terminals.terminalId')}
                value={formData.terminal_id}
                onChange={(e) => setFormData(prev => ({ ...prev, terminal_id: e.target.value }))}
                fullWidth
                placeholder="POS-001"
              />

              <TextField
                label={t('terminals.terminalName')}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
                placeholder="Checkout Counter 1"
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
                <TextField
                  label={t('terminals.ipAddress')}
                  value={formData.ip_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                  placeholder="192.168.1.101"
                />
                <TextField
                  label={t('terminals.port')}
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                />
              </Box>

              <TextField
                label={`${t('terminals.macAddress')} ${t('terminals.optional')}`}
                value={formData.mac_address || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, mac_address: e.target.value }))}
                fullWidth
                placeholder="00:11:22:33:44:55"
              />

              <TextField
                label={`${t('terminals.location')} ${t('terminals.optional')}`}
                value={formData.location || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                fullWidth
                placeholder="Front Counter - Left"
              />

              <FormControl fullWidth>
                <InputLabel>{`${t('terminals.assignedEmployee')} ${t('terminals.optional')}`}</InputLabel>
                <Select
                  value={formData.assigned_employee_id || ''}
                  label={`${t('terminals.assignedEmployee')} ${t('terminals.optional')}`}
                  onChange={(e) => setFormData(prev => ({ ...prev, assigned_employee_id: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>{t('terminals.none')}</em>
                  </MenuItem>
                  {employees.filter(emp => emp.status === 'active').map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employee_id}) - {employee.role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label={`${t('terminals.softwareVersion')} ${t('terminals.optional')}`}
                value={formData.software_version || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, software_version: e.target.value }))}
                fullWidth
                placeholder="1.0.0"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTerminalDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveTerminal} variant="contained">
              {editingTerminal ? t('terminals.updateTerminal') : t('terminals.addPOSTerminal')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
};

export default POSTerminalManagementPage;
