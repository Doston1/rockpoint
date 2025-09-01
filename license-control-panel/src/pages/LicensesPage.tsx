import { Add as AddIcon, Block as BlockIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import {
    Box,
    Button,
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
    TextField,
    Typography
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface License {
  _id: string;
  licenseKey: string;
  customerId: {
    name: string;
    company: string;
  };
  features: string[];
  maxBranches: number;
  maxPOSTerminals: number;
  expiryDate: string;
  isActive: boolean;
  createdAt: string;
}

const LicensesPage: React.FC = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLicense, setNewLicense] = useState({
    customerId: '',
    maxBranches: 1,
    maxPOSTerminals: 1,
    features: [] as string[],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
  });

  const availableFeatures = [
    'inventory',
    'analytics', 
    'reporting',
    'multi-branch',
    'advanced-pos',
    'api-access',
    'cloud-sync'
  ];

  useEffect(() => {
    fetchLicenses();
    fetchCustomers();
  }, []);

  const fetchLicenses = async () => {
    try {
      const response = await axios.get('/api/admin/licenses');
      setLicenses(response.data.licenses);
    } catch (error) {
      toast.error('Failed to load licenses');
      console.error('Error fetching licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/admin/customers');
      setCustomers(response.data.customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleCreateLicense = async () => {
    try {
      const response = await axios.post('/api/admin/licenses', newLicense);
      setLicenses([response.data.license, ...licenses]);
      setDialogOpen(false);
      setNewLicense({
        customerId: '',
        maxBranches: 1,
        maxPOSTerminals: 1,
        features: [],
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });
      toast.success(`License created! Key: ${response.data.licenseKey}`);
    } catch (error) {
      toast.error('Failed to create license');
      console.error('Error creating license:', error);
    }
  };

  const handleDeactivateLicense = async (licenseKey: string) => {
    try {
      await axios.patch(`/api/admin/licenses/${licenseKey}/deactivate`, {
        reason: 'Deactivated by admin'
      });
      await fetchLicenses(); // Refresh the list
      toast.success('License deactivated successfully!');
    } catch (error) {
      toast.error('Failed to deactivate license');
      console.error('Error deactivating license:', error);
    }
  };

  const columns: GridColDef[] = [
    { field: 'licenseKey', headerName: 'License Key', width: 180 },
    { 
      field: 'customerId', 
      headerName: 'Customer', 
      width: 150,
      valueGetter: (params: any) => params.row.customerId?.name || 'Unknown'
    },
    { 
      field: 'company', 
      headerName: 'Company', 
      width: 150,
      valueGetter: (params: any) => params.row.customerId?.company || 'Unknown'
    },
    { field: 'maxBranches', headerName: 'Max Branches', width: 120 },
    { field: 'maxPOSTerminals', headerName: 'Max POS', width: 100 },
    {
      field: 'features',
      headerName: 'Features',
      width: 200,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {params.value.slice(0, 2).map((feature: string) => (
            <Chip key={feature} label={feature} size="small" />
          ))}
          {params.value.length > 2 && (
            <Chip label={`+${params.value.length - 2}`} size="small" variant="outlined" />
          )}
        </Box>
      )
    },
    {
      field: 'expiryDate',
      headerName: 'Expires',
      width: 120,
      valueFormatter: (params: any) => new Date(params.value).toLocaleDateString()
    },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 100,
      renderCell: (params: any) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'error'}
          size="small"
        />
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      renderCell: (params: any) => (
        <Box>
          {params.row.isActive ? (
            <IconButton
              onClick={() => handleDeactivateLicense(params.row.licenseKey)}
              color="error"
              size="small"
            >
              <BlockIcon />
            </IconButton>
          ) : (
            <IconButton disabled size="small">
              <CheckIcon />
            </IconButton>
          )}
        </Box>
      )
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Licenses
        </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Generate License
          </Button>
        </Box>

        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={licenses}
            columns={columns}
            getRowId={(row) => row._id}
            loading={loading}
            pageSizeOptions={[5, 10, 25]}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 10 },
              },
            }}
          />
        </Paper>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Generate New License</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
              <InputLabel>Customer</InputLabel>
              <Select
                value={newLicense.customerId}
                label="Customer"
                onChange={(e) => setNewLicense({ ...newLicense, customerId: e.target.value })}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer._id} value={customer._id}>
                    {customer.name} - {customer.company}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              margin="dense"
              label="Max Branches"
              type="number"
              fullWidth
              variant="outlined"
              value={newLicense.maxBranches}
              onChange={(e) => setNewLicense({ ...newLicense, maxBranches: parseInt(e.target.value) })}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="dense"
              label="Max POS Terminals"
              type="number"
              fullWidth
              variant="outlined"
              value={newLicense.maxPOSTerminals}
              onChange={(e) => setNewLicense({ ...newLicense, maxPOSTerminals: parseInt(e.target.value) })}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Features</InputLabel>
              <Select
                multiple
                value={newLicense.features}
                label="Features"
                onChange={(e) => setNewLicense({ ...newLicense, features: e.target.value as string[] })}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {availableFeatures.map((feature) => (
                  <MenuItem key={feature} value={feature}>
                    {feature}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Expiry Date"
              type="date"
              value={newLicense.expiryDate ? new Date(newLicense.expiryDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setNewLicense({ ...newLicense, expiryDate: new Date(e.target.value) })}
              fullWidth
              variant="outlined"
              InputLabelProps={{
                shrink: true,
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLicense} variant="contained">
              Generate License
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
  );
};

export default LicensesPage;
