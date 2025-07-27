import {
  Assessment,
  Inventory,
  People,
  PointOfSale,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { NavigationBar } from '../components/NavigationBar';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, terminalId } = useWebSocket();
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const menuItems = [
    {
      title: t('navigation.checkout'),
      description: t('dashboard.checkoutDescription'),
      icon: <PointOfSale sx={{ fontSize: 48 }} />,
      action: () => navigate('/checkout'),
      color: 'primary.main',
    },
    {
      title: t('navigation.inventory'),
      description: t('dashboard.inventoryDescription'),
      icon: <Inventory sx={{ fontSize: 48 }} />,
      action: () => navigate('/inventory'),
      color: 'secondary.main',
    },
    {
      title: t('navigation.employees'),
      description: t('dashboard.employeesDescription'),
      icon: <People sx={{ fontSize: 48 }} />,
      action: () => navigate('/employees'),
      color: 'success.main',
    },
    {
      title: t('navigation.reports'),
      description: t('dashboard.reportsDescription'),
      icon: <Assessment sx={{ fontSize: 48 }} />,
      action: () => console.log(t('dashboard.reportsComingSoon')),
      color: 'warning.main',
    },
  ];

  return (
    <>
      <NavigationBar />

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Welcome Section */}
        <Paper sx={{ p: 3, mb: 4, background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)' }}>
          <Typography variant="h4" gutterBottom sx={{ color: 'white' }}>
            {t('dashboard.welcomeBack')}, {user?.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ color: 'white', opacity: 0.9 }}>
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Typography>
              <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                {currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit'
                })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip 
                label={`${t('dashboard.role')}: ${user?.role}`} 
                color="default" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label={`${t('dashboard.employeeId')}: ${user?.employeeId}`} 
                color="default" 
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
              <Chip 
                label={isConnected ? t('dashboard.terminalConnecting', { terminalId: terminalId || 'Connecting...' }) : t('dashboard.offlineMode')} 
                color={isConnected ? 'success' : 'error'}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </Box>
          </Box>
        </Paper>

        {/* Menu Items */}
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          {t('dashboard.quickActions')}
        </Typography>
        
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(4, 1fr)',
            },
            gap: 3,
          }}
        >
          {menuItems.map((item, index) => (
            <Card 
              key={index}
              sx={{ 
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                  '& .icon': {
                    transform: 'scale(1.1)',
                  }
                }
              }}
              onClick={item.action}
            >
              <CardContent sx={{ textAlign: 'center', p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Box 
                  className="icon"
                  sx={{ 
                    color: item.color, 
                    mb: 2,
                    transition: 'transform 0.2s ease-in-out'
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="h6" gutterBottom>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* System Status */}
        <Paper sx={{ mt: 4, p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.systemStatus')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.connectionStatus')}
              </Typography>
              <Chip 
                label={isConnected ? t('common.online') : t('common.offline')}
                color={isConnected ? 'success' : 'error'}
                size="small"
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.terminalId')}
              </Typography>
              <Typography variant="body1">
                {terminalId || t('dashboard.notAssigned')}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.version')}
              </Typography>
              <Typography variant="body1">
                v1.0.0
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </>
  );
};

export default DashboardPage;