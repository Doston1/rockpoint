import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';

dotenv.config();

export class DatabaseManager {
  private static instance: DatabaseManager;
  private pool: Pool;
  private isInitialized = false;

  private constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rockpoint_branch',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20, // Maximum number of connections in the pool
      idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
      connectionTimeoutMillis: 2000, // How long to wait for a connection
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
      console.log('✅ PostgreSQL connection established');
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Query executed:', { text, duration: `${duration}ms`, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error);
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
      console.log('✅ PostgreSQL connection closed');
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
}
