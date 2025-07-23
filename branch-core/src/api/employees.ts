import { DatabaseManager } from '@/database/manager';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createEmployeeSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'manager', 'cashier', 'supervisor']),
  pin: z.string().min(4, 'PIN must be at least 4 characters'),
  hire_date: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active')
});

const updateEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['admin', 'manager', 'cashier', 'supervisor']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  hire_date: z.string().optional()
});

const changePasswordSchema = z.object({
  newPin: z.string().min(4, 'PIN must be at least 4 characters')
});

// Helper function to determine if a string is a UUID
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// GET /api/employees
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const employeesQuery = `
    SELECT 
      id, employee_id, name, role, status, 
      hire_date, last_login, created_at
    FROM employees
    ORDER BY name ASC
  `;

  const result = await DatabaseManager.query(employeesQuery);

  res.json({
    success: true,
    data: { employees: result.rows }
  });
}));

// GET /api/employees/:id
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;

  // Determine if the parameter is a UUID or employee_id
  let employeeQuery: string;
  let queryParams: string[];

  if (isUUID(employeeId)) {
    // Search by UUID id
    employeeQuery = `
      SELECT 
        id, employee_id, name, role, status, 
        hire_date, last_login, created_at
      FROM employees
      WHERE id = $1
    `;
    queryParams = [employeeId];
  } else {
    // Search by employee_id (varchar)
    employeeQuery = `
      SELECT 
        id, employee_id, name, role, status, 
        hire_date, last_login, created_at
      FROM employees
      WHERE employee_id = $1
    `;
    queryParams = [employeeId];
  }

  const result = await DatabaseManager.query(employeeQuery, queryParams);
  const employee = result.rows[0];

  if (!employee) {
    throw createError('Employee not found', 404);
  }

  res.json({
    success: true,
    data: { employee }
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
    throw createError('Employee ID already exists', 400);
  }

  // Hash the PIN
  const pinHash = await bcrypt.hash(validatedData.pin, 12);

  const insertQuery = `
    INSERT INTO employees (employee_id, name, role, pin_hash, status, hire_date)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, employee_id, name, role, status, hire_date, created_at
  `;

  const result = await DatabaseManager.query(insertQuery, [
    validatedData.employee_id,
    validatedData.name,
    validatedData.role,
    pinHash,
    validatedData.status,
    validatedData.hire_date || new Date().toISOString().split('T')[0]
  ]);

  res.status(201).json({
    success: true,
    data: { employee: result.rows[0] },
    message: 'Employee created successfully'
  });
}));

// PUT /api/employees/:id - Update employee
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const validatedData = updateEmployeeSchema.parse(req.body);

  // Check if employee exists - use proper type checking
  let existingEmployee;
  if (isUUID(employeeId)) {
    existingEmployee = await DatabaseManager.query(
      'SELECT id FROM employees WHERE id = $1',
      [employeeId]
    );
  } else {
    existingEmployee = await DatabaseManager.query(
      'SELECT id FROM employees WHERE employee_id = $1',
      [employeeId]
    );
  }

  if (existingEmployee.rows.length === 0) {
    throw createError('Employee not found', 404);
  }

  // Build dynamic update query
  interface UpdateEmployeeFields {
    name?: string;
    role?: 'admin' | 'manager' | 'cashier' | 'supervisor';
    status?: 'active' | 'inactive' | 'suspended';
    hire_date?: string;
  }

  const updateFields: string[] = [];
  const validatedDataTyped: UpdateEmployeeFields = validatedData;
  const updateValues = [];
  let paramCount = 1;

  Object.entries(validatedData).forEach(([key, value]) => {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      updateValues.push(value);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw createError('No fields to update', 400);
  }

  let updateQuery: string;
  if (isUUID(employeeId)) {
    updateQuery = `
      UPDATE employees 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, employee_id, name, role, status, hire_date, updated_at
    `;
  } else {
    updateQuery = `
      UPDATE employees 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE employee_id = $${paramCount}
      RETURNING id, employee_id, name, role, status, hire_date, updated_at
    `;
  }

  updateValues.push(employeeId);

  const result = await DatabaseManager.query(updateQuery, updateValues);

  res.json({
    success: true,
    data: { employee: result.rows[0] },
    message: 'Employee updated successfully'
  });
}));

// PUT /api/employees/:id/change-password - Change employee password
router.put('/:id/change-password', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const { newPin } = changePasswordSchema.parse(req.body);

  // Check if employee exists - use proper type checking
  let existingEmployee;
  if (isUUID(employeeId)) {
    existingEmployee = await DatabaseManager.query(
      'SELECT id FROM employees WHERE id = $1',
      [employeeId]
    );
  } else {
    existingEmployee = await DatabaseManager.query(
      'SELECT id FROM employees WHERE employee_id = $1',
      [employeeId]
    );
  }

  if (existingEmployee.rows.length === 0) {
    throw createError('Employee not found', 404);
  }

  // Hash the new PIN
  const pinHash = await bcrypt.hash(newPin, 12);

  let updateQuery: string;
  if (isUUID(employeeId)) {
    updateQuery = `
      UPDATE employees 
      SET pin_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, employee_id, name
    `;
  } else {
    updateQuery = `
      UPDATE employees 
      SET pin_hash = $1, updated_at = NOW()
      WHERE employee_id = $2
      RETURNING id, employee_id, name
    `;
  }

  const result = await DatabaseManager.query(updateQuery, [pinHash, employeeId]);

  res.json({
    success: true,
    data: { employee: result.rows[0] },
    message: 'Password changed successfully'
  });
}));

// DELETE /api/employees/:id - Delete employee
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;

  // Check if employee exists - use proper type checking
  let existingEmployee;
  if (isUUID(employeeId)) {
    existingEmployee = await DatabaseManager.query(
      'SELECT id, employee_id FROM employees WHERE id = $1',
      [employeeId]
    );
  } else {
    existingEmployee = await DatabaseManager.query(
      'SELECT id, employee_id FROM employees WHERE employee_id = $1',
      [employeeId]
    );
  }

  if (existingEmployee.rows.length === 0) {
    throw createError('Employee not found', 404);
  }

  // Check if employee has any active time logs
  const activeTimeLogs = await DatabaseManager.query(
    'SELECT id FROM employee_time_logs WHERE employee_id = $1 AND clock_out IS NULL',
    [existingEmployee.rows[0].employee_id]
  );

  if (activeTimeLogs.rows.length > 0) {
    throw createError('Cannot delete employee with active time logs. Please clock them out first.', 400);
  }

  // Delete the employee
  let deleteQuery: string;
  if (isUUID(employeeId)) {
    deleteQuery = `
      DELETE FROM employees 
      WHERE id = $1
      RETURNING id, employee_id, name
    `;
  } else {
    deleteQuery = `
      DELETE FROM employees 
      WHERE employee_id = $1
      RETURNING id, employee_id, name
    `;
  }

  const result = await DatabaseManager.query(deleteQuery, [employeeId]);

  res.json({
    success: true,
    data: { employee: result.rows[0] },
    message: 'Employee deleted successfully'
  });
}));

// GET /api/employees/:id/schedule
router.get('/:id/schedule', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const startDate = req.query.startDate as string || new Date().toISOString().split('T')[0];
  const endDate = req.query.endDate as string;

  // First get the employee_id if UUID is provided
  let actualEmployeeId = employeeId;
  if (isUUID(employeeId)) {
    const employeeResult = await DatabaseManager.query(
      'SELECT employee_id FROM employees WHERE id = $1',
      [employeeId]
    );
    if (employeeResult.rows.length === 0) {
      throw createError('Employee not found', 404);
    }
    actualEmployeeId = employeeResult.rows[0].employee_id;
  }

  let dateFilter = 'DATE(clock_in) >= $2';
  const queryParams = [actualEmployeeId, startDate];

  if (endDate) {
    dateFilter += ' AND DATE(clock_in) <= $3';
    queryParams.push(endDate);
  }

  const scheduleQuery = `
    SELECT 
      id, clock_in, clock_out, 
      EXTRACT(EPOCH FROM (clock_out - clock_in))/3600 as hours_worked,
      break_minutes, notes, terminal_id
    FROM employee_time_logs
    WHERE employee_id = $1 AND ${dateFilter}
    ORDER BY clock_in DESC
  `;

  const result = await DatabaseManager.query(scheduleQuery, queryParams);

  res.json({
    success: true,
    data: { 
      schedule: result.rows,
      period: { startDate, endDate }
    }
  });
}));

// GET /api/employees/:id/today-hours - Get today's working hours
router.get('/:id/today-hours', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const today = new Date().toISOString().split('T')[0];

  // First get the employee_id if UUID is provided
  let actualEmployeeId = employeeId;
  if (isUUID(employeeId)) {
    const employeeResult = await DatabaseManager.query(
      'SELECT employee_id FROM employees WHERE id = $1',
      [employeeId]
    );
    if (employeeResult.rows.length === 0) {
      throw createError('Employee not found', 404);
    }
    actualEmployeeId = employeeResult.rows[0].employee_id;
  }

  const todayHoursQuery = `
    SELECT 
      id, clock_in, clock_out,
      CASE 
        WHEN clock_out IS NOT NULL THEN EXTRACT(EPOCH FROM (clock_out - clock_in))/3600
        ELSE EXTRACT(EPOCH FROM (NOW() - clock_in))/3600
      END as hours_worked,
      break_minutes, notes, terminal_id,
      CASE WHEN clock_out IS NULL THEN true ELSE false END as is_clocked_in
    FROM employee_time_logs
    WHERE employee_id = $1 AND DATE(clock_in) = $2
    ORDER BY clock_in DESC
    LIMIT 1
  `;

  const result = await DatabaseManager.query(todayHoursQuery, [actualEmployeeId, today]);

  res.json({
    success: true,
    data: { 
      todayHours: result.rows[0] || null,
      date: today
    }
  });
}));

// POST /api/employees/:id/clock-in
router.post('/:id/clock-in', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const { terminalId } = req.body;

  // First get the employee_id if UUID is provided
  let actualEmployeeId = employeeId;
  if (isUUID(employeeId)) {
    const employeeResult = await DatabaseManager.query(
      'SELECT employee_id FROM employees WHERE id = $1',
      [employeeId]
    );
    if (employeeResult.rows.length === 0) {
      throw createError('Employee not found', 404);
    }
    actualEmployeeId = employeeResult.rows[0].employee_id;
  }

  // Check if already clocked in
  const existingClockIn = await DatabaseManager.query(
    'SELECT id FROM employee_time_logs WHERE employee_id = $1 AND clock_out IS NULL',
    [actualEmployeeId]
  );

  if (existingClockIn.rows.length > 0) {
    throw createError('Employee is already clocked in', 400);
  }

  const clockInQuery = `
    INSERT INTO employee_time_logs (employee_id, clock_in, terminal_id, created_at)
    VALUES ($1, NOW(), $2, NOW())
    RETURNING id, clock_in
  `;

  const result = await DatabaseManager.query(clockInQuery, [actualEmployeeId, terminalId]);

  res.json({
    success: true,
    data: {
      timeLogId: result.rows[0].id,
      clockIn: result.rows[0].clock_in,
      message: 'Successfully clocked in'
    }
  });
}));

// POST /api/employees/:id/clock-out
router.post('/:id/clock-out', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const { notes } = req.body;

  // First get the employee_id if UUID is provided
  let actualEmployeeId = employeeId;
  if (isUUID(employeeId)) {
    const employeeResult = await DatabaseManager.query(
      'SELECT employee_id FROM employees WHERE id = $1',
      [employeeId]
    );
    if (employeeResult.rows.length === 0) {
      throw createError('Employee not found', 404);
    }
    actualEmployeeId = employeeResult.rows[0].employee_id;
  }

  // Find active clock-in
  const activeClockIn = await DatabaseManager.query(
    'SELECT id, clock_in FROM employee_time_logs WHERE employee_id = $1 AND clock_out IS NULL',
    [actualEmployeeId]
  );

  if (activeClockIn.rows.length === 0) {
    throw createError('No active clock-in found for this employee', 400);
  }

  const timeLogId = activeClockIn.rows[0].id;

  const clockOutQuery = `
    UPDATE employee_time_logs 
    SET clock_out = NOW(), notes = $1
    WHERE id = $2
    RETURNING clock_out, EXTRACT(EPOCH FROM (clock_out - clock_in))/3600 as hours_worked
  `;

  const result = await DatabaseManager.query(clockOutQuery, [notes, timeLogId]);
  const hoursWorked = parseFloat(result.rows[0].hours_worked);

  res.json({
    success: true,
    data: {
      timeLogId,
      clockOut: result.rows[0].clock_out,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      message: 'Successfully clocked out'
    }
  });
}));

export default router;
