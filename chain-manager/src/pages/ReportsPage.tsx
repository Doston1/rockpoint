import {
    Assessment,
} from '@mui/icons-material';
import {
    Box,
    Card,
    CardContent,
    Container,
    Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const ReportsPage = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Assessment sx={{ mr: 1, fontSize: 32 }} />
        <Typography variant="h4" fontWeight="bold">
          {t('reports.title')}
        </Typography>
      </Box>

      {/* Placeholder Content */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('reports.analyticsPanel')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('reports.comingSoon')}
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
};

export default ReportsPage;
