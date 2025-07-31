import {
    Add,
    Group,
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

const EmployeesPage = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Group sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">
            {t('employees.title')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
        >
          {t('employees.addEmployee')}
        </Button>
      </Box>

      {/* Placeholder Content */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('employees.managementPanel')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('employees.comingSoon')}
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
};

export default EmployeesPage;
