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
    try {
      const response = await this.client.get('/info/version');
      this.isConnected = true;
      
      return {
        success: true,
        message: 'Successfully connected to 1C',
        version: response.data.version
      };
    } catch (error) {
      this.isConnected = false;
      const message = error instanceof Error ? error.message : 'Connection failed';
      
      return {
        success: false,
        message: `Failed to connect to 1C: ${message}`
      };
    }
  }

  // Product synchronization methods

  public async syncProductsFromOneC(): Promise<{ success: boolean; processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      console.log('Starting product sync from 1C...');
      
      const response = await this.client.get('/odata/standard.odata/Catalog_Номенклатура');
      const products: OneCProduct[] = response.data.value;

      for (const oneCProduct of products) {
        try {
          await this.processProduct(oneCProduct);
          processed++;
        } catch (error) {
          const errorMessage = `Failed to process product ${oneCProduct.sku}: ${error}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      // Cache sync timestamp
      await this.redisManager.set('1c_last_product_sync', new Date().toISOString(), 3600);

      console.log(`Product sync completed: ${processed} processed, ${errors.length} errors`);
      
      return { success: errors.length === 0, processed, errors };

    } catch (error) {
      const errorMessage = `Product sync failed: ${error}`;
      console.error(errorMessage);
      return { success: false, processed, errors: [errorMessage] };
    }
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
    const errors: string[] = [];
    let processed = 0;

    try {
      console.log('Starting product sync to 1C...');
      
      // Get products updated since last sync
      const lastSync = await this.redisManager.get<string>('1c_last_product_export');
      const lastSyncDate = lastSync ? new Date(lastSync) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await DatabaseManager.query(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.updated_at > $1 AND p.is_active = true
      `, [lastSyncDate]);

      for (const product of result.rows) {
        try {
          await this.exportProductToOneC(product);
          processed++;
        } catch (error) {
          const errorMessage = `Failed to export product ${product.sku}: ${error}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      // Update sync timestamp
      await this.redisManager.set('1c_last_product_export', new Date().toISOString(), 3600);

      console.log(`Product export completed: ${processed} processed, ${errors.length} errors`);
      
      return { success: errors.length === 0, processed, errors };

    } catch (error) {
      const errorMessage = `Product export failed: ${error}`;
      console.error(errorMessage);
      return { success: false, processed, errors: [errorMessage] };
    }
  }

  private async exportProductToOneC(product: any): Promise<void> {
    const oneCProduct = {
      Код: product.sku,
      Наименование: product.name,
      Штрихкод: product.barcode,
      Цена: product.price,
      Себестоимость: product.cost,
      Группа: product.category_name || 'Общая',
      ЕдиницаИзмерения: product.unit,
      Активен: product.is_active
    };

    await this.client.post('/odata/standard.odata/Catalog_Номенклатура', oneCProduct);
  }

  // Inventory synchronization methods

  public async syncInventoryFromOneC(branchCode?: string): Promise<{ success: boolean; processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      console.log('Starting inventory sync from 1C...');
      
      let url = '/odata/standard.odata/AccumulationRegister_ТоварыНаСкладах/Turnovers';
      if (branchCode) {
        url += `?$filter=Склад eq '${branchCode}'`;
      }

      const response = await this.client.get(url);
      const inventoryItems: OneCInventory[] = response.data.value;

      for (const item of inventoryItems) {
        try {
          await this.processInventoryItem(item);
          processed++;
        } catch (error) {
          const errorMessage = `Failed to process inventory item: ${error}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      await this.redisManager.set('1c_last_inventory_sync', new Date().toISOString(), 3600);

      console.log(`Inventory sync completed: ${processed} processed, ${errors.length} errors`);
      
      return { success: errors.length === 0, processed, errors };

    } catch (error) {
      const errorMessage = `Inventory sync failed: ${error}`;
      console.error(errorMessage);
      return { success: false, processed, errors: [errorMessage] };
    }
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
    const errors: string[] = [];
    let processed = 0;

    try {
      console.log('Starting transaction sync to 1C...');
      
      let query = `
        SELECT 
          t.id, t.total_amount, t.tax_amount, t.payment_method, t.created_at,
          b.code as branch_code, e.name as employee_name,
          json_agg(
            json_build_object(
              'product_sku', p.sku,
              'quantity', ti.quantity,
              'price', ti.price,
              'total_amount', ti.total_amount
            )
          ) as items
        FROM transactions t
        JOIN branches b ON t.branch_id = b.id
        JOIN employees e ON t.employee_id = e.id
        JOIN transaction_items ti ON t.id = ti.transaction_id
        JOIN products p ON ti.product_id = p.id
        WHERE t.status = 'completed'
        AND t.created_at BETWEEN $1 AND $2
      `;

      const params: (Date | string)[] = [startDate, endDate];

      if (branchId) {
        query += ` AND t.branch_id = $3`;
        params.push(branchId);
      }

      query += ` GROUP BY t.id, t.total_amount, t.tax_amount, t.payment_method, t.created_at, b.code, e.name`;

      const result = await DatabaseManager.query(query, params);

      for (const transaction of result.rows) {
        try {
          await this.exportTransactionToOneC(transaction);
          processed++;
        } catch (error) {
          const errorMessage = `Failed to export transaction ${transaction.id}: ${error}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      await this.redisManager.set('1c_last_transaction_export', new Date().toISOString(), 3600);

      console.log(`Transaction export completed: ${processed} processed, ${errors.length} errors`);
      
      return { success: errors.length === 0, processed, errors };

    } catch (error) {
      const errorMessage = `Transaction export failed: ${error}`;
      console.error(errorMessage);
      return { success: false, processed, errors: [errorMessage] };
    }
  }

  private async exportTransactionToOneC(transaction: any): Promise<void> {
    // Convert transaction to 1C format
    const oneCTransaction = {
      Номер: transaction.id,
      Дата: transaction.created_at,
      Магазин: transaction.branch_code,
      Кассир: transaction.employee_name,
      СуммаДокумента: transaction.total_amount,
      СуммаНДС: transaction.tax_amount,
      ВидОплаты: transaction.payment_method,
      Товары: transaction.items.map((item: any) => ({
        Номенклатура: item.product_sku,
        Количество: item.quantity,
        Цена: item.price,
        Сумма: item.total_amount
      }))
    };

    await this.client.post('/odata/standard.odata/Document_ЧекККМ', oneCTransaction);
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
    const start = Date.now();
    
    try {
      const response = await this.client.get('/info/version', { timeout: 5000 });
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        version: response.data.version
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start
      };
    }
  }

  // Initialize connection
  public async initialize(): Promise<void> {
    try {
      console.log('🔌 Initializing 1C integration...');
      
      // Test connection
      const health = await this.healthCheck();
      if (health.status === 'healthy') {
        this.isConnected = true;
        console.log('✅ 1C integration initialized successfully');
      } else {
        console.warn('⚠️ 1C integration initialized but connection unhealthy');
      }
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
