import { DatabaseManager } from '@/database/manager';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { authLogger } from '@/middleware/logger';
import { RedisManager } from '@/services/redis';
import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  terminalId: z.string().optional()
});

const changePasswordSchema = z.object({
  currentPin: z.string().min(4, 'Current PIN is required'),
  newPin: z.string().min(4, 'New PIN must be at least 4 characters'),
  confirmPin: z.string().min(4, 'Confirm PIN is required')
});

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { employeeId, pin, terminalId } = loginSchema.parse(req.body);

  // Query user from database
  const userQuery = `
    SELECT id, employee_id, name, role, pin_hash, status, last_login
    FROM employees 
    WHERE employee_id = $1 AND status = 'active'
  `;
  
  const result = await DatabaseManager.query(userQuery, [employeeId]);
  const user = result.rows[0];

  if (!user) {
    authLogger.loginAttempt(req, false, employeeId);
    throw createError('Invalid employee ID or PIN', 401);
  }

  // Verify PIN
  const isValidPin = await bcrypt.compare(pin, user.pin_hash);
  if (!isValidPin) {
    authLogger.loginAttempt(req, false, employeeId);
    throw createError('Invalid employee ID or PIN', 401);
  }

  // Generate JWT token
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw createError('JWT_SECRET not configured', 500);
  }
  
  const token = jwt.sign(
    { 
      userId: user.id, 
      employeeId: user.employee_id,
      role: user.role 
    } as jwt.JwtPayload,
    jwtSecret as jwt.Secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
  );

  // Store session in Redis
  const sessionData = {
    userId: user.id,
    employeeId: user.employee_id,
    name: user.name,
    role: user.role,
    terminalId,
    loginTime: new Date().toISOString()
  };
  
  await RedisManager.setSession(token, sessionData);

  // Update last login
  await DatabaseManager.query(
    'UPDATE employees SET last_login = NOW() WHERE id = $1',
    [user.id]
  );

  authLogger.loginAttempt(req, true, user.employee_id);

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        employeeId: user.employee_id,
        name: user.name,
        role: user.role
      },
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  });
}));

// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    // Get session data before deleting
    const sessionData = await RedisManager.getSession(token);
    
    // Delete session from Redis
    await RedisManager.deleteSession(token);
    
    if (sessionData) {
      authLogger.logout(req, sessionData.employeeId);
    }
  }

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// POST /api/auth/verify
router.post('/verify', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw createError('No token provided', 401);
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Check if session exists in Redis
    const sessionData = await RedisManager.getSession(token);
    if (!sessionData) {
      throw createError('Session expired', 401);
    }

    // Verify user still exists and is active
    const userQuery = `
      SELECT id, employee_id, name, role, status
      FROM employees 
      WHERE id = $1 AND status = 'active'
    `;
    
    const result = await DatabaseManager.query(userQuery, [decoded.userId]);
    const user = result.rows[0];

    if (!user) {
      await RedisManager.deleteSession(token);
      throw createError('User not found or inactive', 401);
    }

    authLogger.tokenValidation(req, true, user.employee_id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          employeeId: user.employee_id,
          name: user.name,
          role: user.role
        },
        session: {
          loginTime: sessionData.loginTime,
          terminalId: sessionData.terminalId
        }
      }
    });
  } catch (error: any) {
    authLogger.tokenValidation(req, false);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw createError('Invalid or expired token', 401);
    }
    throw error;
  }
}));

// POST /api/auth/change-pin
router.post('/change-pin', asyncHandler(async (req: Request, res: Response) => {
  const { currentPin, newPin, confirmPin } = changePasswordSchema.parse(req.body);
  
  if (newPin !== confirmPin) {
    throw createError('New PIN and confirm PIN do not match', 400);
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw createError('Authentication required', 401);
  }

  // Get session data
  const sessionData = await RedisManager.getSession(token);
  if (!sessionData) {
    throw createError('Session expired', 401);
  }

  // Get current user data
  const userQuery = `
    SELECT id, pin_hash
    FROM employees 
    WHERE id = $1 AND status = 'active'
  `;
  
  const result = await DatabaseManager.query(userQuery, [sessionData.userId]);
  const user = result.rows[0];

  if (!user) {
    throw createError('User not found', 404);
  }

  // Verify current PIN
  const isValidCurrentPin = await bcrypt.compare(currentPin, user.pin_hash);
  if (!isValidCurrentPin) {
    throw createError('Current PIN is incorrect', 400);
  }

  // Hash new PIN
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const newPinHash = await bcrypt.hash(newPin, saltRounds);

  // Update PIN in database
  await DatabaseManager.query(
    'UPDATE employees SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
    [newPinHash, user.id]
  );

  res.json({
    success: true,
    message: 'PIN changed successfully'
  });
}));

// GET /api/auth/sessions
router.get('/sessions', asyncHandler(async (req: Request, res: Response) => {
  // Get all active sessions from Redis
  // This would be used by managers to see who's logged in
  const terminalKeys = await RedisManager.getActiveTerminals();
  const sessions = [];

  for (const key of terminalKeys) {
    const terminalData = await RedisManager.get(key);
    if (terminalData && terminalData.userId) {
      sessions.push({
        terminalId: terminalData.id,
        terminalName: terminalData.name,
        userId: terminalData.userId,
        userRole: terminalData.userRole,
        status: terminalData.status,
        lastActivity: terminalData.lastActivity
      });
    }
  }

  res.json({
    success: true,
    data: {
      activeSessions: sessions.length,
      sessions
    }
  });
}));

// Temporary endpoint to generate hash - remove after use
router.get('/generate-hash/:pin', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.params;
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const hash = await bcrypt.hash(pin, saltRounds);
  
  res.json({
    pin,
    hash,
    sql: `UPDATE employees SET pin_hash = '${hash}' WHERE employee_id = 'admin';`
  });
}));

export default router;
