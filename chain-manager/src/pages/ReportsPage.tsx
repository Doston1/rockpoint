import {
  Assessment,
  AttachMoney,
  FileDownload,
  FilterList,
  Inventory2,
  People,
  Refresh,
  ShoppingCart,
  Store,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useBranches } from '../hooks/useBranches';
import { useReports } from '../hooks/useReports';

// Color palette for charts
const CHART_COLORS = ['#1976d2', '#dc004e', '#ed6c02', '#2e7d32', '#9c27b0', '#00695c', '#d84315'];

const ReportsPage = () => {
  const { t } = useTranslation();
  const { branches } = useBranches();
  
  const {
    dashboardStats,
    salesTrends,
    topProducts,
    categoryPerformance,
    employeePerformance,
    branchComparison,
    inventoryReport,
    financialSummary,
    isLoading,
    isLoadingDashboard,
    isLoadingTrends,
    isLoadingProducts,
    isLoadingCategories,
    isLoadingEmployees,
    isLoadingBranches,
    isLoadingInventory,
    isLoadingFinancial,
    error,
    refreshAll,
  } = useReports();

  // Filter states
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs().subtract(30, 'days'));
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Safe data with fallbacks
  const safeBranches = branches || [];
  const safeDashboardStats = dashboardStats || {
    total_revenue: 0,
    transaction_count: 0,
    low_stock_count: 0,
    employee_count: 0,
    branch_count: 0
  };
  const safeSalesTrends = salesTrends || [];
  const safeTopProducts = topProducts || [];
  const safeCategoryPerformance = categoryPerformance || [];
  const safeEmployeePerformance = employeePerformance || [];
  const safeBranchComparison = branchComparison || [];
  const safeInventoryReport = inventoryReport?.inventory_report || [];
  const safeInventorySummary = inventoryReport?.summary || {
    total_items: 0,
    total_value: 0,
    out_of_stock_count: 0,
    low_stock_count: 0,
    in_stock_count: 0
  };
  const safeFinancialSummary = financialSummary || {
    financial_summary: { total_revenue: 0, total_tax: 0, transaction_count: 0 },
    payment_methods: [],
    hourly_sales: []
  };

  // Apply filters
  const applyFilters = async () => {
    const filters = {
      startDate: startDate?.format('YYYY-MM-DD'),
      endDate: endDate?.format('YYYY-MM-DD'),
      branchId: selectedBranch || undefined,
      period,
    };

    await refreshAll(filters);
  };

  // Initial load
  useEffect(() => {
    applyFilters();
  }, []);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Overview cards data
  const overviewCards = [
    {
      title: t('reports.overview.totalRevenue'),
      value: formatCurrency(safeDashboardStats.total_revenue),
      icon: AttachMoney,
      color: 'primary',
      trend: '+12.5%'
    },
    {
      title: t('reports.overview.totalTransactions'),
      value: safeDashboardStats.transaction_count.toLocaleString(),
      icon: ShoppingCart,
      color: 'success',
      trend: '+8.2%'
    },
    {
      title: t('reports.overview.lowStockItems'),
      value: safeDashboardStats.low_stock_count.toString(),
      icon: Inventory2,
      color: 'warning',
      trend: '-2.1%'
    },
    {
      title: t('reports.overview.activeEmployees'),
      value: safeDashboardStats.employee_count.toString(),
      icon: People,
      color: 'info',
      trend: '+5.3%'
    },
  ];

  if (!selectedBranch && safeDashboardStats.branch_count) {
    overviewCards.push({
      title: t('reports.overview.activeBranches'),
      value: safeDashboardStats.branch_count.toString(),
      icon: Store,
      color: 'secondary',
      trend: '0%'
    });
  }

  // Column definitions for DataGrid tables
  const topProductsColumns: GridColDef[] = [
    { field: 'name', headerName: t('reports.topProducts.product'), flex: 1, minWidth: 200 },
    { field: 'sku', headerName: t('inventory.sku'), width: 120 },
    { 
      field: 'quantity_sold', 
      headerName: t('reports.topProducts.quantitySold'), 
      width: 130,
      type: 'number'
    },
    { 
      field: 'revenue', 
      headerName: t('reports.topProducts.revenue'), 
      width: 120,
      valueFormatter: (value) => formatCurrency(value)
    },
    { 
      field: 'order_count', 
      headerName: t('reports.topProducts.orders'), 
      width: 100,
      type: 'number'
    },
  ];

  const categoryColumns: GridColDef[] = [
    { field: 'name', headerName: t('reports.categories.category'), flex: 1, minWidth: 150 },
    { 
      field: 'quantity_sold', 
      headerName: t('reports.categories.quantitySold'), 
      width: 130,
      type: 'number'
    },
    { 
      field: 'revenue', 
      headerName: t('reports.categories.revenue'), 
      width: 120,
      valueFormatter: (value) => formatCurrency(value)
    },
    { 
      field: 'products_sold', 
      headerName: t('reports.categories.products'), 
      width: 100,
      type: 'number'
    },
    { 
      field: 'order_count', 
      headerName: t('reports.categories.orders'), 
      width: 100,
      type: 'number'
    },
  ];

  const employeeColumns: GridColDef[] = [
    { field: 'name', headerName: t('reports.employees.employee'), flex: 1, minWidth: 150 },
    { field: 'role', headerName: t('reports.employees.role'), width: 120 },
    { 
      field: 'total_sales', 
      headerName: t('reports.employees.sales'), 
      width: 120,
      valueFormatter: (value) => formatCurrency(value)
    },
    { 
      field: 'transaction_count', 
      headerName: t('reports.employees.transactions'), 
      width: 120,
      type: 'number'
    },
    { 
      field: 'average_sale', 
      headerName: t('reports.employees.averageSale'), 
      width: 120,
      valueFormatter: (value) => formatCurrency(value)
    },
    { field: 'branch_name', headerName: t('reports.employees.branch'), width: 150 },
  ];

  const branchColumns: GridColDef[] = [
    { field: 'name', headerName: t('reports.branches.branch'), flex: 1, minWidth: 150 },
    { field: 'code', headerName: t('reports.branches.code'), width: 100 },
    { 
      field: 'total_sales', 
      headerName: t('reports.branches.sales'), 
      width: 120,
      valueFormatter: (value) => formatCurrency(value)
    },
    { 
      field: 'transaction_count', 
      headerName: t('reports.branches.transactions'), 
      width: 120,
      type: 'number'
    },
    { 
      field: 'average_sale', 
      headerName: t('reports.branches.averageSale'), 
      width: 120,
      valueFormatter: (value) => formatCurrency(value)
    },
    { 
      field: 'employee_count', 
      headerName: t('reports.branches.employees'), 
      width: 100,
      type: 'number'
    },
  ];

  const inventoryColumns: GridColDef[] = [
    { field: 'name', headerName: t('reports.inventory.product'), flex: 1, minWidth: 200 },
    { field: 'sku', headerName: t('reports.inventory.sku'), width: 120 },
    { 
      field: 'quantity', 
      headerName: t('reports.inventory.quantity'), 
      width: 100,
      type: 'number'
    },
    { 
      field: 'inventory_value', 
      headerName: t('reports.inventory.value'), 
      width: 120,
      valueFormatter: (value) => formatCurrency(value)
    },
    { 
      field: 'stock_status', 
      headerName: t('reports.inventory.status'), 
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={
            params.value === 'out_of_stock' ? t('reports.inventory.outOfStock') :
            params.value === 'low_stock' ? t('reports.inventory.lowStock') : 
            t('reports.inventory.inStock')
          }
          color={
            params.value === 'out_of_stock' ? 'error' :
            params.value === 'low_stock' ? 'warning' : 'success'
          }
          size="small"
        />
      )
    },
  ];

  // Prepare chart data
  const trendsChartData = safeSalesTrends.map(trend => ({
    date: trend.period,
    revenue: trend.revenue,
    transactions: trend.transactions,
  }));

  const categoryChartData = safeCategoryPerformance.slice(0, 8).map((category, index) => ({
    name: category.name || 'Unknown',
    value: category.revenue,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));

  const paymentMethodsData = safeFinancialSummary.payment_methods.map((method, index) => ({
    name: method.method,
    value: method.amount,
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));

  const hourlySalesData = safeFinancialSummary.hourly_sales.map(hourly => ({
    hour: `${hourly.hour}:00`,
    sales: hourly.total_sales,
    transactions: hourly.transaction_count,
  }));

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Assessment sx={{ mr: 1, fontSize: 32 }} />
            <Box>
              <Typography variant="h4" fontWeight="bold">
                {t('reports.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('reports.subtitle')}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={applyFilters}
              disabled={isLoading}
            >
              {t('reports.refresh')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              disabled={isLoading}
            >
              {t('reports.export')}
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <FilterList sx={{ color: 'text.secondary' }} />
              <Typography variant="h6">{t('reports.filters')}</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box sx={{ minWidth: 200 }}>
                <DatePicker
                  label={t('common.startDate')}
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Box>
              <Box sx={{ minWidth: 200 }}>
                <DatePicker
                  label={t('common.endDate')}
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Box>
              <Box sx={{ minWidth: 200 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('reports.selectBranch')}</InputLabel>
                  <Select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    label={t('reports.selectBranch')}
                  >
                    <MenuItem value="">
                      <em>{t('reports.allBranches')}</em>
                    </MenuItem>
                    {safeBranches.map(branch => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ minWidth: 150 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('reports.period')}</InputLabel>
                  <Select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as 'daily' | 'weekly' | 'monthly')}
                    label={t('reports.period')}
                  >
                    <MenuItem value="daily">{t('reports.daily')}</MenuItem>
                    <MenuItem value="weekly">{t('reports.weekly')}</MenuItem>
                    <MenuItem value="monthly">{t('reports.monthly')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  onClick={applyFilters}
                  disabled={isLoading}
                  sx={{ height: '40px', minWidth: 140 }}
                >
                  {t('reports.actions.applyFilters')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Paper sx={{ mb: 2 }}>
          <Tabs value={selectedTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab label={t('reports.overview.title')} />
            <Tab label={t('reports.salesTrends.title')} />
            <Tab label={t('reports.topProducts.title')} />
            <Tab label={t('reports.categories.title')} />
            <Tab label={t('reports.employees.title')} />
            <Tab label={t('reports.branches.title')} />
            <Tab label={t('reports.inventory.title')} />
            <Tab label={t('reports.financial.title')} />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {selectedTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Overview Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
              {overviewCards.map((card, index) => (
                <Card key={index}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" color={`${card.color}.main`} fontWeight="bold">
                          {isLoadingDashboard ? <CircularProgress size={24} /> : card.value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {card.title}
                        </Typography>
                        <Chip 
                          label={card.trend} 
                          size="small" 
                          color={card.trend.startsWith('+') ? 'success' : 'error'}
                          sx={{ mt: 1 }}
                        />
                      </Box>
                      <card.icon sx={{ fontSize: 40, color: `${card.color}.main` }} />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>

            {/* Recent Trends Chart */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('reports.salesTrends.title')}
                  </Typography>
                  {isLoadingTrends ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={trendsChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value, name) => [
                          name === 'revenue' ? formatCurrency(value as number) : value,
                          name === 'revenue' ? t('reports.salesTrends.revenue') : t('reports.salesTrends.transactions')
                        ]} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#1976d2" name={t('reports.salesTrends.revenue')} />
                        <Line type="monotone" dataKey="transactions" stroke="#dc004e" name={t('reports.salesTrends.transactions')} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

            {/* Top Categories */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('reports.categories.title')}
                  </Typography>
                  {isLoadingCategories ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={(entry) => entry.name}
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}

        {selectedTab === 1 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('reports.salesTrends.title')}
              </Typography>
              {isLoadingTrends ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trendsChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [
                      name === 'revenue' ? formatCurrency(value as number) : value,
                      name === 'revenue' ? t('reports.salesTrends.revenue') : t('reports.salesTrends.transactions')
                    ]} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#1976d2" strokeWidth={2} name={t('reports.salesTrends.revenue')} />
                    <Line type="monotone" dataKey="transactions" stroke="#dc004e" strokeWidth={2} name={t('reports.salesTrends.transactions')} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {selectedTab === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('reports.topProducts.title')}
              </Typography>
              <DataGrid
                rows={safeTopProducts.map((product, index) => ({ ...product, id: product.id || index }))}
                columns={topProductsColumns}
                loading={isLoadingProducts}
                pageSizeOptions={[25, 50, 100]}
                disableRowSelectionOnClick
                sx={{ height: 600 }}
                localeText={{
                  noRowsLabel: t('reports.noData'),
                }}
              />
            </CardContent>
          </Card>
        )}

        {selectedTab === 3 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('reports.categories.title')}
              </Typography>
              <DataGrid
                rows={safeCategoryPerformance.map((category, index) => ({ ...category, id: category.id || index }))}
                columns={categoryColumns}
                loading={isLoadingCategories}
                pageSizeOptions={[25, 50, 100]}
                disableRowSelectionOnClick
                sx={{ height: 600 }}
                localeText={{
                  noRowsLabel: t('reports.noData'),
                }}
              />
            </CardContent>
          </Card>
        )}

        {selectedTab === 4 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('reports.employees.title')}
              </Typography>
              <DataGrid
                rows={safeEmployeePerformance.map((employee, index) => ({ ...employee, id: employee.id || index }))}
                columns={employeeColumns}
                loading={isLoadingEmployees}
                pageSizeOptions={[25, 50, 100]}
                disableRowSelectionOnClick
                sx={{ height: 600 }}
                localeText={{
                  noRowsLabel: t('reports.noData'),
                }}
              />
            </CardContent>
          </Card>
        )}

        {selectedTab === 5 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('reports.branches.title')}
              </Typography>
              <DataGrid
                rows={safeBranchComparison.map((branch, index) => ({ ...branch, id: branch.id || index }))}
                columns={branchColumns}
                loading={isLoadingBranches}
                pageSizeOptions={[25, 50, 100]}
                disableRowSelectionOnClick
                sx={{ height: 600 }}
                localeText={{
                  noRowsLabel: t('reports.noData'),
                }}
              />
            </CardContent>
          </Card>
        )}

        {selectedTab === 6 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Inventory Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {isLoadingInventory ? <CircularProgress size={20} /> : safeInventorySummary.total_items}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.inventory.totalItems')}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="success.main" fontWeight="bold">
                      {isLoadingInventory ? <CircularProgress size={20} /> : formatCurrency(safeInventorySummary.total_value)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.inventory.totalValue')}
                    </Typography>
                  </CardContent>
                  </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="error" fontWeight="bold">
                      {isLoadingInventory ? <CircularProgress size={20} /> : safeInventorySummary.out_of_stock_count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.inventory.outOfStock')}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="warning.main" fontWeight="bold">
                      {isLoadingInventory ? <CircularProgress size={20} /> : safeInventorySummary.low_stock_count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.inventory.lowStock')}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="success.main" fontWeight="bold">
                      {isLoadingInventory ? <CircularProgress size={20} /> : safeInventorySummary.in_stock_count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.inventory.inStock')}
                    </Typography>
                  </CardContent>
                  </Card>
            </Box>

            {/* Inventory Table */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('reports.inventory.title')}
                  </Typography>
                  <DataGrid
                    rows={safeInventoryReport.map((item: any, index: any) => ({ ...item, id: item.id || index }))}
                    columns={inventoryColumns}
                    loading={isLoadingInventory}
                    pageSizeOptions={[25, 50, 100]}
                    disableRowSelectionOnClick
                    sx={{ height: 600 }}
                    localeText={{
                      noRowsLabel: t('reports.noData'),
                    }}
                  />
                </CardContent>
              </Card>
          </Box>
        )}

        {selectedTab === 7 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Financial Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="primary" fontWeight="bold">
                      {isLoadingFinancial ? <CircularProgress size={20} /> : formatCurrency(safeFinancialSummary.financial_summary.total_revenue)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.financial.totalRevenue')}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="secondary" fontWeight="bold">
                      {isLoadingFinancial ? <CircularProgress size={20} /> : formatCurrency(safeFinancialSummary.financial_summary.total_tax)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.financial.totalTax')}
                    </Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h5" color="info.main" fontWeight="bold">
                      {isLoadingFinancial ? <CircularProgress size={20} /> : safeFinancialSummary.financial_summary.transaction_count.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('reports.financial.transactionCount')}
                      </Typography>
                    </CardContent>
                  </Card>
            </Box>

            {/* Payment Methods Chart */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('reports.financial.paymentMethods')}
                  </Typography>
                  {isLoadingFinancial ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={paymentMethodsData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={(entry) => entry.name}
                        >
                          {paymentMethodsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

            {/* Hourly Sales Pattern */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('reports.financial.hourlySales')}
                  </Typography>
                  {isLoadingFinancial ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={hourlySalesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip formatter={(value, name) => [
                          name === 'sales' ? formatCurrency(value as number) : value,
                          name === 'sales' ? 'Sales' : 'Transactions'
                        ]} />
                        <Bar dataKey="sales" fill="#1976d2" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}
      </Container>
    </LocalizationProvider>
  );
};

export default ReportsPage;
