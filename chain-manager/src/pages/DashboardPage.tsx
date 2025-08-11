import {
  Assessment,
  Business,
  Group,
  Inventory,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  IconButton,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useDashboard } from '../hooks/useDashboard';

const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { dashboardData, comprehensiveStats, isLoading, error, refetch } = useDashboard();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Function to translate payment method
  const translatePaymentMethod = (method: string | undefined) => {
    if (!method) return t('common.cash');
    const methodKey = `paymentMethods.${method.toLowerCase()}`;
    const translated = t(methodKey);
    return translated === methodKey ? method : translated;
  };

  // Function to translate user role
  const translateRole = (role: string | undefined) => {
    if (!role) return '';
    // Try to get translation for the role, fallback to original if not found
    const roleKey = `roles.${role}`;
    const translated = t(roleKey);
    return translated === roleKey ? role : translated;
  };

  // Function to format currency
  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount && amount !== 0) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Function to format numbers
  const formatNumber = (num: number | undefined | null) => {
    if (!num && num !== 0) return '0';
    return num.toLocaleString();
  };

  const stats = [
    {
      title: t('dashboard.totalBranches'),
      value: comprehensiveStats ? formatNumber(comprehensiveStats.totalBranches) : (dashboardData ? '1' : '0'), 
      icon: <Business sx={{ fontSize: 40 }} />,
      color: 'primary.main',
      isLoading: isLoading,
      hasData: !!comprehensiveStats || !!dashboardData,
    },
    {
      title: t('dashboard.totalEmployees'),
      value: comprehensiveStats ? formatNumber(comprehensiveStats.totalEmployees) : (dashboardData ? formatNumber(dashboardData.active_employees) : '0'),
      icon: <Group sx={{ fontSize: 40 }} />,
      color: 'success.main',
      isLoading: isLoading,
      hasData: !!comprehensiveStats || !!dashboardData,
    },
    {
      title: t('dashboard.totalProducts'),
      value: comprehensiveStats ? formatNumber(comprehensiveStats.totalProducts) : '0',
      icon: <Inventory sx={{ fontSize: 40 }} />,
      color: 'info.main',
      isLoading: isLoading,
      hasData: !!comprehensiveStats,
    },
    {
      title: t('dashboard.todaySales'),
      value: comprehensiveStats ? formatCurrency(comprehensiveStats.todaySales) : (dashboardData ? formatCurrency(dashboardData.today_sales?.total_sales) : '$0'),
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: 'warning.main',
      isLoading: isLoading,
      hasData: !!comprehensiveStats || !!dashboardData,
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Welcome Section */}
      <Paper sx={{ p: 3, mb: 4, background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ color: 'white' }}>
              {t('dashboard.welcomeBack')}, {user?.name}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={refetch} disabled={isLoading} sx={{ color: 'white' }}>
              <Refresh />
            </IconButton>
          </Box>
        </Box>
        
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
              {t('dashboard.role')}: {translateRole(user?.role)}
            </Typography>
            <Typography variant="body1" sx={{ color: 'white', opacity: 0.9 }}>
              {t('dashboard.mainOffice')}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
                  {stat.isLoading ? (
                    <Skeleton variant="text" width={80} height={40} />
                  ) : (
                    <Typography variant="h4" fontWeight="bold" color={stat.hasData ? 'inherit' : 'text.disabled'}>
                      {stat.value}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ color: stat.color }}>
                  {stat.icon}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Additional Stats Cards */}
      {comprehensiveStats && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 3,
            mb: 4,
          }}
        >
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="h6">
                    {t('dashboard.monthSales')}
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {formatCurrency(comprehensiveStats.monthSales)}
                  </Typography>
                </Box>
                <Box sx={{ color: 'success.main' }}>
                  <Assessment sx={{ fontSize: 40 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="h6">
                    {t('dashboard.lowStockItems')}
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color={comprehensiveStats.lowStockItems > 0 ? 'warning.main' : 'text.primary'}>
                    {formatNumber(comprehensiveStats.lowStockItems)}
                  </Typography>
                </Box>
                <Box sx={{ color: comprehensiveStats.lowStockItems > 0 ? 'warning.main' : 'text.secondary' }}>
                  <Inventory sx={{ fontSize: 40 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="h6">
                    {t('dashboard.todayTransactions')}
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="info.main">
                    {formatNumber(comprehensiveStats.todayTransactions)}
                  </Typography>
                </Box>
                <Box sx={{ color: 'info.main' }}>
                  <TrendingUp sx={{ fontSize: 40 }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Recent Activity */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t('dashboard.recentActivity')}
        </Typography>
        
        {isLoading ? (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[...Array(5)].map((_, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Skeleton variant="text" width={200} />
                      <Skeleton variant="text" width={150} />
                    </Box>
                    <Skeleton variant="text" width={80} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        ) : (comprehensiveStats?.recentTransactions && comprehensiveStats.recentTransactions.length > 0) ? (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {comprehensiveStats.recentTransactions.slice(0, 5).map((transaction, index) => (
                  <Box key={transaction.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: index < 4 ? 1 : 0, borderBottom: index < 4 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {transaction.employee_name || t('inventory.unknownEmployee')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {transaction.branch_name || t('inventory.unknownBranch')} • {new Date(transaction.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(transaction.total_amount)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {translatePaymentMethod(transaction.payment_method)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        ) : dashboardData?.recent_transactions && dashboardData.recent_transactions.length > 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dashboardData.recent_transactions.slice(0, 5).map((transaction, index) => (
                  <Box key={transaction.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: index < 4 ? 1 : 0, borderBottom: index < 4 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {transaction.employee_name || t('inventory.unknownEmployee')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {transaction.branch_name || t('inventory.unknownBranch')} • {new Date(transaction.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(transaction.total_amount)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {translatePaymentMethod(transaction.payment_method)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Typography variant="body1" color="text.secondary" align="center">
                {t('dashboard.noRecentActivity')}
              </Typography>
            </CardContent>
          </Card>
        )}
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
