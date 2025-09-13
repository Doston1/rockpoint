import {
  Assessment,
  Business,
  Dashboard,
  Group,
  Inventory,
  People,
  Settings,
} from '@mui/icons-material';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  open: boolean;
}

const DRAWER_WIDTH = 240;

export function Sidebar({ open }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      path: '/dashboard',
      label: t('navigation.dashboard'),
      icon: <Dashboard />,
    },
    {
      path: '/branches',
      label: t('navigation.branches'),
      icon: <Business />,
    },
    {
      path: '/employees',
      label: t('navigation.employees'),
      icon: <Group />,
    },
    {
      path: '/customers',
      label: t('navigation.customers'),
      icon: <People />,
    },
    {
      path: '/inventory',
      label: t('navigation.inventory'),
      icon: <Inventory />,
    },
    {
      path: '/reports',
      label: t('navigation.reports'),
      icon: <Assessment />,
    },
    {
      path: '/settings',
      label: t('navigation.settings'),
      icon: <Settings />,
    },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="h6" fontWeight="bold">
          {t('common.chainManager')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('dashboard.mainOffice')}
        </Typography>
      </Box>

      <List>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname.startsWith(item.path)}
              onClick={() => handleNavigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          position: 'relative',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
