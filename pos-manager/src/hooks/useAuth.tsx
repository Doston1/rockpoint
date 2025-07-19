import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ApiResponse, LoginResponse, User } from '../services/api';
import { apiService } from '../services/api';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (employeeId: string, pin: string, terminalId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  verifyToken: () => Promise<boolean>;
  changePin: (currentPin: string, newPin: string, confirmPin: string) => Promise<{ success: boolean; error?: string }>;
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
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const token = apiService.getToken();
    if (token) {
      try {
        const success = await verifyToken();
        if (!success) {
          apiService.clearToken();
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        apiService.clearToken();
      }
    }
    setIsLoading(false);
  };

  const login = async (employeeId: string, pin: string, terminalId?: string) => {
    setIsLoading(true);
    try {
      const response: ApiResponse<LoginResponse> = await apiService.login(employeeId, pin, terminalId);
      
      if (response.success && response.data) {
        setUser(response.data.user);
        return { success: true };
      } else {
        return { 
          success: false, 
          error: response.error || 'Login failed' 
        };
      }
    } catch (error: any) {
      console.error('Login error:', error);
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
    }
    setUser(null);
    setIsLoading(false);
  };

  const verifyToken = async (): Promise<boolean> => {
    try {
      const response = await apiService.verifyToken();
      
      if (response.success && response.data) {
        setUser(response.data.user);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Token verification error:', error);
      setUser(null);
      return false;
    }
  };

  const changePin = async (currentPin: string, newPin: string, confirmPin: string) => {
    try {
      const response = await apiService.changePin(currentPin, newPin, confirmPin);
      
      if (response.success) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: response.error || 'PIN change failed' 
        };
      }
    } catch (error: any) {
      console.error('PIN change error:', error);
      return { 
        success: false, 
        error: error.message || 'Network error occurred' 
      };
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    verifyToken,
    changePin,
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
