import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './hooks/useAuth';
import CheckoutPage from './pages/CheckoutPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import InventoryPage from './pages/InventoryPage';
import LoginPage from './pages/LoginPage';
import { theme } from './theme';

function App() {
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
            <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />

          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;