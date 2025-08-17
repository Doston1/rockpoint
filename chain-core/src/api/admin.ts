import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { generateApiKey } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  expires_at: z.string().optional()
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  expires_at: z.string().optional()
});

// GET /api/admin/api-keys - List all API keys
router.get('/api-keys', asyncHandler(async (req: Request, res: Response) => {
  const result = await DatabaseManager.query(`
    SELECT 
      id,
      name,
      description,
      permissions,
      is_active,
      created_at,
      updated_at,
      expires_at,
      last_used_at,
      usage_count,
      SUBSTRING(key_hash, 1, 8) || '...' as key_preview
    FROM api_keys
    ORDER BY created_at DESC
  `);

  res.json({
    success: true,
    data: {
      api_keys: result.rows
    }
  });
}));

// POST /api/admin/api-keys - Create new API key
router.post('/api-keys', asyncHandler(async (req: Request, res: Response) => {
  const data = createApiKeySchema.parse(req.body);
  
  // Generate new API key
  const apiKey = generateApiKey();
  
  // Insert into database
  const result = await DatabaseManager.query(`
    INSERT INTO api_keys (
      name, key_hash, description, permissions, expires_at
    ) VALUES (
      $1, $2, $3, $4, $5
    ) RETURNING id, name, description, permissions, is_active, created_at, expires_at
  `, [
    data.name,
    apiKey,
    data.description || null,
    data.permissions,
    data.expires_at || null
  ]);

  res.status(201).json({
    success: true,
    data: {
      api_key_info: result.rows[0],
      api_key: apiKey, // Only returned on creation
      warning: 'Store this API key securely. It will not be shown again.'
    }
  });
}));

// PUT /api/admin/api-keys/:id - Update API key
router.put('/api-keys/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateApiKeySchema.parse(req.body);
  
  // Build dynamic update query
  const updateFields = [];
  const params = [];
  let paramCount = 1;
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      params.push(value);
      paramCount++;
    }
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid fields provided for update'
    });
  }
  
  updateFields.push(`updated_at = NOW()`);
  params.push(id);
  
  const result = await DatabaseManager.query(`
    UPDATE api_keys 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id, name, description, permissions, is_active, updated_at, expires_at
  `, params);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'API key not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      api_key_info: result.rows[0]
    }
  });
}));

// DELETE /api/admin/api-keys/:id - Delete API key
router.delete('/api-keys/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(`
    DELETE FROM api_keys 
    WHERE id = $1
    RETURNING name
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'API key not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `API key "${result.rows[0].name}" has been deleted`
    }
  });
}));

// POST /api/admin/api-keys/:id/regenerate - Regenerate API key
router.post('/api-keys/:id/regenerate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Generate new API key
  const newApiKey = generateApiKey();
  
  const result = await DatabaseManager.query(`
    UPDATE api_keys 
    SET key_hash = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, name, description, permissions, is_active
  `, [newApiKey, id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'API key not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      api_key_info: result.rows[0],
      api_key: newApiKey, // Only returned on regeneration
      warning: 'Store this new API key securely. The old key is now invalid.'
    }
  });
}));

// GET /api/admin/api-keys/permissions - Get available permissions
router.get('/api-keys/permissions', asyncHandler(async (req: Request, res: Response) => {
  const availablePermissions = [
    { name: 'products:read', description: 'Read product data' },
    { name: 'products:write', description: 'Create and update products' },
    { name: 'inventory:read', description: 'Read inventory levels' },
    { name: 'inventory:write', description: 'Update inventory levels' },
    { name: 'employees:read', description: 'Read employee data' },
    { name: 'employees:write', description: 'Create and update employees' },
    { name: 'transactions:read', description: 'Read transaction data' },
    { name: 'sync:execute', description: 'Execute synchronization operations' },
    { name: '*', description: 'All permissions (admin)' }
  ];
  
  res.json({
    success: true,
    data: {
      permissions: availablePermissions
    }
  });
}));

export default router;
