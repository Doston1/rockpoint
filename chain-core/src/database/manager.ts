import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';

dotenv.config();

export class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool;
  private isInitialized = false;
  private verboseLogging = true;

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rockpoint_chain',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 30, // Maximum number of connections in the pool (higher for main office)
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = DatabaseManager.getInstance();
    await instance.connect();
  }

  public static getPool(): Pool {
    return DatabaseManager.getInstance().pool;
  }

  public static async query(text: string, params?: any[]): Promise<any> {
    const instance = DatabaseManager.getInstance();
    return instance.executeQuery(text, params);
  }

  public static async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const instance = DatabaseManager.getInstance();
    return instance.executeTransaction(callback);
  }

  public static async close(): Promise<void> {
    const instance = DatabaseManager.getInstance();
    await instance.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isInitialized = true;
      console.log('✅ PostgreSQL connection established (Chain Core)');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL:', error);
      throw error;
    }
  }

  private async executeQuery(text: string, params?: any[]): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Only log verbose query info if enabled and in development
      if (process.env.NODE_ENV === 'development' && this.verboseLogging) {
        // Skip logging frequent sync task updates to reduce noise
        const isSyncTaskUpdate = text.includes('UPDATE sync_tasks');
        
        if (!isSyncTaskUpdate) {
          console.log('📊 Query executed:', { 
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
            duration: `${duration}ms`, 
            rows: result.rowCount 
          });
        }
      }
      
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error);
      console.error('Query text:', text);
      console.error('Query params:', params);
      throw error;
    }
  }

  private async executeTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isInitialized = false;
      console.log('✅ PostgreSQL connection closed (Chain Core)');
    } catch (error) {
      console.error('❌ Error closing PostgreSQL connection:', error);
      throw error;
    }
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeQuery('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch {
      return false;
    }
  }

  // Get connection info
  public getConnectionInfo(): any {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      isInitialized: this.isInitialized
    };
  }

  // Chain-specific helper methods
  public async getBranchCount(): Promise<number> {
    const result = await this.executeQuery('SELECT COUNT(*) as count FROM branches WHERE is_active = true');
    return parseInt(result.rows[0].count);
  }

  public async getEmployeeCount(): Promise<number> {
    const result = await this.executeQuery('SELECT COUNT(*) as count FROM employees WHERE status = \'active\'');
    return parseInt(result.rows[0].count);
  }

  public async getProductCount(): Promise<number> {
    const result = await this.executeQuery('SELECT COUNT(*) as count FROM products WHERE is_active = true');
    return parseInt(result.rows[0].count);
  }

  public async getTotalSalesToday(): Promise<number> {
    const result = await this.executeQuery(`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM transactions 
      WHERE status = 'completed' 
      AND DATE(completed_at) = CURRENT_DATE
    `);
    return parseFloat(result.rows[0].total);
  }

  public async getLastSyncStatus(): Promise<any> {
    const result = await this.executeQuery(`
      SELECT 
        sync_type,
        status,
        completed_at,
        records_processed,
        records_failed
      FROM oneC_sync_logs 
      ORDER BY started_at DESC 
      LIMIT 5
    `);
    return result.rows;
  }

  // Control verbose logging
  public setVerboseLogging(enabled: boolean): void {
    this.verboseLogging = enabled;
  }

  public static setVerboseLogging(enabled: boolean): void {
    const instance = DatabaseManager.getInstance();
    instance.setVerboseLogging(enabled);
  }
}
