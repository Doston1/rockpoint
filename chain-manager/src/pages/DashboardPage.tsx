import {
    Assessment,
    Business,
    Group,
    Inventory,
    TrendingUp,
} from '@mui/icons-material';
import {
    Box,
    Card,
    CardContent,
    Container,
    Paper,
    Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const stats = [
    {
      title: t('dashboard.totalBranches'),
      value: '12',
      icon: <Business sx={{ fontSize: 40 }} />,
      color: 'primary.main',
    },
    {
      title: t('dashboard.totalEmployees'),
      value: '156',
      icon: <Group sx={{ fontSize: 40 }} />,
      color: 'success.main',
    },
    {
      title: t('dashboard.totalProducts'),
      value: '2,431',
      icon: <Inventory sx={{ fontSize: 40 }} />,
      color: 'info.main',
    },
    {
      title: t('dashboard.todaySales'),
      value: '$24,567',
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: 'warning.main',
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Welcome Section */}
      <Paper sx={{ p: 3, mb: 4, background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)' }}>
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
            <Typography variant="h6" sx={{ color: 'white' }}>
              {t('dashboard.role')}: {user?.role}
            </Typography>
            <Typography variant="body1" sx={{ color: 'white', opacity: 0.9 }}>
              {t('dashboard.mainOffice')}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Stats Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 3,
          mb: 4,
        }}
      >
        {stats.map((stat, index) => (
          <Card key={index} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="h6">
                    {stat.title}
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stat.value}
                  </Typography>
                </Box>
                <Box sx={{ color: stat.color }}>
                  {stat.icon}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Quick Actions */}
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        {t('dashboard.quickActions')}
      </Typography>
      
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
          },
          gap: 3,
        }}
      >
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Assessment sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                {t('dashboard.recentActivity')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.recentActivityDescription')}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">
                {t('dashboard.performanceMetrics')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.performanceMetricsDescription')}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default DashboardPage;
