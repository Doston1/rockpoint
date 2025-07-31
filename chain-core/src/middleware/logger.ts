import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface LoggerRequest extends Request {
  id?: string;
  startTime?: number;
}

export const requestLogger = (req: LoggerRequest, res: Response, next: NextFunction): void => {
  req.id = uuidv4();
  req.startTime = Date.now();

  const originalJson = res.json;
  res.json = function (body: any) {
    const duration = Date.now() - (req.startTime || 0);
    
    console.log(`📝 ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, {
      id: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return originalJson.call(this, body);
  };

  next();
};

export class AuthLogger {
  static loginAttempt(req: Request, success: boolean, employeeId?: string): void {
    const message = success ? 'Login successful' : 'Login failed';
    console.log(`🔐 ${message}`, {
      employeeId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      success
    });
  }

  static logout(req: Request, employeeId?: string): void {
    console.log('🚪 User logout', {
      employeeId,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }

  static tokenVerification(req: Request, success: boolean, error?: string): void {
    if (!success) {
      console.log('🚫 Token verification failed', {
        error,
        url: req.originalUrl,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export class SyncLogger {
  static syncStart(syncType: string, direction: 'import' | 'export'): void {
    console.log(`🔄 Sync started`, {
      syncType,
      direction,
      timestamp: new Date().toISOString()
    });
  }

  static syncComplete(syncType: string, direction: 'import' | 'export', recordsProcessed: number, duration: number): void {
    console.log(`✅ Sync completed`, {
      syncType,
      direction,
      recordsProcessed,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }

  static syncError(syncType: string, direction: 'import' | 'export', error: string): void {
    console.error(`❌ Sync failed`, {
      syncType,
      direction,
      error,
      timestamp: new Date().toISOString()
    });
  }
}

export class DatabaseLogger {
  static queryError(query: string, error: any): void {
    console.error('❌ Database query error:', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  static slowQuery(query: string, duration: number): void {
    if (duration > 1000) { // Log queries taking more than 1 second
      console.warn('🐌 Slow query detected:', {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
  }
}
