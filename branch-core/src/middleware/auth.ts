import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { DatabaseManager } from '../database/manager';

// Extend Request type to include authenticated API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        name: string;
        permissions: string[];
        branch_id?: string; // Optional - only used in chain-core
      };
    }
  }
}

// Generate a new API key with rp_ prefix
export function generateApiKey(): string {
  return 'rp_' + crypto.randomBytes(32).toString('hex');
}

// Hash API key for storage
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Verify API key against hash
export function verifyApiKey(apiKey: string, hash: string): boolean {
  return hashApiKey(apiKey) === hash;
}

// Main authentication middleware
export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let apiKey: string | undefined;

    // Extract API key from different possible headers
    const authHeader = req.headers.authorization;
    if (authHeader) {
      // Support multiple formats:
      // Authorization: Bearer rp_key
      // Authorization: ApiKey rp_key  
      // Authorization: rp_key
      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      } else if (authHeader.startsWith('ApiKey ')) {
        apiKey = authHeader.substring(7);
      } else if (authHeader.startsWith('rp_')) {
        apiKey = authHeader;
      }
    }

    // Also check x-api-key header
    if (!apiKey && req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key'] as string;
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Please provide a valid API key in Authorization header'
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('rp_') || apiKey.length !== 67) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format',
        message: 'API key must start with rp_ and be properly formatted'
      });
    }

    // Hash the provided API key
    const keyHash = hashApiKey(apiKey);

    // Look up API key in database
    const result = await DatabaseManager.query(`
      SELECT 
        id,
        name,
        permissions,
        is_active,
        expires_at
      FROM api_keys 
      WHERE key_hash = $1 AND is_active = true
    `, [keyHash]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been deactivated'
      });
    }

    const keyData = result.rows[0];

    // Check if key has expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'API key expired',
        message: 'The provided API key has expired'
      });
    }

    // Update last used timestamp and usage count
    await DatabaseManager.query(`
      UPDATE api_keys 
      SET last_used_at = NOW(), usage_count = usage_count + 1
      WHERE id = $1
    `, [keyData.id]);

    // Attach API key info to request
    req.apiKey = {
      id: keyData.id,
      name: keyData.name,
      permissions: keyData.permissions
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'An error occurred while validating the API key'
    });
  }
};

// Permission checking middleware
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'API key authentication is required for this endpoint'
      });
    }

    const { permissions } = req.apiKey;

    // Check if user has the specific permission or wildcard permission
    if (!permissions.includes(permission) && !permissions.includes('*')) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This endpoint requires '${permission}' permission`
      });
    }

    next();
  };
};

// Branch access control middleware  
export const requireBranchAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'API key authentication is required for this endpoint'
    });
  }

  // In branch-core, API keys are not tied to specific branches
  // since each branch-core instance only serves one branch
  // This middleware is mainly for chain-core compatibility
  next();
};
