import {
    AccountCircle,
    Dashboard,
    Logout,
    PointOfSale,
    Settings,
    SignalWifi4Bar,
    SignalWifiOff,
    Store,
} from '@mui/icons-material';
import {
    AppBar,
    Badge,
    Box,
    Button,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { LanguageSelector } from './LanguageSelector';

export function NavigationBar() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/');
  };

  const handleNavigate = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
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

  const canAccessDashboard = user?.role === 'admin' || user?.role === 'manager';

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        {/* Logo and App Name */}
        <Store sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          RockPoint POS
        </Typography>

        {/* Connection Status */}
        <Box sx={{ mr: 2 }}>
          {isConnected ? (
            <Badge color="success" variant="dot">
              <SignalWifi4Bar color="inherit" />
            </Badge>
          ) : (
            <Badge color="error" variant="dot">
              <SignalWifiOff color="inherit" />
            </Badge>
          )}
        </Box>

        {/* Navigation Buttons */}
        <Box sx={{ mr: 2, display: 'flex', gap: 1 }}>
          {canAccessDashboard && (
            <Button
              color="inherit"
              startIcon={<Dashboard />}
              onClick={() => handleNavigate('/dashboard')}
              variant={location.pathname === '/dashboard' ? 'outlined' : 'text'}
            >
              {t('navigation.dashboard')}
            </Button>
          )}
          
          <Button
            color="inherit"
            startIcon={<PointOfSale />}
            onClick={() => handleNavigate('/checkout')}
            variant={location.pathname === '/checkout' ? 'outlined' : 'text'}
          >
            {t('navigation.checkout')}
          </Button>

          {user?.role === 'admin' && (
            <Button
              color="inherit"
              startIcon={<Settings />}
              onClick={() => handleNavigate('/settings')}
              variant={location.pathname.startsWith('/settings') ? 'outlined' : 'text'}
            >
              {t('navigation.settings')}
            </Button>
          )}
        </Box>

        {/* Language Selector */}
        <LanguageSelector />

        {/* User Info and Menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
              {user?.name}
            </Typography>
            <Chip
              label={user?.role}
              size="small"
              color={getRoleColor(user?.role || '')}
              sx={{ height: 16, fontSize: '0.7rem' }}
            />
          </Box>

          <IconButton
            size="large"
            edge="end"
            color="inherit"
            onClick={handleMenuOpen}
          >
            <AccountCircle />
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              {t('auth.logout')}
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
