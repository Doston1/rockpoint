import { DatabaseManager } from '../database/manager';

export interface BranchApiRequest {
  branchId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  timeout?: number;
}

export interface BranchApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  status: number;
  branchId: string;
}

export class BranchApiService {
  private static async getBranchServerConfig(branchId: string) {
    const query = `
      SELECT 
        bs.*,
        b.name as branch_name,
        b.code as branch_code
      FROM branch_servers bs
      JOIN branches b ON bs.branch_id = b.id
      WHERE bs.branch_id = $1 AND bs.is_active = true
      ORDER BY bs.status = 'online' DESC, bs.last_ping DESC
      LIMIT 1
    `;
    
    const result = await DatabaseManager.query(query, [branchId]);
    return result.rows[0] || null;
  }

  private static getApiUrl(server: any, endpoint: string): string {
    // Remove leading slash from endpoint if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    // Use the most appropriate IP address based on network type
    let baseUrl: string;
    if (server.network_type === 'vpn' && server.vpn_ip_address) {
      baseUrl = `http://${server.vpn_ip_address}:${server.api_port}`;
    } else if (server.network_type === 'public' && server.public_ip_address) {
      baseUrl = `http://${server.public_ip_address}:${server.api_port}`;
    } else {
      baseUrl = `http://${server.ip_address}:${server.api_port}`;
    }
    
    const finalUrl = `${baseUrl}/api/${cleanEndpoint}`;
    return finalUrl;
  }

  private static getAuthHeaders(server: any): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RockPoint-Chain-Core/1.0'
    };

    // Add outbound API key if configured
    if (server.outbound_api_key) {
      headers['Authorization'] = `Bearer ${server.outbound_api_key}`;
      headers['X-API-Key'] = server.outbound_api_key;
    }

    return headers;
  }

  /**
   * Make an authenticated request to a branch server
   */
  static async makeRequest(request: BranchApiRequest): Promise<BranchApiResponse> {
    console.log(`🚀 BranchApiService.makeRequest called with:`, JSON.stringify(request, null, 2));
    
    try {
      // Get branch server configuration
      const server = await this.getBranchServerConfig(request.branchId);
      console.log(`📋 Retrieved server config:`, JSON.stringify(server, null, 2));
      if (!server) {
        return {
          success: false,
          error: 'Branch server configuration not found',
          status: 404,
          branchId: request.branchId
        };
      }

      // Check if server is available for connection
      if (server.status !== 'online') {
        const statusMessages = {
          'offline': 'Branch server is currently offline',
          'error': 'Branch server is in an error state',
          'maintenance': 'Branch server is under maintenance',
          'unknown': 'Branch server status is unknown'
        };
        
        const errorMessage = statusMessages[server.status as keyof typeof statusMessages] || 
                            `Branch server status is '${server.status}'`;
        
        // For test connections, we'll bypass this check to actually test connectivity
        if (request.endpoint !== 'health') {
          return {
            success: false,
            error: errorMessage,
            status: 503,
            branchId: request.branchId
          };
        } 
      }

      // Prepare request
      const url = this.getApiUrl(server, request.endpoint);
      const headers = this.getAuthHeaders(server);
      const timeout = request.timeout || 10000;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        signal: controller.signal
      };

      // Add body for non-GET requests
      if (request.data && request.method !== 'GET') {
        fetchOptions.body = JSON.stringify(request.data);
      }

      // Make the request
      const startTime = Date.now();
      const response = await fetch(url, fetchOptions);
      const responseTime = Date.now() - startTime;

      clearTimeout(timeoutId);

      // Parse response
      let responseData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Update server response time
      await DatabaseManager.query(
        'UPDATE branch_servers SET response_time_ms = $1, last_ping = NOW() WHERE id = $2',
        [responseTime, server.id]
      );

      // Log the request for monitoring
      await DatabaseManager.query(`
        INSERT INTO connection_health_logs (
          source_type, source_id, target_type, target_id,
          connection_status, response_time_ms, checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        'chain_core', 'main',
        'branch_core', request.branchId,
        response.ok ? 'success' : 'failed',
        responseTime
      ]);

      return {
        success: response.ok,
        data: responseData,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        branchId: request.branchId
      };

    } catch (error: any) {
      // Log the error
      await DatabaseManager.query(`
        INSERT INTO connection_health_logs (
          source_type, source_id, target_type, target_id,
          connection_status, error_message, checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        'chain_core', 'main',
        'branch_core', request.branchId,
        'error',
        error.message
      ]);

      return {
        success: false,
        error: error.message,
        status: 0,
        branchId: request.branchId
      };
    }
  }

  /**
   * Make requests to multiple branches simultaneously
   */
  static async makeMultiRequest(requests: BranchApiRequest[]): Promise<BranchApiResponse[]> {
    const promises = requests.map(request => this.makeRequest(request));
    return Promise.all(promises);
  }

  /**
   * Sync data to a specific branch
   */
  static async syncToBranch(branchId: string, syncType: string, data: any): Promise<BranchApiResponse> {
    const endpointMap: Record<string, string> = {
      'products': 'chain-core/products/sync',
      'employees': 'chain-core/employees',
      'inventory': 'chain-core/inventory',
      'prices': 'chain-core/products/prices'
    };

    const endpoint = endpointMap[syncType];
    if (!endpoint) {
      return {
        success: false,
        error: `Unknown sync type: ${syncType}`,
        status: 400,
        branchId
      };
    }

    return this.makeRequest({
      branchId,
      endpoint,
      method: 'POST',
      data,
      timeout: 30000 // Longer timeout for sync operations
    });
  }

  /**
   * Get status from a branch
   */
  static async getBranchStatus(branchId: string): Promise<BranchApiResponse> {
    return this.makeRequest({
      branchId,
      endpoint: 'chain-core/status',
      method: 'GET',
      timeout: 5000
    });
  }

  /**
   * Test connection to a branch
   */
  static async testConnection(branchId: string): Promise<BranchApiResponse> {
    return this.makeRequest({
      branchId,
      endpoint: 'health',
      method: 'GET',
      timeout: 5000
    });
  }
}
