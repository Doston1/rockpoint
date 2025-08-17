import { NextFunction, Request, Response } from 'express';
import { DatabaseManager } from '../database/manager';

// Extend Express Request interface to include apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        name: string;
        permissions: string[];
      };
    }
  }
}

export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Missing Authorization header',
        code: 'MISSING_AUTH_HEADER'
      });
    }

    // Check if it's Bearer token format or API key format
    let apiKey: string;
    
    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7); // Remove "Bearer " prefix
    } else if (authHeader.startsWith('ApiKey ')) {
      apiKey = authHeader.substring(7); // Remove "ApiKey " prefix
    } else {
      // Direct API key (for backward compatibility)
      apiKey = authHeader;
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Authorization header format',
        code: 'INVALID_AUTH_FORMAT'
      });
    }

    // Validate API key in database
    const result = await DatabaseManager.query(`
      SELECT 
        id, 
        name, 
        permissions, 
        is_active, 
        expires_at,
        last_used_at
      FROM api_keys 
      WHERE key_hash = $1 AND is_active = true
    `, [apiKey]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    const keyData = result.rows[0];

    // Check if API key has expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'API key has expired',
        code: 'EXPIRED_API_KEY'
      });
    }

    // Update last used timestamp
    await DatabaseManager.query(`
      UPDATE api_keys 
      SET last_used_at = NOW(), usage_count = usage_count + 1
      WHERE id = $1
    `, [keyData.id]);

    // Add API key info to request object
    req.apiKey = {
      id: keyData.id,
      name: keyData.name,
      permissions: keyData.permissions || []
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('*')) {
      return res.status(403).json({
        success: false,
        error: `Insufficient permissions. Required: ${permission}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// Helper function to generate API key
export const generateApiKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'rp_'; // Prefix for RockPoint
  
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};
