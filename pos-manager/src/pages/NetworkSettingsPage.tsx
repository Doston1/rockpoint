import {
  ArrowBack,
  Computer as ComputerIcon,
  NetworkCheck as NetworkCheckIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
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
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NavigationBar } from '../components/NavigationBar';
import NetworkService from '../services/networkService';

interface NetworkInfo {
  terminalId: string;
  localIp: string;
  port: number;
  softwareVersion: string;
  hardwareInfo: {
    platform: string;
    userAgent: string;
    language: string;
    screenResolution: string;
    memory?: number;
  };
}

interface NetworkConfig {
  id: number;
  server_ip: string;
  server_port: number;
  vpn_ip?: string;
  network_type: string;
  status: string;
}

const NetworkSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('3000');
  const [connectionStatus, setConnectionStatus] = useState<string>('unknown');

  const networkService = NetworkService.getInstance();

  useEffect(() => {
    loadNetworkInfo();
    loadNetworkConfig();
    testConnection();
  }, []);

  const loadNetworkInfo = async () => {
    try {
      const info = await networkService.getNetworkInfo();
      setNetworkInfo(info);
    } catch (error) {
      console.error('Failed to load network info:', error);
    }
  };

  const loadNetworkConfig = async () => {
    try {
      const config = await networkService.getNetworkConfig();
      setNetworkConfig(config);

      // Set server IP from config if available
      if (config && config.length > 0 && config[0]) {
        if (config[0].server_ip) {
          setServerIp(config[0].server_ip);
        }
        if (config[0].server_port) {
          setServerPort(config[0].server_port.toString());
        }
      }
    } catch (error) {
      console.error('Failed to load network config:', error);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      // Use the public health endpoint (no authentication required)
      const baseUrl = import.meta.env.VITE_API_URL || `http://${serverIp || 'localhost'}:${serverPort}/api`;
      const serverUrl = baseUrl.replace('/api', ''); // Remove /api to get base server URL
      const response = await fetch(`${serverUrl}/health`);
      setConnectionStatus(response.ok ? 'connected' : 'error');
    } catch (error) {
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterTerminal = async () => {
    setLoading(true);
    try {
      const success = await networkService.registerTerminal();
      if (success) {
        alert(t('Terminal registered successfully'));
        loadNetworkInfo();
      } else {
        alert(t('Failed to register terminal'));
      }
    } catch (error) {
      console.error('Registration failed:', error);
      alert(t('Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    // Save server configuration to localStorage for now
    localStorage.setItem('server_ip', serverIp);
    localStorage.setItem('server_port', serverPort);

    // Update environment variable override
    (window as any).VITE_API_URL = `http://${serverIp}:${serverPort}/api`;

    setConfigDialogOpen(false);
    testConnection();
    alert(t('Configuration saved. Please restart the application for changes to take effect.'));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'online':
        return 'success';
      case 'disconnected':
      case 'offline':
        return 'error';
      case 'error':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <>
      <NavigationBar />
      <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/settings')}
              sx={{ mr: 2 }}
            >
              Back to Settings
            </Button>
            <Typography variant="h4" fontWeight="bold">
              {t('network.title')}
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {t('network.subtitle')}
          </Typography>
        </Box>

        <Stack spacing={3}>
          {/* Top Row - Terminal Info and Connection Status */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {/* Terminal Information */}
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ComputerIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    {t('network.terminalInformation')}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title={t('network.refresh')}>
                    <IconButton onClick={loadNetworkInfo} size="small">
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>

                {networkInfo && (
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {t('network.terminalId')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                        {networkInfo.terminalId}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('network.localIp')}
                        </Typography>
                        <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                          {networkInfo.localIp}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('network.port')}
                        </Typography>
                        <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                          {networkInfo.port}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('network.platform')}
                        </Typography>
                        <Typography variant="body1">
                          {networkInfo.hardwareInfo.platform}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('network.resolution')}
                        </Typography>
                        <Typography variant="body1">
                          {networkInfo.hardwareInfo.screenResolution}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <NetworkCheckIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    {t('network.connectionStatus')}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={testConnection}
                    disabled={loading}
                    startIcon={<RefreshIcon />}
                  >
                    {t('network.test')}
                  </Button>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={t(`network.${connectionStatus}`) || connectionStatus.toUpperCase()}
                    color={getStatusColor(connectionStatus)}
                    sx={{ mr: 1 }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('network.serverAddress')}
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }} gutterBottom>
                  {serverIp || 'localhost'}:{serverPort}
                </Typography>

                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setConfigDialogOpen(true)}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  {t('network.configureServer')}
                </Button>
              </CardContent>
            </Card>
          </Stack>

          {/* Network Configuration */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StorageIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  {t('network.networkConfiguration')}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  variant="contained"
                  onClick={handleRegisterTerminal}
                  disabled={loading}
                >
                  {t('network.registerTerminal')}
                </Button>
              </Box>

              {networkConfig.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('network.serverIp')}</TableCell>
                        <TableCell>{t('network.port')}</TableCell>
                        <TableCell>{t('network.vpnIp')}</TableCell>
                        <TableCell>{t('network.type')}</TableCell>
                        <TableCell>{t('network.status')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {networkConfig.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>
                            {config.server_ip}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>
                            {config.server_port}
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>
                            {config.vpn_ip || '-'}
                          </TableCell>
                          <TableCell>
                            <Chip label={config.network_type} size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={config.status}
                              size="small"
                              color={getStatusColor(config.status)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">
                  {t('network.noNetworkConfig')}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Stack>

        {/* Configuration Dialog */}
        <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('network.serverConfiguration')}</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <TextField
                autoFocus
                label={t('network.serverIpAddress')}
                fullWidth
                variant="outlined"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="192.168.1.100"
                sx={{ mb: 2 }}
              />
              <TextField
                label={t('network.serverPort')}
                fullWidth
                variant="outlined"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                placeholder="3000"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveConfig} variant="contained">
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </>
  );
};

export default NetworkSettingsPage;
