import { NextFunction, Request, Response } from 'express';
import { DatabaseManager } from '../../database/manager';

// Extend Express Request interface to include branch info
declare global {
  namespace Express {
    interface Request {
      branchServer?: {
        id: string;
        branchId: string;
        branchCode: string;
        serverName: string;
        apiKey: string;
      };
    }
  }
}

/**
 * Authentication middleware specifically for branch server requests
 * Validates API key against branch_servers table
 */
export const authenticateBranchServer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Missing Authorization header',
        code: 'MISSING_AUTHORIZATION'
      });
    }

    // Extract API key (support both Bearer and ApiKey formats)
    let apiKey: string;
    
    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    } else if (authHeader.startsWith('ApiKey ')) {
      apiKey = authHeader.substring(7);
    } else {
      apiKey = authHeader;
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Authorization header format',
        code: 'INVALID_AUTH_FORMAT'
      });
    }

    // Validate API key against branch_servers table
    const result = await DatabaseManager.query(`
      SELECT 
        bs.id, 
        bs.branch_id,
        bs.server_name,
        bs.api_key,
        bs.status,
        bs.is_active,
        b.code as branch_code,
        b.name as branch_name,
        b.is_active as branch_is_active
      FROM branch_servers bs
      JOIN branches b ON bs.branch_id = b.id
      WHERE bs.api_key = $1
    `, [apiKey]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid branch API key',
        code: 'INVALID_API_KEY'
      });
    }

    const branchServerData = result.rows[0];

    // Check if branch server is inactive
    if (!branchServerData.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Branch server is inactive',
        code: 'BRANCH_SERVER_INACTIVE'
      });
    }

    // Check if branch is inactive
    if (!branchServerData.branch_is_active) {
      return res.status(401).json({
        success: false,
        error: 'Branch is inactive',
        code: 'BRANCH_INACTIVE'
      });
    }

    // Update last ping time for the branch server and set status to online
    await DatabaseManager.query(`
      UPDATE branch_servers 
      SET last_ping = NOW(), status = 'online'
      WHERE id = $1
    `, [branchServerData.id]);

    // Skip maintenance check if status was not explicitly set to maintenance
    // (allows automatic promotion from maintenance to online status)
    if (branchServerData.status === 'maintenance' && process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        success: false,
        error: 'Branch server is under maintenance',
        code: 'BRANCH_MAINTENANCE'
      });
    }

    // Add branch server info to request object
    req.branchServer = {
      id: branchServerData.id,
      branchId: branchServerData.branch_id,
      branchCode: branchServerData.branch_code,
      serverName: branchServerData.server_name,
      apiKey: branchServerData.api_key
    };

    next();
  } catch (error) {
    console.error('Branch server authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

/**
 * Helper function to create branch sync log
 */
export const createBranchSyncLog = async (
  branchId: string,
  syncType: string,
  direction: 'to_branch' | 'from_branch',
  totalRecords: number
): Promise<string> => {
  const result = await DatabaseManager.query(`
    INSERT INTO branch_sync_logs (
      branch_id, sync_type, direction, status, records_processed, started_at
    ) VALUES ($1, $2, $3, 'started', $4, NOW())
    RETURNING id
  `, [branchId, syncType, direction, totalRecords]);
  
  return result.rows[0].id;
};

/**
 * Helper function to complete branch sync log
 */
export const completeBranchSyncLog = async (
  syncId: string, 
  status: 'completed' | 'failed' | 'partial', 
  recordsProcessed: number, 
  errorMessage?: string
): Promise<void> => {
  await DatabaseManager.query(`
    UPDATE branch_sync_logs 
    SET status = $1, records_processed = $2, error_message = $3, completed_at = NOW()
    WHERE id = $4
  `, [status, recordsProcessed, errorMessage, syncId]);
};
