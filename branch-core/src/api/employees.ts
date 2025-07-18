import { DatabaseManager } from '@/database/manager';
import { asyncHandler, createError } from '@/middleware/errorHandler';
import { Request, Response, Router } from 'express';

const router = Router();

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

  const employeeQuery = `
    SELECT 
      id, employee_id, name, role, status, 
      hire_date, last_login, created_at
    FROM employees
    WHERE id = $1 OR employee_id = $1
  `;

  const result = await DatabaseManager.query(employeeQuery, [employeeId]);
  const employee = result.rows[0];

  if (!employee) {
    throw createError('Employee not found', 404);
  }

  res.json({
    success: true,
    data: { employee }
  });
}));

// GET /api/employees/:id/schedule
router.get('/:id/schedule', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const startDate = req.query.startDate as string || new Date().toISOString().split('T')[0];
  const endDate = req.query.endDate as string;

  let dateFilter = 'DATE(clock_in) >= $2';
  const queryParams = [employeeId, startDate];

  if (endDate) {
    dateFilter += ' AND DATE(clock_in) <= $3';
    queryParams.push(endDate);
  }

  const scheduleQuery = `
    SELECT 
      id, clock_in, clock_out, 
      EXTRACT(EPOCH FROM (clock_out - clock_in))/3600 as hours_worked,
      break_minutes, notes
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

// POST /api/employees/:id/clock-in
router.post('/:id/clock-in', asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id;
  const { terminalId } = req.body;

  // Check if already clocked in
  const existingClockIn = await DatabaseManager.query(
    'SELECT id FROM employee_time_logs WHERE employee_id = $1 AND clock_out IS NULL',
    [employeeId]
  );

  if (existingClockIn.rows.length > 0) {
    throw createError('Employee is already clocked in', 400);
  }

  const clockInQuery = `
    INSERT INTO employee_time_logs (employee_id, clock_in, terminal_id, created_at)
    VALUES ($1, NOW(), $2, NOW())
    RETURNING id, clock_in
  `;

  const result = await DatabaseManager.query(clockInQuery, [employeeId, terminalId]);

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

  // Find active clock-in
  const activeClockIn = await DatabaseManager.query(
    'SELECT id, clock_in FROM employee_time_logs WHERE employee_id = $1 AND clock_out IS NULL',
    [employeeId]
  );

  if (activeClockIn.rows.length === 0) {
    throw createError('No active clock-in found for this employee', 400);
  }

  const timeLogId = activeClockIn.rows[0].id;
  const clockIn = activeClockIn.rows[0].clock_in;

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
