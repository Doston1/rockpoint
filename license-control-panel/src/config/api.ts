import axios from 'axios';

// API Configuration for production and development
export const API_CONFIG = {
  // Use environment variable for production, fallback to localhost for development
  BASE_URL: (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3002',
  
  // API endpoints
  ENDPOINTS: {
    LOGIN: '/api/admin/login',
    CUSTOMERS: '/api/admin/customers',
    LICENSES: '/api/admin/licenses',
    USAGE_STATS: '/api/admin/usage-stats',
    REVOKE_LICENSE: '/api/admin/revoke',
  }
};

// Helper function to build full API URLs
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Axios default configuration
export const configureAxios = () => {
  // Set default base URL
  axios.defaults.baseURL = API_CONFIG.BASE_URL;
  
  // Add auth token from localStorage
  const token = localStorage.getItem('token');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
  
  return axios;
};
