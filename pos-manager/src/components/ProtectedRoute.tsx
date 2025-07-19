import { Box, CircularProgress, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'manager' | 'cashier' | 'supervisor';
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  redirectTo = '/' 
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <CircularProgress />
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRole && user?.role !== requiredRole) {
    // Check if user has higher privileges
    const roleHierarchy = {
      'admin': 4,
      'manager': 3,
      'supervisor': 2,
      'cashier': 1
    };

    const userLevel = roleHierarchy[user?.role || 'cashier'];
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          gap={2}
        >
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography>
            You don't have permission to access this page.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Required role: {requiredRole}
          </Typography>
        </Box>
      );
    }
  }

  return <>{children}</>;
}
