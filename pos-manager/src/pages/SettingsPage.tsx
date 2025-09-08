import {
  AccountBalance,
  Computer,
  Key,
  NetworkCheck,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NavigationBar } from '../components/NavigationBar';
import { useAuth } from '../hooks/useAuth';

interface SettingsOption {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  requiredRole?: string;
}

const SETTINGS_OPTIONS: SettingsOption[] = [
  {
    title: 'settings.paymentMethodsSettings',
    description: 'settings.paymentMethodsDescription',
    icon: <AccountBalance sx={{ fontSize: 48 }} />,
    path: '/settings/payment-methods',
    color: 'primary',
    requiredRole: 'admin',
  },
  {
    title: 'settings.networkSettings',
    description: 'settings.networkDescription',
    icon: <NetworkCheck sx={{ fontSize: 48 }} />,
    path: '/settings/network',
    color: 'info',
    requiredRole: 'admin',
  },
  {
    title: 'settings.terminalManagement',
    description: 'settings.terminalDescription',
    icon: <Computer sx={{ fontSize: 48 }} />,
    path: '/settings/terminals',
    color: 'success',
    requiredRole: 'admin',
  },
  {
    title: 'settings.apiKeyManagement',
    description: 'settings.apiKeyDescription',
    icon: <Key sx={{ fontSize: 48 }} />,
    path: '/settings/api-keys',
    color: 'warning',
    requiredRole: 'admin',
  },
];

const SettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!user || user.role !== 'admin') {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">
          {t('settings.accessDenied')}
        </Alert>
      </Container>
    );
  }

  const availableOptions = SETTINGS_OPTIONS.filter(option => 
    !option.requiredRole || user.role === option.requiredRole
  );

  const handleOptionClick = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <NavigationBar />
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <SettingsIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight="bold">
              {t('settings.title')}
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            {t('settings.subtitle')}
          </Typography>
        </Box>

        {/* Settings Options Grid */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: 3 
        }}>
          {availableOptions.map((option) => (
            <Card
              key={option.path}
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                  [`& .icon-container`]: {
                    transform: 'scale(1.1)',
                  },
                },
              }}
              onClick={() => handleOptionClick(option.path)}
            >
              <CardContent sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                textAlign: 'center',
                p: 3,
              }}>
                <Box
                  className="icon-container"
                  sx={{
                    mb: 2,
                    color: `${option.color}.main`,
                    transition: 'transform 0.2s ease-in-out',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  {option.icon}
                </Box>
                
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {t(option.title)}
                </Typography>
                
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ flexGrow: 1 }}
                >
                  {t(option.description)}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Info Section */}
        <Box sx={{ mt: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                {t('settings.systemInformation')}
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: 2 
              }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.softwareVersion')}
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    RockPoint POS v1.0.0
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.userRole')}
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.lastUpdated')}
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {new Date().toLocaleDateString()}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('settings.environment')}
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {t('settings.production')}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </>
  );
};

export default SettingsPage;
