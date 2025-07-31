import dotenv from 'dotenv';
import { createClient, RedisClientType } from 'redis';

dotenv.config();

export class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
      },
    });

    this.setupEventHandlers();
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

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error: Error) => {
      console.error('❌ Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('🔚 Redis client connection closed');
      this.isConnected = false;
    });
  }

  private async connect(): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.isConnected && this.client.isOpen) {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing Redis connection:', error);
      throw error;
    }
  }

  public isConnectionHealthy(): boolean {
    return this.isConnected && this.client.isOpen;
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
      return value;
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

  // Cache operations
  public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse Redis value:', error);
      return null;
    }
  }

  public async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  public async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    return await this.client.expire(key, seconds);
  }

  public async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  // Hash operations
  public async hset(key: string, field: string, value: any): Promise<number> {
    return await this.client.hSet(key, field, JSON.stringify(value));
  }

  public async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hGet(key, field);
    if (value === null || value === undefined) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse Redis hash value:', error);
      return null;
    }
  }

  public async hgetall<T>(key: string): Promise<Record<string, T>> {
    const values = await this.client.hGetAll(key);
    const result: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(values)) {
      if (typeof value === 'string') {
        try {
          result[field] = JSON.parse(value) as T;
        } catch (error) {
          console.error('Failed to parse Redis hash value:', error);
        }
      }
    }
    
    return result;
  }

  public async hdel(key: string, field: string): Promise<number> {
    return await this.client.hDel(key, field);
  }

  // List operations
  public async lpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(v => JSON.stringify(v));
    return await this.client.lPush(key, serializedValues);
  }

  public async rpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(v => JSON.stringify(v));
    return await this.client.rPush(key, serializedValues);
  }

  public async lpop<T>(key: string): Promise<T | null> {
    const value = await this.client.lPop(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse Redis list value:', error);
      return null;
    }
  }

  public async rpop<T>(key: string): Promise<T | null> {
    const value = await this.client.rPop(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to parse Redis list value:', error);
      return null;
    }
  }

  public async llen(key: string): Promise<number> {
    return await this.client.lLen(key);
  }

  // Set operations
  public async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sAdd(key, members);
  }

  public async srem(key: string, ...members: string[]): Promise<number> {
    return await this.client.sRem(key, members);
  }

  public async smembers(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  public async sismember(key: string, member: string): Promise<boolean> {
    return await this.client.sIsMember(key, member);
  }

  // Pub/Sub operations
  public async publish(channel: string, message: any): Promise<number> {
    return await this.client.publish(channel, JSON.stringify(message));
  }

  public async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, (message: string, receivedChannel: string) => {
      if (receivedChannel === channel) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          console.error('Failed to parse Redis pub/sub message:', error);
        }
      }
    });
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

  public async setSession(sessionId: string, sessionData: any, ttlSeconds: number = 3600): Promise<void> {
    await this.set(`session:${sessionId}`, sessionData, ttlSeconds);
  }

  public async getSession<T>(sessionId: string): Promise<T | null> {
    return await this.get<T>(`session:${sessionId}`);
  }

  public async deleteSession(sessionId: string): Promise<number> {
    return await this.del(`session:${sessionId}`);
  }

  // POS terminal tracking
  public static async registerTerminal(terminalId: string, data: any): Promise<void> {
    const terminalKey = `terminal:${terminalId}`;
    await RedisManager.set(terminalKey, data, 3600); // 1 hour expiry
  }

  public static async getTerminal(terminalId: string): Promise<any> {
    const terminalKey = `terminal:${terminalId}`;
    return await RedisManager.get(terminalKey);
  }

  public static async getActiveTerminals(): Promise<string[]> {
    const client = RedisManager.getClient();
    const keys = await client.keys('terminal:*');
    return keys.map(key => key.replace('terminal:', ''));
  }

  // Product cache
  public static async cacheProduct(productId: string, productData: any): Promise<void> {
    const productKey = `product:${productId}`;
    await RedisManager.set(productKey, productData, 1800); // 30 minutes
  }

  public static async getCachedProduct(productId: string): Promise<any> {
    const productKey = `product:${productId}`;
    return await RedisManager.get(productKey);
  }

  // Transaction cache for offline sync
  public static async cacheTransaction(transactionId: string, transactionData: any): Promise<void> {
    const transactionKey = `transaction:${transactionId}`;
    await RedisManager.set(transactionKey, transactionData, 7200); // 2 hours
  }

  public static async getPendingTransactions(): Promise<any[]> {
    const client = RedisManager.getClient();
    const keys = await client.keys('transaction:*');
    const transactions = [];
    
    for (const key of keys) {
      const transaction = await client.get(key);
      if (transaction) {
        try {
          transactions.push(JSON.parse(transaction));
        } catch (error) {
          console.error('Failed to parse cached transaction:', error);
        }
      }
    }
    
    return transactions;
  }

  // Cache invalidation patterns
  public async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    return await this.client.del(keys);
  }

  // Rate limiting
  public async rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    
    const ttl = await this.client.ttl(key);
    const resetTime = Date.now() + (ttl * 1000);
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetTime
    };
  }

  // Health check
  public async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.client.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', latency: -1 };
    }
  }

  // Get connection status
  public getConnectionInfo(): any {
    return {
      connected: this.isConnected,
      status: this.client.isOpen ? 'open' : 'closed',
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    };
  }
}
