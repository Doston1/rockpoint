import {
  Add,
  AttachMoney,
  BarChart,
  Business,
  Cancel,
  CheckCircle,
  Delete,
  Edit,
  Group,
  LocationOn,
  MoreVert,
  Phone,
  Refresh,
  Search,
  Store,
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
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  MenuItem as MenuListItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import BranchDialog from '../components/common/BranchDialog';
import BranchStatsDialog from '../components/common/BranchStatsDialog';
import { useBranches } from '../hooks/useBranches';
import { useDashboard } from '../hooks/useDashboard';
import { Branch } from '../services/api';

interface BranchCardProps {
  branch: Branch;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onViewStats: (branch: Branch) => void;
}

const BranchCard: React.FC<BranchCardProps> = ({ branch, onEdit, onDelete, onViewStats }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCardClick = () => {
    navigate(`/branches/${branch.id}`);
  };

  const getStatusChip = (isActive: boolean) => {
    if (isActive) {
      return (
        <Chip
          icon={<CheckCircle />}
          label={t('branches.active')}
          color="success"
          size="small"
        />
      );
    }
    return (
      <Chip
        icon={<Cancel />}
        label={t('branches.inactive')}
        color="error"
        size="small"
      />
    );
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => theme.shadows[8],
        }
      }}
      onClick={handleCardClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold" noWrap>
            {branch.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusChip(branch.isActive)}
            <IconButton
              size="small"
              onClick={handleMenuClick}
            >
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuListItem onClick={() => { onViewStats(branch); handleMenuClose(); }}>
            <BarChart sx={{ mr: 1 }} fontSize="small" />
            {t('branches.viewStats')}
          </MenuListItem>
          <MenuListItem onClick={() => { onEdit(branch); handleMenuClose(); }}>
            <Edit sx={{ mr: 1 }} fontSize="small" />
            {t('common.edit')}
          </MenuListItem>
          <MenuListItem onClick={() => { onDelete(branch); handleMenuClose(); }} sx={{ color: 'error.main' }}>
            <Delete sx={{ mr: 1 }} fontSize="small" />
            {t('common.delete')}
          </MenuListItem>
        </Menu>

        <Stack spacing={1} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" noWrap>
              {branch.code}
            </Typography>
          </Box>
          
          {branch.address && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <LocationOn sx={{ fontSize: 16, color: 'text.secondary', mt: 0.2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {branch.address}
              </Typography>
            </Box>
          )}
          
          {branch.phone && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {branch.phone}
              </Typography>
            </Box>
          )}

          {branch.managerName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Group sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {t('branches.manager')}: {branch.managerName}
              </Typography>
            </Box>
          )}
        </Stack>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {branch.currency} • {branch.timezone}
          </Typography>
        </Box>

        {branch.lastSyncAt && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('branches.lastSync')}: {new Date(branch.lastSyncAt).toLocaleDateString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const BranchesPage = () => {
  const { t } = useTranslation();
  const {
    branches,
    isLoading,
    error,
    refetch,
    createBranch,
    updateBranch,
    deleteBranch,
  } = useBranches();

  // Get dashboard data for overall stats
  const { dashboardData, comprehensiveStats, isLoading: isDashboardLoading } = useDashboard();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Computed values
  const filteredBranches = useMemo(() => {
    let filtered = branches;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (branch) =>
          branch.name.toLowerCase().includes(term) ||
          branch.code.toLowerCase().includes(term) ||
          branch.address?.toLowerCase().includes(term) ||
          branch.managerName?.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (branch) => branch.isActive === (statusFilter === 'active')
      );
    }

    return filtered;
  }, [branches, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter(b => b.isActive).length;
    const inactive = total - active;

    // Use comprehensive stats if available, otherwise fallback to dashboard data
    const todaySales = comprehensiveStats?.todaySales || dashboardData?.today_sales?.total_sales || 0;
    const totalEmployees = comprehensiveStats?.totalEmployees || dashboardData?.active_employees || 0;
    const monthSales = comprehensiveStats?.monthSales || dashboardData?.month_sales?.total_sales || 0;

    return {
      total,
      active,
      inactive,
      todaySales,
      totalEmployees,
      monthSales,
    };
  }, [branches, dashboardData, comprehensiveStats]);

  // Event handlers
  const handleAddBranch = () => {
    setEditingBranch(null);
    setBranchDialogOpen(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchDialogOpen(true);
  };

  const handleDeleteBranch = (branch: Branch) => {
    setBranchToDelete(branch);
    setDeleteDialogOpen(true);
  };

  const handleViewStats = (branch: Branch) => {
    setSelectedBranch(branch);
    setStatsDialogOpen(true);
  };

  const handleCloseStatsDialog = () => {
    setStatsDialogOpen(false);
    setSelectedBranch(null);
  };

  const handleSaveBranch = async (branchData: Partial<Branch>) => {
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, branchData);
        setSnackbar({
          open: true,
          message: t('branches.branchUpdated'),
          severity: 'success',
        });
      } else {
        await createBranch(branchData);
        setSnackbar({
          open: true,
          message: t('branches.branchCreated'),
          severity: 'success',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: editingBranch ? t('branches.failedToUpdate') : t('branches.failedToCreate'),
        severity: 'error',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!branchToDelete) return;

    try {
      await deleteBranch(branchToDelete.id);
      setSnackbar({
        open: true,
        message: t('branches.branchDeleted'),
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: t('branches.failedToDelete'),
        severity: 'error',
      });
    } finally {
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            {t('common.refresh')}
          </Button>
        }>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Business sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">
            {t('branches.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => refetch()} disabled={isLoading}>
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Add />}
            size="large"
            onClick={handleAddBranch}
          >
            {t('branches.addBranch')}
          </Button>
        </Box>
      </Box>

      {/* Loading indicator */}
      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Store sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('branches.totalBranches')}
              </Typography>
            </Box>
            <Typography variant="h4">
              {isDashboardLoading ? t('common.loading') : stats.total}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('branches.activeBranches')}
              </Typography>
            </Box>
            <Typography variant="h4" color="success.main">
              {isDashboardLoading ? t('common.loading') : stats.active}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Group sx={{ fontSize: 20, color: 'info.main' }} />
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('dashboard.totalEmployees')}
              </Typography>
            </Box>
            <Typography variant="h4" color="info.main">
              {isDashboardLoading ? t('common.loading') : stats.totalEmployees}
            </Typography>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AttachMoney sx={{ fontSize: 20, color: 'warning.main' }} />
              <Typography color="textSecondary" gutterBottom variant="body2">
                {t('dashboard.todaySales')}
              </Typography>
            </Box>
            <Typography variant="h4" color="warning.main">
              {isDashboardLoading ? t('common.loading') : `$${stats.todaySales.toLocaleString()}`}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            placeholder={t('branches.searchBranches')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: { xs: '100%', sm: '300px' } }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>{t('branches.filterByStatus')}</InputLabel>
            <Select
              value={statusFilter}
              label={t('branches.filterByStatus')}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <MenuItem value="all">{t('branches.allStatuses')}</MenuItem>
              <MenuItem value="active">{t('branches.active')}</MenuItem>
              <MenuItem value="inactive">{t('branches.inactive')}</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {filteredBranches.length} {t('branches.title').toLowerCase()}
          </Typography>
        </Stack>
      </Paper>

      {/* Branches Grid */}
      {filteredBranches.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Business sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm || statusFilter !== 'all' 
              ? t('branches.noBranches') 
              : t('branches.noMatchingFilters')
            }
          </Typography>
          {!searchTerm && statusFilter === 'all' && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddBranch}
              sx={{ mt: 2 }}
            >
              {t('branches.addBranch')}
            </Button>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 3 }}>
          {filteredBranches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onEdit={handleEditBranch}
              onDelete={handleDeleteBranch}
              onViewStats={handleViewStats}
            />
          ))}
        </Box>
      )}

      {/* Branch Dialog */}
      <BranchDialog
        open={branchDialogOpen}
        onClose={() => setBranchDialogOpen(false)}
        onSave={handleSaveBranch}
        branch={editingBranch}
        isLoading={isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          {t('branches.deleteBranch')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('branches.confirmDelete')}
          </DialogContentText>
          {branchToDelete && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <strong>{branchToDelete.name}</strong> ({branchToDelete.code})
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={handleConfirmDelete}
            color="error" 
            variant="contained"
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Branch Stats Dialog */}
      <BranchStatsDialog
        open={statsDialogOpen}
        onClose={handleCloseStatsDialog}
        branch={selectedBranch}
      />
    </Container>
  );
};

export default BranchesPage;
