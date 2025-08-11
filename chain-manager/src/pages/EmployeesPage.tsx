import {
    Add,
    Business,
    Delete,
    Edit,
    Group,
    People,
    PersonAdd,
    Search,
    SwapHoriz,
    TrendingUp,
    Visibility,
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
    InputLabel,
    LinearProgress,
    MenuItem,
    Paper,
    Select,
    Snackbar,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBranches } from '../hooks/useBranches';
import { useEmployees } from '../hooks/useEmployees';
import type { Employee } from '../services/api';

interface EmployeeFormData {
  employeeId: string;
  branchId: string;
  name: string;
  role: Employee['role'];
  phone: string;
  email: string;
  hireDate: string;
  salary: number;
  status: Employee['status'];
}

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
      id={`employee-tabpanel-${index}`}
      aria-labelledby={`employee-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const EmployeesPage = () => {
  const { t } = useTranslation();
  const { branches } = useBranches();
  
  // State for selected branch filter
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  
  // Use employees hook with branch filter
  const {
    employees,
    isLoading,
    error,
    refetch,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeTimeLogs,
    getEmployeeStats,
    clearError,
  } = useEmployees({ branchId: selectedBranchId === 'all' ? undefined : selectedBranchId });

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState<EmployeeFormData>({
    employeeId: '',
    branchId: '',
    name: '',
    role: 'cashier',
    phone: '',
    email: '',
    hireDate: new Date().toISOString().split('T')[0],
    salary: 0,
    status: 'active',
  });

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeToTransfer, setEmployeeToTransfer] = useState<Employee | null>(null);
  const [newBranchId, setNewBranchId] = useState('');
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [employeeTimeRecords, setEmployeeTimeRecords] = useState<any[]>([]);
  const [employeeStats, setEmployeeStats] = useState<any>(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  // Filter employees
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Paginated employees
  const paginatedEmployees = filteredEmployees.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const resetForm = () => {
    setFormData({
      employeeId: '',
      branchId: '',
      name: '',
      role: 'cashier',
      phone: '',
      email: '',
      hireDate: new Date().toISOString().split('T')[0],
      salary: 0,
      status: 'active',
    });
  };

  const handleAddEmployee = async () => {
    try {
      const employeeData = {
        ...formData,
        hireDate: formData.hireDate ? new Date(formData.hireDate) : undefined,
      };
      const result = await createEmployee(employeeData);
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.employeeCreated'),
          severity: 'success',
        });
        setAddDialogOpen(false);
        resetForm();
        refetch();
      }
    } catch (error) {
      console.error('Error creating employee:', error);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employeeId: employee.employeeId,
      branchId: employee.branchId,
      name: employee.name,
      role: employee.role,
      phone: employee.phone || '',
      email: employee.email || '',
      hireDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
      salary: employee.salary || 0,
      status: employee.status,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;

    try {
      const employeeData = {
        ...formData,
        hireDate: formData.hireDate ? new Date(formData.hireDate) : undefined,
      };
      const result = await updateEmployee(editingEmployee.id, employeeData);
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.employeeUpdated'),
          severity: 'success',
        });
        setEditDialogOpen(false);
        setEditingEmployee(null);
        resetForm();
        refetch();
      }
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  const handleViewDetails = async (employee: Employee) => {
    setEditingEmployee(employee);
    
    // Get time records for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    
    try {
      // Fetch employee details, time records and stats in parallel
      const [, timeRecords, stats] = await Promise.all([
        getEmployee(employee.id),
        getEmployeeTimeLogs(employee.id, startOfMonth, endOfMonth),
        getEmployeeStats(employee.id, (now.getMonth() + 1).toString(), now.getFullYear().toString())
      ]);
      
      setEmployeeTimeRecords(timeRecords);
      setEmployeeStats(stats);
    } catch (error) {
      console.error('Error fetching employee details:', error);
      setSnackbar({
        open: true,
        message: t('employees.errorLoadingDetails'),
        severity: 'error',
      });
    }
    
    setDetailsDialogOpen(true);
  };

  const handleTransferEmployee = (employee: Employee) => {
    setEmployeeToTransfer(employee);
    setNewBranchId('');
    setTransferDialogOpen(true);
  };

  const handleConfirmTransfer = async () => {
    if (!employeeToTransfer || !newBranchId) return;

    try {
      const result = await updateEmployee(employeeToTransfer.id, { branchId: newBranchId });
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.branchTransferred'),
          severity: 'success',
        });
        setTransferDialogOpen(false);
        setEmployeeToTransfer(null);
        setNewBranchId('');
        refetch();
      }
    } catch (error) {
      console.error('Error transferring employee:', error);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      const result = await deleteEmployee(employeeToDelete.id);
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.employeeDeleted'),
          severity: 'success',
        });
        setDeleteDialogOpen(false);
        setEmployeeToDelete(null);
        refetch();
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      case 'supervisor': return 'info';
      case 'cashier': return 'success';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'terminated': return 'error';
      default: return 'default';
    }
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : 'Unknown';
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <Group sx={{ mr: 1, fontSize: 32 }} />
            <Typography variant="h4" fontWeight="bold">
              {t('employees.title')}
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddDialogOpen(true)}
            size="large"
          >
            {t('employees.addEmployee')}
          </Button>
        </Box>

        {/* Stats Cards */}
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 3,
            mb: 3 
          }}
        >
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <People sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    {t('employees.totalEmployees')}
                  </Typography>
                  <Typography variant="h4">
                    {employees.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    {t('employees.activeEmployees')}
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {employees.filter(e => e.status === 'active').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PersonAdd sx={{ mr: 1, color: 'warning.main' }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    {t('employees.managers')}
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {employees.filter(e => e.role === 'manager' || e.role === 'admin').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Business sx={{ mr: 1, color: 'info.main' }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    {t('employees.cashiers')}
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {employees.filter(e => e.role === 'cashier' || e.role === 'supervisor').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: 'repeat(2, 1fr)', 
              md: 'repeat(5, 1fr)' 
            },
            gap: 2,
            alignItems: 'center'
          }}
        >
          <FormControl fullWidth size="small">
            <InputLabel>{t('employees.selectBranch')}</InputLabel>
            <Select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              label={t('employees.selectBranch')}
              startAdornment={<Business sx={{ mr: 1, color: 'action.active' }} />}
            >
              <MenuItem value="all">{t('employees.allBranches')}</MenuItem>
              {branches.map((branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            label={t('employees.searchEmployees')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
            }}
          />
          
          <FormControl fullWidth size="small">
            <InputLabel>{t('employees.role')}</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              label={t('employees.role')}
            >
              <MenuItem value="all">{t('employees.allRoles')}</MenuItem>
              <MenuItem value="admin">{t('employees.admin')}</MenuItem>
              <MenuItem value="manager">{t('employees.manager')}</MenuItem>
              <MenuItem value="supervisor">{t('employees.supervisor')}</MenuItem>
              <MenuItem value="cashier">{t('employees.cashier')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>{t('employees.status')}</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label={t('employees.status')}
            >
              <MenuItem value="all">{t('employees.allStatuses')}</MenuItem>
              <MenuItem value="active">{t('employees.active')}</MenuItem>
              <MenuItem value="inactive">{t('employees.inactive')}</MenuItem>
              <MenuItem value="terminated">{t('employees.terminated')}</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary">
            {t('employees.showingEmployees', { count: filteredEmployees.length })}
          </Typography>
        </Box>
      </Paper>

      {/* Loading */}
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Employees Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('employees.employee')}</TableCell>
              <TableCell>{t('employees.branch')}</TableCell>
              <TableCell>{t('employees.role')}</TableCell>
              <TableCell>{t('employees.status')}</TableCell>
              <TableCell>{t('employees.salary')}</TableCell>
              <TableCell>{t('employees.hireDate')}</TableCell>
              <TableCell align="center">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedEmployees.map((employee) => (
              <TableRow key={employee.id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {employee.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {employee.employeeId}
                    </Typography>
                    {employee.email && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {employee.email}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {getBranchName(employee.branchId)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={t(`employees.${employee.role}`)} 
                    color={getRoleColor(employee.role)} 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={t(`employees.${employee.status}`)} 
                    color={getStatusColor(employee.status)} 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  {employee.salary 
                    ? `$${employee.salary.toLocaleString()}`
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  {employee.hireDate 
                    ? new Date(employee.hireDate).toLocaleDateString()
                    : '-'
                  }
                </TableCell>
                <TableCell align="center">
                  <Box display="flex" gap={1} justifyContent="center">
                    <Tooltip title={t('employees.viewDetails')}>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(employee)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('employees.editEmployee')}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditEmployee(employee)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('employees.changeBranch')}>
                      <IconButton
                        size="small"
                        onClick={() => handleTransferEmployee(employee)}
                        color="primary"
                      >
                        <SwapHoriz />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('employees.deleteEmployee')}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setEmployeeToDelete(employee);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredEmployees.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage={t('common.rowsPerPage')}
        />
      </TableContainer>

      {/* Add Employee Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('employees.addNewEmployee')}</DialogTitle>
        <DialogContent>
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
              mt: 1
            }}
          >
            <TextField
              fullWidth
              label={t('employees.employeeId')}
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              required
            />
            
            <TextField
              fullWidth
              label={t('employees.name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            
            <FormControl fullWidth required>
              <InputLabel>{t('employees.branch')}</InputLabel>
              <Select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                label={t('employees.branch')}
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>{t('employees.role')}</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as Employee['role'] })}
                label={t('employees.role')}
              >
                <MenuItem value="cashier">{t('employees.cashier')}</MenuItem>
                <MenuItem value="supervisor">{t('employees.supervisor')}</MenuItem>
                <MenuItem value="manager">{t('employees.manager')}</MenuItem>
                <MenuItem value="admin">{t('employees.admin')}</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label={t('employees.phone')}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            
            <TextField
              fullWidth
              label={t('employees.email')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            
            <TextField
              fullWidth
              label={t('employees.salary')}
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
              InputProps={{ startAdornment: '$' }}
            />
            
            <TextField
              fullWidth
              label={t('employees.hireDate')}
              type="date"
              value={formData.hireDate}
              onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleAddEmployee} 
            variant="contained"
            disabled={!formData.employeeId || !formData.name || !formData.branchId}
          >
            {t('employees.addEmployee')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('employees.editEmployeeDetails')}</DialogTitle>
        <DialogContent>
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
              mt: 1
            }}
          >
            <TextField
              fullWidth
              label={t('employees.employeeId')}
              value={formData.employeeId}
              disabled
            />
            
            <TextField
              fullWidth
              label={t('employees.name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            
            <FormControl fullWidth>
              <InputLabel>{t('employees.role')}</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as Employee['role'] })}
                label={t('employees.role')}
              >
                <MenuItem value="cashier">{t('employees.cashier')}</MenuItem>
                <MenuItem value="supervisor">{t('employees.supervisor')}</MenuItem>
                <MenuItem value="manager">{t('employees.manager')}</MenuItem>
                <MenuItem value="admin">{t('employees.admin')}</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>{t('employees.status')}</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Employee['status'] })}
                label={t('employees.status')}
              >
                <MenuItem value="active">{t('employees.active')}</MenuItem>
                <MenuItem value="inactive">{t('employees.inactive')}</MenuItem>
                <MenuItem value="terminated">{t('employees.terminated')}</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label={t('employees.phone')}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            
            <TextField
              fullWidth
              label={t('employees.email')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            
            <TextField
              fullWidth
              label={t('employees.salary')}
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
              InputProps={{ startAdornment: '$' }}
            />
            
            <TextField
              fullWidth
              label={t('employees.hireDate')}
              type="date"
              value={formData.hireDate}
              onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleUpdateEmployee} 
            variant="contained"
            disabled={!formData.name}
          >
            {t('employees.editEmployee')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Employee Details Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onClose={() => setDetailsDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>{t('employees.employeeDetails')}</DialogTitle>
        <DialogContent>
          {editingEmployee && (
            <Box>
              <Tabs value={selectedTabIndex} onChange={(_, newValue) => setSelectedTabIndex(newValue)}>
                <Tab label={t('employees.basicInformation')} />
                <Tab label={t('employees.timeTracking')} />
              </Tabs>

              <TabPanel value={selectedTabIndex} index={0}>
                <Box 
                  sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                    gap: 3
                  }}
                >
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {t('employees.basicInformation')}
                      </Typography>
                      <Box display="flex" flexDirection="column" gap={2}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.name')}
                          </Typography>
                          <Typography variant="h6">{editingEmployee.name}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.employeeId')}
                          </Typography>
                          <Typography>{editingEmployee.employeeId}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.email')}
                          </Typography>
                          <Typography>{editingEmployee.email || '-'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.phone')}
                          </Typography>
                          <Typography>{editingEmployee.phone || '-'}</Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {t('employees.workInformation')}
                      </Typography>
                      <Box display="flex" flexDirection="column" gap={2}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.branch')}
                          </Typography>
                          <Typography>{getBranchName(editingEmployee.branchId)}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.role')}
                          </Typography>
                          <Chip 
                            label={t(`employees.${editingEmployee.role}`)} 
                            color={getRoleColor(editingEmployee.role)} 
                          />
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.status')}
                          </Typography>
                          <Chip 
                            label={t(`employees.${editingEmployee.status}`)} 
                            color={getStatusColor(editingEmployee.status)} 
                          />
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.salary')}
                          </Typography>
                          <Typography>
                            {editingEmployee.salary 
                              ? `$${editingEmployee.salary.toLocaleString()}`
                              : '-'
                            }
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {t('employees.hireDate')}
                          </Typography>
                          <Typography>
                            {editingEmployee.hireDate 
                              ? new Date(editingEmployee.hireDate).toLocaleDateString()
                              : '-'
                            }
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </TabPanel>

              <TabPanel value={selectedTabIndex} index={1}>
                {/* Monthly Stats */}
                {employeeStats && (
                  <Box 
                    sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                      gap: 3,
                      mb: 3
                    }}
                  >
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          {t('employees.totalHours')}
                        </Typography>
                        <Typography variant="h4">
                          {employeeStats.totalHours?.toFixed(1) || '0.0'}
                        </Typography>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          {t('employees.workingDays')}
                        </Typography>
                        <Typography variant="h4">
                          {employeeStats.workingDays || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          {t('employees.avgHoursPerDay')}
                        </Typography>
                        <Typography variant="h4">
                          {employeeStats.avgHoursPerDay?.toFixed(1) || '0.0'}
                        </Typography>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          {t('employees.overtime')}
                        </Typography>
                        <Typography variant="h4">
                          {employeeStats.overtimeHours?.toFixed(1) || '0.0'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Box>
                )}

                {/* Time Records Table */}
                <Typography variant="h6" gutterBottom>
                  {t('employees.timeRecords')} - {t('employees.thisMonth')}
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('employees.date')}</TableCell>
                        <TableCell>{t('employees.clockIn')}</TableCell>
                        <TableCell>{t('employees.clockOut')}</TableCell>
                        <TableCell>{t('employees.hoursWorked')}</TableCell>
                        <TableCell>{t('employees.notes')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {employeeTimeRecords.length > 0 ? (
                        employeeTimeRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {new Date(record.clock_in).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {new Date(record.clock_in).toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              {record.clock_out 
                                ? new Date(record.clock_out).toLocaleTimeString()
                                : t('employees.stillWorking')
                              }
                            </TableCell>
                            <TableCell>
                              {record.hours_worked?.toFixed(2) || '0.00'}
                            </TableCell>
                            <TableCell>
                              {record.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            {t('employees.noTimeRecords')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Employee Dialog */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('employees.changeBranch')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {employeeToTransfer && t('employees.confirmBranchChange')}
          </Typography>
          
          {employeeToTransfer && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">
                {t('employees.employee')}: {employeeToTransfer.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('employees.currentBranch')}: {getBranchName(employeeToTransfer.branchId)}
              </Typography>
            </Box>
          )}
          
          <FormControl fullWidth>
            <InputLabel>{t('employees.selectNewBranch')}</InputLabel>
            <Select
              value={newBranchId}
              onChange={(e) => setNewBranchId(e.target.value)}
              label={t('employees.selectNewBranch')}
            >
              {branches
                .filter(branch => branch.id !== employeeToTransfer?.branchId)
                .map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleConfirmTransfer} 
            variant="contained"
            disabled={!newBranchId}
          >
            {t('employees.transferEmployee')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('employees.deleteEmployee')}</DialogTitle>
        <DialogContent>
          <Typography>
            {employeeToDelete && t('employees.deleteEmployeeConfirm')}
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('employees.permanentDeleteWarning')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteEmployee} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default EmployeesPage;
