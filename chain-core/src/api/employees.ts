import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Validation schemas
const createEmployeeSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  name: z.string().min(1, 'Employee name is required'),
  email: z.string().email('Valid email is required').optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'supervisor', 'cashier']),
  branch_id: z.string().uuid('Valid branch ID is required'),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  salary: z.number().optional(),
  hire_date: z.string().optional(),
});

const updateEmployeeSchema = createEmployeeSchema.partial().omit({ pin: true });

const changePinSchema = z.object({
  current_pin: z.string().min(1, 'Current PIN is required'),
  new_pin: z.string().min(4, 'New PIN must be at least 4 characters'),
});

// GET /api/employees - Get all employees
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { branch_id, role, status } = req.query;
  
  let query = `
    SELECT 
      e.id, e.employee_id, e.name, e.email, e.phone, e.role, e.branch_id,
      e.salary, e.hire_date, e.status, e.last_login, e.created_at, e.updated_at,
      b.name as branch_name
    FROM employees e
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  let paramIndex = 1;
  
  if (branch_id) {
    query += ` AND e.branch_id = $${paramIndex}`;
    params.push(branch_id);
    paramIndex++;
  }
  
  if (role) {
    query += ` AND e.role = $${paramIndex}`;
    params.push(role);
    paramIndex++;
  }
  
  if (status) {
    query += ` AND e.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  
  query += ` ORDER BY e.name ASC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      employees: result.rows
    }
  });
}));

// GET /api/employees/:id - Get specific employee
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      e.id, e.employee_id, e.name, e.email, e.phone, e.role, e.branch_id,
      e.salary, e.hire_date, e.status, e.last_login, e.created_at, e.updated_at,
      b.name as branch_name
    FROM employees e
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE e.id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
  
  res.json({
    success: true,
    data: { employee: result.rows[0] }
  });
}));

// POST /api/employees - Create new employee
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const validatedData = createEmployeeSchema.parse(req.body);
  
  // Check if employee_id already exists
  const existingEmployee = await DatabaseManager.query(
    'SELECT id FROM employees WHERE employee_id = $1',
    [validatedData.employee_id]
  );
  
  if (existingEmployee.rows.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Employee ID already exists'
    });
  }
  
  // Check if email already exists (if provided)
  if (validatedData.email) {
    const existingEmail = await DatabaseManager.query(
      'SELECT id FROM employees WHERE email = $1',
      [validatedData.email]
    );
    
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }
  }
  
  // Verify branch exists
  const branchExists = await DatabaseManager.query(
    'SELECT id FROM branches WHERE id = $1',
    [validatedData.branch_id]
  );
  
  if (branchExists.rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Branch not found'
    });
  }
  
  // Hash PIN
  const hashedPin = await bcrypt.hash(validatedData.pin, 12);
  
  const insertQuery = `
    INSERT INTO employees (
      employee_id, name, email, phone, role, branch_id, pin_hash,
      salary, hire_date, status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', NOW(), NOW()
    )
    RETURNING id, employee_id, name, email, phone, role, branch_id, salary, hire_date, status, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(insertQuery, [
    validatedData.employee_id,
    validatedData.name,
    validatedData.email,
    validatedData.phone,
    validatedData.role,
    validatedData.branch_id,
    hashedPin,
    validatedData.salary,
    validatedData.hire_date || new Date().toISOString().split('T')[0]
  ]);
  
  // Get branch name for response
  const branchResult = await DatabaseManager.query(
    'SELECT name FROM branches WHERE id = $1',
    [validatedData.branch_id]
  );
  
  const employee = {
    ...result.rows[0],
    branch_name: branchResult.rows[0]?.name
  };
  
  res.status(201).json({
    success: true,
    data: { employee }
  });
}));

// PUT /api/employees/:id - Update employee
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const validatedData = updateEmployeeSchema.parse(req.body);
  
  // Check if employee exists
  const existingEmployee = await DatabaseManager.query(
    'SELECT id FROM employees WHERE id = $1',
    [id]
  );
  
  if (existingEmployee.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
  
  // Build dynamic update query
  const updateFields = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(validatedData)) {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No fields to update'
    });
  }
  
  updateFields.push(`updated_at = NOW()`);
  values.push(id);
  
  const updateQuery = `
    UPDATE employees 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, name, email, phone, role, branch_id, salary, hire_date, status, created_at, updated_at
  `;
  
  const result = await DatabaseManager.query(updateQuery, values);
  
  // Get branch name for response
  const branchResult = await DatabaseManager.query(
    'SELECT name FROM branches WHERE id = $1',
    [result.rows[0].branch_id]
  );
  
  const employee = {
    ...result.rows[0],
    branch_name: branchResult.rows[0]?.name
  };
  
  res.json({
    success: true,
    data: { employee }
  });
}));

// DELETE /api/employees/:id - Delete employee (soft delete)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(
    'UPDATE employees SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
    ['inactive', id]
  );
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Employee deactivated successfully'
  });
}));

// POST /api/employees/:id/change-pin - Change employee PIN
router.post('/:id/change-pin', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { current_pin, new_pin } = changePinSchema.parse(req.body);
  
  // Get current PIN hash
  const employeeResult = await DatabaseManager.query(
    'SELECT pin_hash FROM employees WHERE id = $1',
    [id]
  );
  
  if (employeeResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
  
  // Verify current PIN
  const isCurrentPinValid = await bcrypt.compare(
    current_pin,
    employeeResult.rows[0].pin_hash
  );
  
  if (!isCurrentPinValid) {
    return res.status(400).json({
      success: false,
      error: 'Current PIN is incorrect'
    });
  }
  
  // Hash new PIN
  const hashedNewPin = await bcrypt.hash(new_pin, 12);
  
  // Update PIN
  await DatabaseManager.query(
    'UPDATE employees SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedNewPin, id]
  );
  
  res.json({
    success: true,
    message: 'PIN changed successfully'
  });
}));

export default router;
