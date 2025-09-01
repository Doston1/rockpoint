import { Box } from '@mui/material';
import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import CustomersPage from './pages/CustomersPage';
import Dashboard from './pages/Dashboard';
import LicensesPage from './pages/LicensesPage';
import LoginPage from './pages/LoginPage';
import UsageStatsPage from './pages/UsageStatsPage';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/licenses" element={<LicensesPage />} />
          <Route path="/usage-stats" element={<UsageStatsPage />} />
        </Routes>
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
