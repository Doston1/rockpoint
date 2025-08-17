import { useEffect, useRef } from 'react';

interface NetworkInfo {
  terminalId: string;
  localIp: string;
  port: number;
  softwareVersion: string;
  hardwareInfo: {
    platform: string;
    userAgent: string;
    language: string;
    screenResolution: string;
    memory?: number;
  };
}

class NetworkService {
  private static instance: NetworkService;
  private intervalId: NodeJS.Timeout | null = null;
  private baseUrl: string;
  private terminalId: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    this.terminalId = this.getOrCreateTerminalId();
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  private getOrCreateTerminalId(): string {
    let terminalId = localStorage.getItem('terminal_id');
    if (!terminalId) {
      // Generate a unique terminal ID
      terminalId = `POS-${Date.now().toString(36).toUpperCase()}`;
      localStorage.setItem('terminal_id', terminalId);
    }
    return terminalId;
  }

  private async getLocalNetworkInfo(): Promise<NetworkInfo> {
    const hardwareInfo = {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      memory: (navigator as any).deviceMemory,
    };

    // Try to get local IP (simplified approach)
    let localIp = localStorage.getItem('local_ip');
    if (!localIp) {
      // This is a simplified way to get local IP
      // In production, you might need a more sophisticated approach
      localIp = await this.getLocalIP();
      if (localIp) {
        localStorage.setItem('local_ip', localIp);
      }
    }

    return {
      terminalId: this.terminalId,
      localIp: localIp || '192.168.1.100', // fallback
      port: 5173,
      softwareVersion: '1.0.0',
      hardwareInfo,
    };
  }

  private async getLocalIP(): Promise<string> {
    try {
      // This is a simplified approach - in real world you might use WebRTC or server detection
      const baseUrl = new URL(this.baseUrl);
      const response = await fetch(`${baseUrl.origin}/api/network/client-ip`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.ip || '192.168.1.100';
      }
    } catch (error) {
      console.warn('Could not detect local IP:', error);
    }
    
    // Fallback to stored IP or default
    return localStorage.getItem('local_ip') || '192.168.1.100';
  }

  async registerTerminal(): Promise<boolean> {
    try {
      const networkInfo = await this.getLocalNetworkInfo();
      
      const response = await fetch(`${this.baseUrl}/network/terminals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          terminal_id: networkInfo.terminalId,
          name: `Terminal ${networkInfo.terminalId}`,
          ip_address: networkInfo.localIp,
          port: networkInfo.port,
          software_version: networkInfo.softwareVersion,
          hardware_info: networkInfo.hardwareInfo,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to register terminal:', error);
      return false;
    }
  }

  async updateTerminalStatus(status: 'online' | 'offline' | 'maintenance' | 'error'): Promise<boolean> {
    try {
      const networkInfo = await this.getLocalNetworkInfo();
      
      const response = await fetch(`${this.baseUrl}/network/terminals/by-terminal-id/${this.terminalId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          status,
          hardware_info: networkInfo.hardwareInfo,
          software_version: networkInfo.softwareVersion,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to update terminal status:', error);
      return false;
    }
  }

  startStatusReporting(intervalMs: number = 30000): void {
    if (this.intervalId) {
      this.stopStatusReporting();
    }

    // Initial registration
    this.registerTerminal();

    // Regular status updates
    this.intervalId = setInterval(async () => {
      const isOnline = navigator.onLine;
      await this.updateTerminalStatus(isOnline ? 'online' : 'offline');
    }, intervalMs);

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.updateTerminalStatus('offline');
      } else {
        this.updateTerminalStatus('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle page unload
    const handleUnload = () => {
      this.updateTerminalStatus('offline');
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
  }

  stopStatusReporting(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async getNetworkConfig(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/network/config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    } catch (error) {
      console.error('Failed to get network config:', error);
    }
    return [];
  }

  getTerminalId(): string {
    return this.terminalId;
  }

  getNetworkInfo(): Promise<NetworkInfo> {
    return this.getLocalNetworkInfo();
  }
}

// React hook for network service
export const useNetworkService = () => {
  const networkServiceRef = useRef<NetworkService | null>(null);

  useEffect(() => {
    if (!networkServiceRef.current) {
      networkServiceRef.current = NetworkService.getInstance();
      networkServiceRef.current.startStatusReporting();
    }

    return () => {
      if (networkServiceRef.current) {
        networkServiceRef.current.stopStatusReporting();
      }
    };
  }, []);

  return networkServiceRef.current;
};

export default NetworkService;
