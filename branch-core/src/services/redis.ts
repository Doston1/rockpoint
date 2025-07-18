import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';

dotenv.config();

export class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  private isConnected = false;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
      },
    });

    // Event handlers
    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      console.log('🔚 Redis client disconnected');
      this.isConnected = false;
    });
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = RedisManager.getInstance();
    await instance.connect();
  }

  public static getClient(): RedisClientType {
    return RedisManager.getInstance().client;
  }

  public static async close(): Promise<void> {
    const instance = RedisManager.getInstance();
    await instance.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log('✅ Redis connection established');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
      }
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
      throw error;
    }
  }

  // Cache utilities
  public static async set(
    key: string, 
    value: any, 
    expireInSeconds?: number
  ): Promise<void> {
    const client = RedisManager.getClient();
    const serializedValue = JSON.stringify(value);
    
    if (expireInSeconds) {
      await client.setEx(key, expireInSeconds, serializedValue);
    } else {
      await client.set(key, serializedValue);
    }
  }

  public static async get(key: string): Promise<any> {
    const client = RedisManager.getClient();
    const value = await client.get(key);
    
    if (value === null) {
      return null;
    }
    
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as string if JSON parsing fails
    }
  }

  public static async del(key: string): Promise<number> {
    const client = RedisManager.getClient();
    return await client.del(key);
  }

  public static async exists(key: string): Promise<boolean> {
    const client = RedisManager.getClient();
    return (await client.exists(key)) === 1;
  }

  public static async expire(key: string, seconds: number): Promise<boolean> {
    const client = RedisManager.getClient();
    return await client.expire(key, seconds);
  }

  // Session management
  public static async setSession(
    sessionId: string, 
    data: any, 
    expireInSeconds = 86400 // 24 hours default
  ): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    await RedisManager.set(sessionKey, data, expireInSeconds);
  }

  public static async getSession(sessionId: string): Promise<any> {
    const sessionKey = `session:${sessionId}`;
    return await RedisManager.get(sessionKey);
  }

  public static async deleteSession(sessionId: string): Promise<number> {
    const sessionKey = `session:${sessionId}`;
    return await RedisManager.del(sessionKey);
  }

  // POS terminal tracking
  public static async registerTerminal(terminalId: string, data: any): Promise<void> {
    const terminalKey = `terminal:${terminalId}`;
    await RedisManager.set(terminalKey, {
      ...data,
      lastSeen: new Date().toISOString(),
      status: 'online'
    }, 300); // 5 minutes expiry
  }

  public static async getTerminal(terminalId: string): Promise<any> {
    const terminalKey = `terminal:${terminalId}`;
    return await RedisManager.get(terminalKey);
  }

  public static async getActiveTerminals(): Promise<string[]> {
    const client = RedisManager.getClient();
    return await client.keys('terminal:*');
  }

  // Product cache
  public static async cacheProduct(productId: string, productData: any): Promise<void> {
    const productKey = `product:${productId}`;
    await RedisManager.set(productKey, productData, 3600); // 1 hour cache
  }

  public static async getCachedProduct(productId: string): Promise<any> {
    const productKey = `product:${productId}`;
    return await RedisManager.get(productKey);
  }

  // Transaction cache for offline sync
  public static async cacheTransaction(transactionId: string, transactionData: any): Promise<void> {
    const transactionKey = `transaction:${transactionId}`;
    await RedisManager.set(transactionKey, transactionData, 604800); // 7 days
  }

  public static async getPendingTransactions(): Promise<any[]> {
    const client = RedisManager.getClient();
    const keys = await client.keys('transaction:*');
    const transactions = [];
    
    for (const key of keys) {
      const transaction = await RedisManager.get(key);
      if (transaction) {
        transactions.push(transaction);
      }
    }
    
    return transactions;
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Get connection status
  public getConnectionInfo(): any {
    return {
      isConnected: this.isConnected,
      ready: this.client.isReady,
      open: this.client.isOpen
    };
  }
}
