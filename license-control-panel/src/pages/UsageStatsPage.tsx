import {
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Grid,
    List,
    ListItem,
    ListItemText,
    Paper,
    Typography
} from '@mui/material';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface UsageData {
  _id: string;
  count: number;
  instances: Array<{
    licenseKey: string;
    lastActive: string;
    activations: number;
  }>;
}

const UsageStatsPage: React.FC = () => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const fetchUsageStats = async () => {
    try {
      const response = await axios.get('/api/admin/usage-stats');
      setUsageData(response.data.usage);
    } catch (error) {
      toast.error('Failed to load usage statistics');
      console.error('Error fetching usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = usageData.map(item => ({
    name: item._id || 'Unknown',
    value: item.count,
    color: getColorForAppType(item._id)
  }));

  const barData = usageData.map(item => ({
    appType: item._id || 'Unknown',
    installations: item.count,
    activations: item.instances.reduce((sum, instance) => sum + instance.activations, 0)
  }));

  function getColorForAppType(appType: string): string {
    const colors: { [key: string]: string } = {
      'chain-manager': '#2196f3',
      'pos-manager': '#4caf50', 
      'branch-core': '#ff9800',
      'chain-core': '#f44336'
    };
    return colors[appType] || '#9e9e9e';
  }

  const formatAppTypeName = (appType: string): string => {
    const names: { [key: string]: string } = {
      'chain-manager': 'Chain Manager',
      'pos-manager': 'POS Manager',
      'branch-core': 'Branch Core',
      'chain-core': 'Chain Core'
    };
    return names[appType] || appType;
  };

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const totalInstallations = usageData.reduce((sum, item) => sum + item.count, 0);
  const totalActivations = usageData.reduce((sum, item) => 
    sum + item.instances.reduce((instanceSum, instance) => instanceSum + instance.activations, 0), 0
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Usage Statistics
      </Typography>

      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Installations
              </Typography>
              <Typography variant="h4">
                {totalInstallations}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Activations
              </Typography>
              <Typography variant="h4">
                {totalActivations}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                App Types
              </Typography>
              <Typography variant="h4">
                {usageData.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg. per License
              </Typography>
              <Typography variant="h4">
                {usageData.length > 0 ? Math.round(totalInstallations / usageData.length) : 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Pie Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Installation Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${formatAppTypeName(name)} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Bar Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Installations vs Activations
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="appType" 
                  tickFormatter={formatAppTypeName}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={formatAppTypeName}
                />
                <Legend />
                <Bar dataKey="installations" fill="#2196f3" name="Installations" />
                <Bar dataKey="activations" fill="#4caf50" name="Total Activations" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Detailed List */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Detailed Usage Breakdown
            </Typography>
            <Grid container spacing={2}>
              {usageData.map((appData) => (
                <Grid item xs={12} md={6} key={appData._id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                          {formatAppTypeName(appData._id)}
                        </Typography>
                        <Chip 
                          label={`${appData.count} installations`} 
                          color="primary" 
                          size="small" 
                        />
                      </Box>
                      <List dense>
                        {appData.instances.slice(0, 3).map((instance, index) => (
                          <ListItem key={index} sx={{ px: 0 }}>
                            <ListItemText
                              primary={`License: ${instance.licenseKey}`}
                              secondary={`Last active: ${new Date(instance.lastActive).toLocaleDateString()} | Activations: ${instance.activations}`}
                            />
                          </ListItem>
                        ))}
                        {appData.instances.length > 3 && (
                          <ListItem sx={{ px: 0 }}>
                            <ListItemText
                              secondary={`... and ${appData.instances.length - 3} more instances`}
                            />
                          </ListItem>
                        )}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default UsageStatsPage;
