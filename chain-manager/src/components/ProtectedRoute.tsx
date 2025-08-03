import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from './common/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  permissions?: string[];
}

export function ProtectedRoute({ children, permissions = [] }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check permissions if specified
  if (permissions.length > 0 && user) {
    const hasPermission = permissions.some(permission => 
      user.permissions.includes(permission) || 
      user.permissions.includes('*') || // User has all permissions
      user.role === 'super_admin' || // Super admin has all permissions
      user.role === 'chain_admin' // Chain admin has all permissions
    );

    if (!hasPermission) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
