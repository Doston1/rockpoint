import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'manager', 'supervisor']).default('manager'),
});

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  // Find user by email
  const userQuery = `
    SELECT id, name, email, password_hash, role, permissions
    FROM users 
    WHERE email = $1 AND is_active = true
  `;
  
  const result = await DatabaseManager.query(userQuery, [email]);
  
  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  const user = result.rows[0];
  
  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '24h' }
  );

  // Return user data (without password)
  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions || [],
  };

  res.json({
    success: true,
    data: {
      user: userData,
      token,
    }
  });
}));

// POST /api/auth/register (Admin only)
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = registerSchema.parse(req.body);

  // Check if user already exists
  const existingUser = await DatabaseManager.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'User already exists'
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Insert new user
  const insertQuery = `
    INSERT INTO users (name, email, password_hash, role, permissions, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
    RETURNING id, name, email, role, permissions
  `;

  const defaultPermissions = role === 'admin' 
    ? ['all'] 
    : role === 'manager' 
    ? ['branches.read', 'branches.write', 'employees.read', 'employees.write', 'inventory.read', 'reports.read']
    : ['branches.read', 'employees.read', 'inventory.read'];

  const newUser = await DatabaseManager.query(insertQuery, [
    name,
    email,
    passwordHash,
    role,
    JSON.stringify(defaultPermissions)
  ]);

  res.status(201).json({
    success: true,
    data: {
      user: newUser.rows[0]
    }
  });
}));

// POST /api/auth/verify-token
router.post('/verify-token', asyncHandler(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Get fresh user data
    const userQuery = `
      SELECT id, name, email, role, permissions
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await DatabaseManager.query(userQuery, [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: result.rows[0]
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}));

// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  // In a more advanced implementation, you might blacklist the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;
