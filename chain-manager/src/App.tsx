import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

// Import components and pages
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { NavigationBar } from './components/NavigationBar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';

// Import pages
import BranchesPage from './pages/BranchesPage';
import CustomersPage from './pages/CustomersPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import InventoryPage from './pages/InventoryPage';
import LoginPage from './pages/LoginPage';
import NetworkManagementPage from './pages/NetworkManagementPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

// Import hooks
import { useAuth } from './hooks/useAuth';
import { useWebSocket } from './hooks/useWebSocket';

// CSS import is optional for functionality
// import './App.css';

function App() {
  const { user, isLoading, checkAuth } = useAuth();
  const { connect, disconnect } = useWebSocket();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <NavigationBar 
        onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar open={sidebarOpen} />
        
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            p: 3, 
            overflow: 'auto',
            backgroundColor: (theme) => theme.palette.grey[50]
          }}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/branches/*" 
              element={
                <ProtectedRoute permissions={['branches.read']}>
                  <BranchesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employees/*" 
              element={
                <ProtectedRoute permissions={['employees.read']}>
                  <EmployeesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customers/*" 
              element={
                <ProtectedRoute permissions={['customers.read']}>
                  <CustomersPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inventory/*" 
              element={
                <ProtectedRoute permissions={['inventory.read']}>
                  <InventoryPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/*" 
              element={
                <ProtectedRoute permissions={['reports.read']}>
                  <ReportsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/network" 
              element={
                <ProtectedRoute permissions={['admin']}>
                  <NetworkManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/*" 
              element={
                <ProtectedRoute permissions={['settings.read']}>
                  <SettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default App;
