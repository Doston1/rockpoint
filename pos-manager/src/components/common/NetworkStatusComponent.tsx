import {
  Computer,
  NetworkCheck,
  Router,
  Settings,
  SignalWifi4Bar,
  WifiOff,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Paper,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface NetworkInfo {
  terminalId: string;
  terminalIp: string;
  terminalPort: number;
  branchServerIp: string;
  branchServerPort: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastPing?: number;
}

const NetworkStatusComponent = () => {
  const { t } = useTranslation();
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    terminalId: 'POS-001',
    terminalIp: '192.168.1.100',
    terminalPort: 5173,
    branchServerIp: 'localhost',
    branchServerPort: 3000,
    connectionStatus: 'connecting',
  });

  useEffect(() => {
    // Get network information from environment or API
    const getNetworkInfo = () => {
      // In a real implementation, this would come from:
      // 1. Environment variables
      // 2. Local storage
      // 3. API call to branch server
      // 4. Network interface detection
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const urlParts = baseUrl.replace('http://', '').replace('/api', '').split(':');
      
      setNetworkInfo(prev => ({
        ...prev,
        terminalId: localStorage.getItem('terminal_id') || 'POS-001',
        terminalIp: getLocalIP() || '192.168.1.100',
        branchServerIp: urlParts[0] || 'localhost',
        branchServerPort: parseInt(urlParts[1]) || 3000,
        connectionStatus: navigator.onLine ? 'connected' : 'disconnected',
      }));
    };

    // Get local IP address (simplified version)
    const getLocalIP = (): string => {
      // This is a simplified version - in production you'd need a more robust solution
      return localStorage.getItem('local_ip') || '192.168.1.100';
    };

    // Test connection to branch server
    const testConnection = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/health`, {
          method: 'GET',
        });
        
        const ping = Date.now() - startTime;
        
        setNetworkInfo(prev => ({
          ...prev,
          connectionStatus: response.ok ? 'connected' : 'disconnected',
          lastPing: ping,
        }));
      } catch (error) {
        setNetworkInfo(prev => ({
          ...prev,
          connectionStatus: 'disconnected',
        }));
      }
    };

    getNetworkInfo();
    testConnection();

    // Set up periodic connection testing
    const interval = setInterval(testConnection, 30000); // Test every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Chip
            icon={<SignalWifi4Bar />}
            label={`${t('dashboard.connectionStatus')}: ${t('common.online')}`}
            color="success"
            size="small"
          />
        );
      case 'disconnected':
        return (
          <Chip
            icon={<WifiOff />}
            label={`${t('dashboard.connectionStatus')}: ${t('common.offline')}`}
            color="error"
            size="small"
          />
        );
      case 'connecting':
        return (
          <Chip
            icon={<NetworkCheck />}
            label={`${t('dashboard.connectionStatus')}: Connecting...`}
            color="warning"
            size="small"
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Router sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">
            Network Information
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Connection Status */}
          <Box>
            {getStatusChip(networkInfo.connectionStatus)}
            {networkInfo.lastPing && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                ({networkInfo.lastPing}ms)
              </Typography>
            )}
          </Box>

          {/* Terminal Information */}
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Computer sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight="bold">
                This Terminal
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2">
                <strong>Terminal ID:</strong> {networkInfo.terminalId}
              </Typography>
              <Typography variant="body2">
                <strong>IP Address:</strong> {networkInfo.terminalIp}
              </Typography>
              <Typography variant="body2">
                <strong>Port:</strong> {networkInfo.terminalPort}
              </Typography>
            </Box>
          </Paper>

          {/* Branch Server Information */}
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Settings sx={{ fontSize: 16, color: 'secondary.main' }} />
              <Typography variant="subtitle2" fontWeight="bold">
                Branch Server
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2">
                <strong>IP Address:</strong> {networkInfo.branchServerIp}
              </Typography>
              <Typography variant="body2">
                <strong>Port:</strong> {networkInfo.branchServerPort}
              </Typography>
              <Typography variant="body2">
                <strong>API Endpoint:</strong> {import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}
              </Typography>
            </Box>
          </Paper>
        </Box>
      </CardContent>
    </Card>
  );
};

export default NetworkStatusComponent;
