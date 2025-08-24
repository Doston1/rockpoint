import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useEffect } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './hooks/useAuth';
import ApiKeyManagementPage from './pages/ApiKeyManagementPage';
import CheckoutPage from './pages/CheckoutPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import InventoryPage from './pages/InventoryPage';
import LoginPage from './pages/LoginPage';
import NetworkSettingsPage from './pages/NetworkSettingsPage';
import POSTerminalManagementPage from './pages/POSTerminalManagementPage';
import SettingsPage from './pages/SettingsPage';
import UzumBankSettingsPage from './pages/UzumBankSettingsPage';
import NetworkService from './services/networkService';
import { theme } from './theme';
import './utils/i18next'; // Import i18n configuration

function App() {
  useEffect(() => {
    // Initialize network service when the app starts
    const networkService = NetworkService.getInstance();
    networkService.startStatusReporting();

    // Cleanup on unmount
    return () => {
      networkService.stopStatusReporting();
    };
  }, []);

  return (
    <Router>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inventory" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <InventoryPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/checkout" 
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employees" 
              element={
                <ProtectedRoute>
                  <EmployeesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/network-settings" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <NetworkSettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/network" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <NetworkSettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/api-keys" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <ApiKeyManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/api-keys" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <ApiKeyManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/terminals" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <POSTerminalManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/terminals" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <POSTerminalManagementPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/uzum-bank" 
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <UzumBankSettingsPage />
                </ProtectedRoute>
              } 
            />

          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;