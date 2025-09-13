import {
  AccessTime,
  Add,
  Delete,
  Edit,
  Key,
  People as PeopleIcon,
  Search,
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
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationBar } from '../components/NavigationBar';
import { useAuth } from '../hooks/useAuth';
import { useEmployees, type CreateEmployeeData, type Employee, type UpdateEmployeeData } from '../hooks/useEmployees';

interface EmployeeFormData {
  employee_id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'supervisor';
  pin: string;
  hire_date: string;
  status: 'active' | 'inactive' | 'suspended';
}

const EmployeesPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const {
    employees,
    selectedEmployee,
    employeeSchedule,
    todayHours,
    error,
    clearError,
    getAllEmployees,
    getEmployee,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    changeEmployeePassword,
    getEmployeeSchedule,
    getTodayHours,
  } = useEmployees();

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
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState<EmployeeFormData>({
    employee_id: '',
    name: '',
    role: 'cashier',
    pin: '',
    hire_date: new Date().toISOString().split('T')[0],
    status: 'active',
  });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [passwordEmployee, setPasswordEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  // Check if user has access (admin or manager only)
  const hasAccess = user?.role === 'admin' || user?.role === 'manager';

  // Load employees on component mount
  useEffect(() => {
    if (hasAccess) {
      getAllEmployees();
    }
  }, [getAllEmployees, hasAccess]);

  // Filter employees
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
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
      employee_id: '',
      name: '',
      role: 'cashier',
      pin: '',
      hire_date: new Date().toISOString().split('T')[0],
      status: 'active',
    });
  };

  const handleAddEmployee = async () => {
    try {
      const result = await createEmployee(formData as CreateEmployeeData);
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.employeeAddedSuccess'),
          severity: 'success',
        });
        setAddDialogOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating employee:', error);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      employee_id: employee.employee_id,
      name: employee.name,
      role: employee.role,
      pin: '', // Don't show existing PIN
      hire_date: employee.hire_date,
      status: employee.status,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;

    const updateData: UpdateEmployeeData = {
      name: formData.name,
      role: formData.role,
      status: formData.status,
      hire_date: formData.hire_date,
    };

    try {
      const result = await updateEmployee(editingEmployee.id, updateData);
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.employeeUpdatedSuccess'),
          severity: 'success',
        });
        setEditDialogOpen(false);
        setEditingEmployee(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  const handleViewDetails = async (employee: Employee) => {
    await getEmployee(employee.id);
    await getTodayHours(employee.employee_id);
    await getEmployeeSchedule(employee.employee_id,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
      new Date().toISOString().split('T')[0]
    );
    setDetailsDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!passwordEmployee) return;

    if (newPassword !== confirmPassword) {
      setSnackbar({
        open: true,
        message: 'Passwords do not match',
        severity: 'error',
      });
      return;
    }

    if (newPassword.length < 4) {
      setSnackbar({
        open: true,
        message: 'Password must be at least 4 characters',
        severity: 'error',
      });
      return;
    }

    try {
      const result = await changeEmployeePassword(passwordEmployee.id, newPassword);
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.passwordChangedSuccess'),
          severity: 'success',
        });
        setPasswordDialogOpen(false);
        setPasswordEmployee(null);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error('Error changing password:', error);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      const result = await deleteEmployee(employeeToDelete.id);
      if (result) {
        setSnackbar({
          open: true,
          message: t('employees.employeeDeletedSuccess'),
          severity: 'success',
        });
        setDeleteDialogOpen(false);
        setEmployeeToDelete(null);
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
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  // Restrict access
  if (!hasAccess) {
    return (
      <>
        <NavigationBar />
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">
            {t('employees.accessDenied')}
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <NavigationBar />

      <Container maxWidth={false} sx={{ mt: 2, mb: 2, px: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <PeopleIcon sx={{ mr: 1, fontSize: 32 }} />
              <Typography variant="h4" fontWeight="bold">
                {t('employees.employeeManagement')}
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
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 2,
              mb: 3,
            }}
          >
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('employees.totalEmployees')}
                </Typography>
                <Typography variant="h4">
                  {employees.length}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('employees.active')}
                </Typography>
                <Typography variant="h4" color="success.main">
                  {employees.filter(e => e.status === 'active').length}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('employees.managers')}
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {employees.filter(e => e.role === 'manager' || e.role === 'admin').length}
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {t('employees.cashiers')}
                </Typography>
                <Typography variant="h4" color="info.main">
                  {employees.filter(e => e.role === 'cashier' || e.role === 'supervisor').length}
                </Typography>
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
          <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
            <TextField
              label={t('employees.searchEmployees')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
              }}
            />

            <FormControl size="small" sx={{ minWidth: 120 }}>
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

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t('employees.status')}</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label={t('employees.status')}
              >
                <MenuItem value="all">{t('employees.allStatus')}</MenuItem>
                <MenuItem value="active">{t('employees.active')}</MenuItem>
                <MenuItem value="inactive">{t('employees.inactive')}</MenuItem>
                <MenuItem value="suspended">{t('employees.suspended')}</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              Showing {filteredEmployees.length} employees
            </Typography>
          </Box>
        </Paper>

        {/* Employees Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('employees.employee')}</TableCell>
                <TableCell>{t('employees.role')}</TableCell>
                <TableCell>{t('employees.status')}</TableCell>
                <TableCell>{t('employees.hireDate')}</TableCell>
                <TableCell>{t('employees.lastLogin')}</TableCell>
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
                        ID: {employee.employee_id}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
                      color={getRoleColor(employee.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                      color={getStatusColor(employee.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(employee.hire_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {employee.last_login
                      ? new Date(employee.last_login).toLocaleDateString()
                      : 'Never'
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
                      <Tooltip title={t('employees.changePassword')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setPasswordEmployee(employee);
                            setPasswordDialogOpen(true);
                          }}
                        >
                          <Key />
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
          />
        </TableContainer>

        {/* Add Employee Dialog */}
        <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{t('employees.addNewEmployee')}</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(1, 1fr)',
                  md: 'repeat(2, 1fr)',
                },
                gap: 2,
                mt: 1,
              }}
            >
              <TextField
                fullWidth
                label={t('employees.employeeId')}
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                required
              />

              <TextField
                fullWidth
                label={t('employees.fullName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <FormControl fullWidth>
                <InputLabel>{t('employees.role')}</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  label={t('employees.role')}
                >
                  <MenuItem value="cashier">{t('employees.cashier')}</MenuItem>
                  <MenuItem value="supervisor">{t('employees.supervisor')}</MenuItem>
                  <MenuItem value="manager">{t('employees.manager')}</MenuItem>
                  {user?.role === 'admin' && <MenuItem value="admin">{t('employees.admin')}</MenuItem>}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label={t('employees.pin')}
                type="password"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                helperText={t('employees.minimumCharacters')}
                required
              />

              <TextField
                fullWidth
                label={t('employees.hireDate')}
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />

              <FormControl fullWidth>
                <InputLabel>{t('employees.status')}</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  label={t('employees.status')}
                >
                  <MenuItem value="active">{t('employees.active')}</MenuItem>
                  <MenuItem value="inactive">{t('employees.inactive')}</MenuItem>
                  <MenuItem value="suspended">{t('employees.suspended')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleAddEmployee}
              variant="contained"
              disabled={!formData.employee_id || !formData.name || !formData.pin}
            >
              {t('common.add')} {t('employees.employee')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Employee Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{t('employees.editEmployee')}</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(1, 1fr)',
                  md: 'repeat(2, 1fr)',
                },
                gap: 2,
                mt: 1,
              }}
            >
              <TextField
                fullWidth
                label="Employee ID"
                value={formData.employee_id}
                disabled
                helperText={t('employees.employeeIdCannotChange')}
              />

              <TextField
                fullWidth
                label={t('employees.fullName')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <FormControl fullWidth>
                <InputLabel>{t('employees.role')}</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  label={t('employees.role')}
                >
                  <MenuItem value="cashier">{t('employees.cashier')}</MenuItem>
                  <MenuItem value="supervisor">{t('employees.supervisor')}</MenuItem>
                  <MenuItem value="manager">{t('employees.manager')}</MenuItem>
                  {user?.role === 'admin' && <MenuItem value="admin">{t('employees.admin')}</MenuItem>}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label={t('employees.hireDate')}
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />

              <FormControl fullWidth>
                <InputLabel>{t('employees.status')}</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  label={t('employees.status')}
                >
                  <MenuItem value="active">{t('employees.active')}</MenuItem>
                  <MenuItem value="inactive">{t('employees.inactive')}</MenuItem>
                  <MenuItem value="suspended">{t('employees.suspended')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleUpdateEmployee}
              variant="contained"
              disabled={!formData.name}
            >
              {t('employees.updateEmployee')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Employee Details Dialog */}
        <Dialog
          open={detailsDialogOpen}
          onClose={() => setDetailsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{t('employees.employeeDetails')}</DialogTitle>
          <DialogContent>
            {selectedEmployee && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="h6" gutterBottom>
                  {selectedEmployee.name}
                </Typography>

                <Box display="flex" gap={2} mb={3}>
                  <Chip label={`ID: ${selectedEmployee.employee_id}`} />
                  <Chip
                    label={selectedEmployee.role.charAt(0).toUpperCase() + selectedEmployee.role.slice(1)}
                    color={getRoleColor(selectedEmployee.role)}
                  />
                  <Chip
                    label={selectedEmployee.status.charAt(0).toUpperCase() + selectedEmployee.status.slice(1)}
                    color={getStatusColor(selectedEmployee.status)}
                  />
                </Box>

                <Box display="flex" gap={4} mb={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('employees.hireDate')}
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedEmployee.hire_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('employees.lastLogin')}
                    </Typography>
                    <Typography variant="body1">
                      {selectedEmployee.last_login
                        ? new Date(selectedEmployee.last_login).toLocaleString()
                        : t('employees.never')
                      }
                    </Typography>
                  </Box>
                </Box>

                {/* Today's Hours */}
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                  <Typography variant="h6" gutterBottom>
                    {t('employees.todayWorkHours')}
                  </Typography>
                  {todayHours ? (
                    <Box>
                      <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <AccessTime />
                        <Typography>
                          {t('employees.clockIn')}: {new Date(todayHours.clock_in).toLocaleTimeString()}
                        </Typography>
                        {todayHours.is_clocked_in && (
                          <Chip label={t('employees.currentlyWorking')} color="success" size="small" />
                        )}
                      </Box>
                      {todayHours.clock_out && (
                        <Box display="flex" alignItems="center" gap={2} mb={1}>
                          <AccessTime />
                          <Typography>
                            {t('employees.clockOut')}: {new Date(todayHours.clock_out).toLocaleTimeString()}
                          </Typography>
                        </Box>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {t('employees.hoursWorked')}: {todayHours.hours_worked?.toFixed(2) || '0.00'} {t('employees.hours')}
                      </Typography>
                      {todayHours.notes && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          {t('employees.notes')}: {todayHours.notes}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography color="text.secondary">
                      {t('employees.noWorkHours')}
                    </Typography>
                  )}
                </Paper>

                {/* Recent Schedule */}
                <Typography variant="h6" gutterBottom>
                  {t('employees.recentSchedule')}
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('employees.date')}</TableCell>
                        <TableCell>{t('employees.clockIn')}</TableCell>
                        <TableCell>{t('employees.clockOut')}</TableCell>
                        <TableCell>{t('employees.hoursWorked')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {employeeSchedule.length > 0 ? (
                        employeeSchedule.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {new Date(log.clock_in).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {new Date(log.clock_in).toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              {log.clock_out
                                ? new Date(log.clock_out).toLocaleTimeString()
                                : t('employees.stillWorking')
                              }
                            </TableCell>
                            <TableCell>
                              {log.hours_worked?.toFixed(2) || '0.00'}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            {t('employees.noScheduleData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsDialogOpen(false)}>{t('close')}</Button>
          </DialogActions>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('employees.changeEmployeePassword')}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('employees.changingPasswordFor', { name: passwordEmployee?.name })}
            </Typography>
            <TextField
              fullWidth
              label={t('employees.newPin')}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText={t('employees.minimumCharacters')}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label={t('employees.confirmPin')}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPassword !== '' && newPassword !== confirmPassword}
              helperText={confirmPassword !== '' && newPassword !== confirmPassword ? t('employees.pinsDoNotMatch') : ''}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialogOpen(false)}>{t('employees.cancel')}</Button>
            <Button
              onClick={handleChangePassword}
              variant="contained"
              disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {t('employees.changePassword')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>{t('employees.deleteEmployee')}</DialogTitle>
          <DialogContent>
            <Typography>
              {t('employees.deleteEmployeeConfirm', { name: employeeToDelete?.name })}
            </Typography>
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t('employees.employeeDeleteWarning')}
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>{t('employees.cancel')}</Button>
            <Button onClick={handleDeleteEmployee} color="error" variant="contained">
              {t('employees.delete')}
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
    </>
  );
};

export default EmployeesPage;