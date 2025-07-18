import {
  Assessment,
  Inventory,
  Logout,
  People,
  PointOfSale,
  Store,
} from '@mui/icons-material';
import {
  AppBar,
  Box,
  Card,
  CardContent,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
  };

  const menuItems = [
    {
      title: 'Point of Sale',
      description: 'Process transactions and sales',
      icon: <PointOfSale sx={{ fontSize: 48 }} />,
      action: () => navigate('/checkout'),
      color: 'primary.main',
    },
    {
      title: 'Inventory',
      description: 'Manage products and stock',
      icon: <Inventory sx={{ fontSize: 48 }} />,
      action: () => console.log('Inventory'),
      color: 'secondary.main',
    },
    {
      title: 'Employees',
      description: 'Manage staff and schedules',
      icon: <People sx={{ fontSize: 48 }} />,
      action: () => console.log('Employees'),
      color: 'success.main',
    },
    {
      title: 'Reports',
      description: 'View sales and analytics',
      icon: <Assessment sx={{ fontSize: 48 }} />,
      action: () => console.log('Reports'),
      color: 'warning.main',
    },
  ];

  return (
    <>
      <AppBar position="sticky">
        <Toolbar>
          <Store sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            POS Dashboard
          </Typography>
          <IconButton color="inherit" onClick={handleLogout}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Branch Manager
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
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 3,
                }
              }}
              onClick={item.action}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ color: item.color, mb: 2 }}>
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
      </Container>
    </>
  );
};

export default DashboardPage;