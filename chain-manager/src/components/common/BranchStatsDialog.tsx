import {
  Business,
  Close,
  Inventory,
  People,
  Receipt,
  Refresh,
  TrendingUp,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import apiService, { Branch } from '../../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`stats-tabpanel-${index}`}
      aria-labelledby={`stats-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

interface BranchStatsDialogProps {
  open: boolean;
  onClose: () => void;
  branch: Branch | null;
}

interface BranchStats {
  employeeCount: number;
  todaySales: number;
  monthSales: number;
  productCount: number;
  lowStockCount: number;
  recentTransactions: number;
}

const BranchStatsDialog: React.FC<BranchStatsDialogProps> = ({
  open,
  onClose,
  branch,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranchData = async () => {
    if (!branch) return;

    setIsLoading(true);
    setError(null);

    try {
      const statsResponse = await apiService.getBranchStats(branch.id);

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      } else {
        setError(statsResponse.error || 'Failed to fetch branch stats');
      }
    } catch (err) {
      setError('Failed to fetch branch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && branch) {
      fetchBranchData();
    }
  }, [open, branch]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: branch?.currency || 'USD',
    }).format(amount);
  };

  if (!branch) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business />
            <Typography variant="h6">
              {branch.name} ({branch.code})
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={fetchBranchData} disabled={isLoading}>
              <Refresh />
            </IconButton>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Sales Performance" />
            <Tab label="Branch Information" />
          </Tabs>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Overview Tab */}
            <TabPanel value={currentTab} index={0}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 3 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <People color="primary" />
                      <Typography color="textSecondary" gutterBottom>
                        Active Employees
                      </Typography>
                    </Box>
                    <Typography variant="h4">
                      {stats?.employeeCount || 0}
                    </Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUp color="success" />
                      <Typography color="textSecondary" gutterBottom>
                        Today's Sales
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="success.main">
                      {stats ? formatCurrency(stats.todaySales) : '$0'}
                    </Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Inventory color="info" />
                      <Typography color="textSecondary" gutterBottom>
                        Total Products
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="info.main">
                      {stats?.productCount || 0}
                    </Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Warning color="warning" />
                      <Typography color="textSecondary" gutterBottom>
                        Low Stock Items
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="warning.main">
                      {stats?.lowStockCount || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Receipt color="primary" />
                    <Typography variant="h6">
                      Recent Activity
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {stats?.recentTransactions || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Transactions in last 24 hours
                  </Typography>
                </CardContent>
              </Card>
            </TabPanel>

            {/* Sales Performance Tab */}
            <TabPanel value={currentTab} index={1}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Sales Summary
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">Today's Sales:</Typography>
                        <Typography variant="h6" color="primary">
                          {stats ? formatCurrency(stats.todaySales) : '$0'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">This Month:</Typography>
                        <Typography variant="h6" color="success.main">
                          {stats ? formatCurrency(stats.monthSales) : '$0'}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">Daily Average:</Typography>
                        <Typography variant="h6">
                          {stats ? formatCurrency(stats.monthSales / new Date().getDate()) : '$0'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Inventory Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">Total Products:</Typography>
                        <Typography variant="h6">
                          {stats?.productCount || 0}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" color="warning.main">
                          Low Stock Items:
                        </Typography>
                        <Typography variant="h6" color="warning.main">
                          {stats?.lowStockCount || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </TabPanel>

            {/* Branch Information Tab */}
            <TabPanel value={currentTab} index={2}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Branch Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Address
                      </Typography>
                      <Typography variant="body1">
                        {branch.address || 'Not specified'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Manager
                      </Typography>
                      <Typography variant="body1">
                        {branch.managerName || 'Not assigned'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Phone
                      </Typography>
                      <Typography variant="body1">
                        {branch.phone || 'Not specified'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Email
                      </Typography>
                      <Typography variant="body1">
                        {branch.email || 'Not specified'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Timezone
                      </Typography>
                      <Typography variant="body1">
                        {branch.timezone}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Currency
                      </Typography>
                      <Typography variant="body1">
                        {branch.currency}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BranchStatsDialog;
