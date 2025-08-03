import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { DatabaseManager } from '../database/manager';
import { RedisManager } from '../services/redis';

interface OneCConfig {
  baseUrl: string;
  username: string;
  password: string;
  database: string;
  timeout: number;
}

interface OneCProduct {
  guid: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost: number;
  category: string;
  unit: string;
  isActive: boolean;
}

interface OneCTransaction {
  guid: string;
  number: string;
  date: string;
  branchCode: string;
  employeeCode: string;
  totalAmount: number;
  taxAmount: number;
  paymentMethod: string;
  items: OneCTransactionItem[];
}

interface OneCTransactionItem {
  productGuid: string;
  quantity: number;
  price: number;
  totalAmount: number;
}

interface OneCInventory {
  productGuid: string;
  branchCode: string;
  quantity: number;
  reserved: number;
  available: number;
}

export class OneCIntegration {
  private static instance: OneCIntegration;
  private client: AxiosInstance;
  private config: OneCConfig;
  private redisManager: RedisManager;
  private isConnected: boolean = false;

  private constructor() {
    this.config = {
      baseUrl: process.env.ONEC_BASE_URL || 'http://localhost:1542',
      username: process.env.ONEC_USERNAME || 'admin',
      password: process.env.ONEC_PASSWORD || '',
      database: process.env.ONEC_DATABASE || 'retail',
      timeout: parseInt(process.env.ONEC_TIMEOUT || '30000')
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      auth: {
        username: this.config.username,
        password: this.config.password
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.redisManager = RedisManager.getInstance();
    this.setupInterceptors();
  }

  public static getInstance(): OneCIntegration {
    if (!OneCIntegration.instance) {
      OneCIntegration.instance = new OneCIntegration();
    }
    return OneCIntegration.instance;
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        console.log(`1C Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: AxiosError) => {
        console.error('1C Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`1C Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        console.error('1C Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  public async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    // 1C integration is passive - we don't test outbound connections
    // 1C system connects to us via API endpoints
    return {
      success: true,
      message: 'Ready to receive data from 1C system',
      version: 'passive-receiver'
    };
  }

  // Product synchronization methods

  public async syncProductsFromOneC(): Promise<{ success: boolean; processed: number; errors: string[] }> {
    // 1C integration is passive - 1C should push data via API endpoints
    // This method should not make outbound requests to 1C
    console.warn('syncProductsFromOneC called but outbound requests are disabled - 1C should push data via API endpoints');
    
    return { 
      success: false, 
      processed: 0, 
      errors: ['Outbound requests are disabled - 1C should push data via /api/1c-integration endpoints'] 
    };
  }

  private async processProduct(oneCProduct: OneCProduct): Promise<void> {
    // Check if product exists
    const existingProduct = await DatabaseManager.query(
      'SELECT id FROM products WHERE sku = $1',
      [oneCProduct.sku]
    );

    const categoryResult = await DatabaseManager.query(
      'SELECT id FROM categories WHERE name = $1',
      [oneCProduct.category]
    );

    let categoryId = categoryResult.rows[0]?.id;
    
    // Create category if it doesn't exist
    if (!categoryId) {
      const newCategoryResult = await DatabaseManager.query(
        'INSERT INTO categories (name, is_active, created_at, updated_at) VALUES ($1, true, NOW(), NOW()) RETURNING id',
        [oneCProduct.category]
      );
      categoryId = newCategoryResult.rows[0].id;
    }

    if (existingProduct.rows.length > 0) {
      // Update existing product
      await DatabaseManager.query(`
        UPDATE products 
        SET name = $1, price = $2, cost = $3, category_id = $4, 
            unit = $5, is_active = $6, updated_at = NOW()
        WHERE sku = $7
      `, [
        oneCProduct.name,
        oneCProduct.price,
        oneCProduct.cost,
        categoryId,
        oneCProduct.unit,
        oneCProduct.isActive,
        oneCProduct.sku
      ]);
    } else {
      // Create new product
      await DatabaseManager.query(`
        INSERT INTO products (
          name, sku, barcode, category_id, price, cost, unit, 
          is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [
        oneCProduct.name,
        oneCProduct.sku,
        oneCProduct.barcode,
        categoryId,
        oneCProduct.price,
        oneCProduct.cost,
        oneCProduct.unit,
        oneCProduct.isActive
      ]);
    }
  }

  public async syncProductsToOneC(): Promise<{ success: boolean; processed: number; errors: string[] }> {
    // 1C integration is one-way: 1C → chain-core only
    // Outbound synchronization is not supported
    console.warn('syncProductsToOneC called but outbound sync is disabled - 1C should pull data via API endpoints');
    
    return { 
      success: false, 
      processed: 0, 
      errors: ['Outbound synchronization is disabled - 1C integration is receive-only'] 
    };
  }

  private async exportProductToOneC(product: any): Promise<void> {
    // 1C integration is one-way: 1C → chain-core only
    // Outbound product export is not supported
    throw new Error('Outbound product export is disabled - 1C should retrieve data via API endpoints');
  }

  // Inventory synchronization methods

  public async syncInventoryFromOneC(branchCode?: string): Promise<{ success: boolean; processed: number; errors: string[] }> {
    // 1C integration is passive - 1C should push data via API endpoints
    // This method should not make outbound requests to 1C
    console.warn('syncInventoryFromOneC called but outbound requests are disabled - 1C should push data via API endpoints');
    
    return { 
      success: false, 
      processed: 0, 
      errors: ['Outbound requests are disabled - 1C should push data via /api/1c-integration endpoints'] 
    };
  }

  private async processInventoryItem(item: OneCInventory): Promise<void> {
    // Find product by 1C GUID
    const productResult = await DatabaseManager.query(
      'SELECT id FROM products WHERE sku = $1',
      [item.productGuid] // Assuming we store 1C GUID as SKU or have a mapping
    );

    if (productResult.rows.length === 0) {
      throw new Error(`Product not found for GUID: ${item.productGuid}`);
    }

    // Find branch by code
    const branchResult = await DatabaseManager.query(
      'SELECT id FROM branches WHERE code = $1',
      [item.branchCode]
    );

    if (branchResult.rows.length === 0) {
      throw new Error(`Branch not found for code: ${item.branchCode}`);
    }

    const productId = productResult.rows[0].id;
    const branchId = branchResult.rows[0].id;

    // Update or create inventory record
    const existingInventory = await DatabaseManager.query(
      'SELECT id FROM inventory WHERE product_id = $1 AND branch_id = $2',
      [productId, branchId]
    );

    if (existingInventory.rows.length > 0) {
      await DatabaseManager.query(
        'UPDATE inventory SET quantity = $1, last_updated = NOW() WHERE product_id = $2 AND branch_id = $3',
        [item.available, productId, branchId]
      );
    } else {
      await DatabaseManager.query(
        'INSERT INTO inventory (product_id, branch_id, quantity, min_stock, last_updated, created_at) VALUES ($1, $2, $3, 0, NOW(), NOW())',
        [productId, branchId, item.available]
      );
    }
  }

  // Transaction synchronization methods

  public async syncTransactionsToOneC(startDate: Date, endDate: Date, branchId?: string): Promise<{ success: boolean; processed: number; errors: string[] }> {
    // 1C integration is one-way: 1C → chain-core only
    // Outbound synchronization is not supported
    console.warn('syncTransactionsToOneC called but outbound sync is disabled - 1C should pull data via API endpoints');
    
    return { 
      success: false, 
      processed: 0, 
      errors: ['Outbound synchronization is disabled - 1C integration is receive-only'] 
    };
  }

  private async exportTransactionToOneC(transaction: any): Promise<void> {
    // 1C integration is one-way: 1C → chain-core only
    // Outbound transaction export is not supported
    throw new Error('Outbound transaction export is disabled - 1C should retrieve data via API endpoints');
  }

  // Utility methods

  public async getLastSyncTimes(): Promise<{
    products_import: string | null;
    products_export: string | null;
    inventory_import: string | null;
    transactions_export: string | null;
  }> {
    return {
      products_import: await this.redisManager.get<string>('1c_last_product_sync'),
      products_export: await this.redisManager.get<string>('1c_last_product_export'),
      inventory_import: await this.redisManager.get<string>('1c_last_inventory_sync'),
      transactions_export: await this.redisManager.get<string>('1c_last_transaction_export')
    };
  }

  public async clearSyncCache(): Promise<void> {
    await this.redisManager.del('1c_last_product_sync');
    await this.redisManager.del('1c_last_product_export');
    await this.redisManager.del('1c_last_inventory_sync');
    await this.redisManager.del('1c_last_transaction_export');
  }

  public getConnectionStatus(): { connected: boolean; config: Partial<OneCConfig> } {
    return {
      connected: this.isConnected,
      config: {
        baseUrl: this.config.baseUrl,
        database: this.config.database,
        timeout: this.config.timeout
      }
    };
  }

  public async healthCheck(): Promise<{ status: string; latency: number; version?: string }> {
    // 1C integration is passive - we don't initiate connections to 1C
    // 1C connects to us, so we assume healthy status
    return {
      status: 'healthy',
      latency: 0,
      version: 'passive-receiver'
    };
  }

  // Initialize connection
  public async initialize(): Promise<void> {
    try {
      console.log('🔌 Initializing 1C integration...');
      
      // 1C integration is passive - only receives data from 1C
      // No outbound connection testing needed as 1C connects to us
      this.isConnected = true;
      console.log('✅ 1C integration initialized - ready to receive data from 1C');
    } catch (error) {
      console.error('❌ Failed to initialize 1C integration:', error);
      throw error;
    }
  }

  // Get status
  public getStatus(): { connected: boolean; lastSync?: Date; health?: any } {
    return {
      connected: this.isConnected,
      lastSync: undefined, // TODO: Implement last sync tracking
      health: undefined
    };
  }

  // Close connection
  public async close(): Promise<void> {
    try {
      this.isConnected = false;
      console.log('✅ 1C integration closed');
    } catch (error) {
      console.error('❌ Error closing 1C integration:', error);
      throw error;
    }
  }
}
