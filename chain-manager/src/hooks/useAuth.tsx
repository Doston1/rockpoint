import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ApiResponse, LoginResponse, User } from '../services/api';
import { apiService } from '../services/api';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in on app start
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const token = apiService.getToken();
      if (token) {
        console.log('Found token, verifying...');
        const response = await apiService.verifyToken();
        console.log('Verify response:', response);
        if (response.success && response.data) {
          setUser(response.data.user);
        } else {
          console.log('Token verification failed, clearing token');
          apiService.clearToken();
          setUser(null);
        }
      } else {
        // Only log this during initial app load, not on every render
        if (isLoading) {
          console.log('No token found - user needs to login');
        }
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      apiService.clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    console.log('🔑 UseAuth: Login function called with:', { email, password: '***' });
    setIsLoading(true);
    try {
      console.log('🌐 UseAuth: Calling apiService.login...');
      const response: ApiResponse<LoginResponse> = await apiService.login(email, password);
      console.log('📨 UseAuth: API response received:', response);
      
      if (response.success && response.data) {
        console.log('👤 UseAuth: Setting user data:', response.data.user);
        setUser(response.data.user);
        return { success: true };
      } else {
        console.log('❌ UseAuth: Login failed:', response.error);
        return { 
          success: false, 
          error: response.error || 'Login failed' 
        };
      }
    } catch (error: any) {
      console.error('💥 UseAuth: Login error:', error);
      return { 
        success: false, 
        error: error.message || 'Network error occurred' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
