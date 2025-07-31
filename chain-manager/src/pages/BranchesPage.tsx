import {
    Add,
    Business,
    Edit,
    LocationOn,
    Phone,
} from '@mui/icons-material';
import {
    Box,
    Button,
    Card,
    CardContent,
    Container,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const BranchesPage = () => {
  const { t } = useTranslation();

  const branches = [
    {
      id: '1',
      name: 'Downtown Store',
      address: '123 Main St, City Center',
      phone: '+1 (555) 123-4567',
      manager: 'John Smith',
      status: 'active',
    },
    {
      id: '2',
      name: 'Mall Location',
      address: '456 Shopping Mall, Level 2',
      phone: '+1 (555) 234-5678',
      manager: 'Jane Doe',
      status: 'active',
    },
  ];

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
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
        >
          {t('branches.addBranch')}
        </Button>
      </Box>

      {/* Stats Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('branches.totalBranches')}
            </Typography>
            <Typography variant="h4">
              {branches.length}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('branches.activeBranches')}
            </Typography>
            <Typography variant="h4" color="success.main">
              {branches.filter(b => b.status === 'active').length}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('branches.totalSalesToday')}
            </Typography>
            <Typography variant="h4" color="primary.main">
              $24,567
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              {t('branches.averagePerformance')}
            </Typography>
            <Typography variant="h4" color="warning.main">
              92%
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Branches List */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
          gap: 3,
        }}
      >
        {branches.map((branch) => (
          <Card key={branch.id} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  {branch.name}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Edit />}
                >
                  {t('common.edit')}
                </Button>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationOn sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  {branch.address}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Phone sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  {branch.phone}
                </Typography>
              </Box>
              
              <Typography variant="body2" sx={{ mt: 2 }}>
                <strong>{t('branches.manager')}:</strong> {branch.manager}
              </Typography>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="success.main">
                  {t('branches.status')}: {branch.status}
                </Typography>
                <Typography variant="body2" color="primary.main">
                  {t('branches.viewDetails')}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Container>
  );
};

export default BranchesPage;
