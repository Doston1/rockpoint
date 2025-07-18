import { NextFunction, Request, Response } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Generate request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object for future use
  (req as any).requestId = requestId;
  
  // Log incoming request
  console.log(`📥 [${new Date().toISOString()}] ${requestId} ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    authorization: req.get('Authorization') ? '[PRESENT]' : '[NONE]'
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    
    console.log(`📤 [${new Date().toISOString()}] ${requestId} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    
    // Call original end method with proper return
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

// Request validation logger
export const validationLogger = (field: string, error: string) => {
  console.warn(`⚠️ Validation failed for ${field}: ${error}`);
};

// API rate limiting logger
export const rateLimitLogger = (req: Request) => {
  console.warn(`🚫 Rate limit exceeded for IP: ${req.ip} on ${req.url}`);
};

// Authentication logger
export const authLogger = {
  loginAttempt: (req: Request, success: boolean, userId?: string) => {
    const status = success ? '✅ LOGIN SUCCESS' : '❌ LOGIN FAILED';
    console.log(`🔐 [${new Date().toISOString()}] ${status}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: userId || 'unknown',
      url: req.url
    });
  },
  
  tokenValidation: (req: Request, valid: boolean, userId?: string) => {
    const status = valid ? '✅ TOKEN VALID' : '❌ TOKEN INVALID';
    console.log(`🎫 [${new Date().toISOString()}] ${status}`, {
      ip: req.ip,
      userId: userId || 'unknown',
      url: req.url
    });
  },
  
  logout: (req: Request, userId: string) => {
    console.log(`🚪 [${new Date().toISOString()}] LOGOUT`, {
      ip: req.ip,
      userId,
      url: req.url
    });
  }
};

// Database operation logger
export const dbLogger = {
  query: (query: string, duration: number, rows?: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗄️ DB Query executed in ${duration}ms`, {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        rows: rows || 0
      });
    }
  },
  
  error: (query: string, error: Error) => {
    console.error(`❌ DB Query failed:`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      error: error.message
    });
  },
  
  transaction: (operation: string, success: boolean, duration?: number) => {
    const status = success ? '✅ TRANSACTION SUCCESS' : '❌ TRANSACTION FAILED';
    console.log(`💳 [${new Date().toISOString()}] ${status}`, {
      operation,
      duration: duration ? `${duration}ms` : 'unknown'
    });
  }
};

// WebSocket logger
export const wsLogger = {
  connection: (terminalId: string, ip: string) => {
    console.log(`🔗 [${new Date().toISOString()}] WS CONNECTED`, {
      terminalId,
      ip
    });
  },
  
  disconnection: (terminalId: string, reason?: string) => {
    console.log(`🔌 [${new Date().toISOString()}] WS DISCONNECTED`, {
      terminalId,
      reason: reason || 'unknown'
    });
  },
  
  message: (terminalId: string, messageType: string, size: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📨 [${new Date().toISOString()}] WS MESSAGE`, {
        terminalId: terminalId.substring(0, 8),
        type: messageType,
        size: `${size} bytes`
      });
    }
  },
  
  error: (terminalId: string, error: string) => {
    console.error(`❌ [${new Date().toISOString()}] WS ERROR`, {
      terminalId: terminalId.substring(0, 8),
      error
    });
  }
};

// Business logic logger
export const businessLogger = {
  transaction: {
    start: (transactionId: string, terminalId: string, userId: string) => {
      console.log(`🛒 [${new Date().toISOString()}] TRANSACTION START`, {
        transactionId,
        terminalId: terminalId.substring(0, 8),
        userId
      });
    },
    
    complete: (transactionId: string, total: number, paymentMethod: string) => {
      console.log(`✅ [${new Date().toISOString()}] TRANSACTION COMPLETE`, {
        transactionId,
        total: `$${total.toFixed(2)}`,
        paymentMethod
      });
    },
    
    void: (transactionId: string, reason: string, userId: string) => {
      console.log(`❌ [${new Date().toISOString()}] TRANSACTION VOID`, {
        transactionId,
        reason,
        userId
      });
    }
  },
  
  inventory: {
    update: (productId: string, oldQuantity: number, newQuantity: number, reason: string) => {
      console.log(`📦 [${new Date().toISOString()}] INVENTORY UPDATE`, {
        productId,
        change: newQuantity - oldQuantity,
        newQuantity,
        reason
      });
    },
    
    lowStock: (productId: string, currentQuantity: number, threshold: number) => {
      console.warn(`⚠️ [${new Date().toISOString()}] LOW STOCK ALERT`, {
        productId,
        currentQuantity,
        threshold
      });
    }
  },
  
  employee: {
    clockIn: (employeeId: string, terminalId: string) => {
      console.log(`⏰ [${new Date().toISOString()}] EMPLOYEE CLOCK IN`, {
        employeeId,
        terminalId: terminalId.substring(0, 8)
      });
    },
    
    clockOut: (employeeId: string, hoursWorked: number) => {
      console.log(`⏰ [${new Date().toISOString()}] EMPLOYEE CLOCK OUT`, {
        employeeId,
        hoursWorked: `${hoursWorked.toFixed(2)} hours`
      });
    }
  }
};
