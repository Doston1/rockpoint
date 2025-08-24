import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { asyncHandler } from '../../middleware/errorHandler';
import { completeBranchSyncLog, createBranchSyncLog } from './auth';

const router = Router();

// ============================================================================
// UTILITY FUNCTIONS  
// ============================================================================

/**
 * Hash a PIN code using bcrypt
 */
async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const employeeSchema = z.object({
  employee_id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(['admin', 'manager', 'supervisor', 'cashier']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  hire_date: z.string().optional(),
  salary: z.number().positive().optional(),
  status: z.enum(['active', 'inactive', 'terminated']).default('active'),
  pin_code: z.string().optional() // For POS login - will be hashed as pin_hash
});

const employeeUpdateSchema = employeeSchema.partial().omit({ employee_id: true });

const timeLogSchema = z.object({
  employee_id: z.string().min(1),
  clock_in: z.string(),
  clock_out: z.string().optional(),
  break_start: z.string().optional(),
  break_end: z.string().optional(),
  total_hours: z.number().min(0).optional(),
  overtime_hours: z.number().min(0).default(0),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// ============================================================================
// EMPLOYEE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/branches/employees
 * Create a new employee in the branch
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const employeeData = employeeSchema.parse(req.body);
  const branchServer = req.branchServer!;
  
  const syncId = await createBranchSyncLog(
    branchServer.branchId,
    'employees',
    'from_branch',
    1
  );
  
  await DatabaseManager.query('BEGIN');
  
  try {
    // Check if employee already exists
    const existingResult = await DatabaseManager.query(
      'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
      [employeeData.employee_id, branchServer.branchId]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Employee with ID "${employeeData.employee_id}" already exists in this branch`,
        code: 'EMPLOYEE_ALREADY_EXISTS'
      });
    }
    
    // Create new employee
    const insertResult = await DatabaseManager.query(`
      INSERT INTO employees (
        employee_id, branch_id, name, role, phone, email,
        hire_date, salary, status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      ) RETURNING id, name
    `, [
      employeeData.employee_id, branchServer.branchId, employeeData.name,
      employeeData.role, employeeData.phone, employeeData.email,
      employeeData.hire_date, employeeData.salary, employeeData.status
    ]);
    
    const employeeId = insertResult.rows[0].id;
    const employeeName = insertResult.rows[0].name;
    
    await DatabaseManager.query('COMMIT');
    await completeBranchSyncLog(syncId, 'completed', 1);
    
    res.status(201).json({
      success: true,
      data: {
        message: 'Employee created successfully',
        sync_id: syncId,
        employee_id: employeeData.employee_id, // Return the employee_id from request, not UUID
        employee_code: employeeData.employee_id,
        name: employeeName,
        branch_code: branchServer.branchCode
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeBranchSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

/**
 * PUT /api/branches/employees/:employeeId
 * Update employee information
 */
router.put('/:employeeId', asyncHandler(async (req: Request, res: Response) => {
  const { employeeId } = req.params;
  const updateData = employeeUpdateSchema.parse(req.body);
  const branchServer = req.branchServer!;
  
  // Find employee
  const employeeResult = await DatabaseManager.query(
    'SELECT id, name FROM employees WHERE employee_id = $1 AND branch_id = $2',
    [employeeId, branchServer.branchId]
  );
  
  if (employeeResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found in this branch'
    });
  }
  
  const employee = employeeResult.rows[0];
  
  // Build dynamic update query
  const updateFields = [];
  const updateValues = [];
  let paramCount = 0;
  
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== undefined) {
            paramCount++;
            // Skip pin_code for now since the database doesn't have pin_hash
            if (key === 'pin_code') {
              continue; // Skip pin_code updates until database has pin_hash column
            } else {
              updateFields.push(`${key} = $${paramCount}`);
              updateValues.push(value);
            }
          }
        }  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No valid fields to update'
    });
  }
  
  updateFields.push(`updated_at = NOW()`);
  updateValues.push(employee.id);
  
  const updateQuery = `
    UPDATE employees 
    SET ${updateFields.join(', ')}
    WHERE id = $${updateValues.length}
    RETURNING name, role, status, phone
  `;
  
  const result = await DatabaseManager.query(updateQuery, updateValues);
  
  res.json({
    success: true,
    data: {
      message: 'Employee updated successfully',
      employee_id: employee.id,
      employee_code: employeeId,
      name: result.rows[0].name,
      phone: result.rows[0].phone || updateData.phone,
      role: result.rows[0].role,
      status: result.rows[0].status,
      branch_code: branchServer.branchCode,
      updated_fields: Object.keys(updateData)
    }
  });
}));

/**
 * DELETE /api/branches/employees/:employeeId
 * Deactivate employee (soft delete)
 */
router.delete('/:employeeId', asyncHandler(async (req: Request, res: Response) => {
  const { employeeId } = req.params;
  const branchServer = req.branchServer!;
  
  const result = await DatabaseManager.query(`
    UPDATE employees 
    SET status = 'inactive', updated_at = NOW()
    WHERE employee_id = $1 AND branch_id = $2 AND status = 'active'
    RETURNING id, name
  `, [employeeId, branchServer.branchId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Active employee not found in this branch',
      code: 'EMPLOYEE_NOT_FOUND'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Employee "${result.rows[0].name}" has been deactivated`,
      employee_id: result.rows[0].id,
      employee_code: employeeId,
      status: 'inactive',
      branch_code: branchServer.branchCode
    }
  });
}));

/**
 * PUT /api/branches/employees/:employeeId/deactivate
 * Deactivate employee (soft delete)
 */
router.put('/:employeeId/deactivate', asyncHandler(async (req: Request, res: Response) => {
  const { employeeId } = req.params;
  const branchServer = req.branchServer!;
  
  const result = await DatabaseManager.query(`
    UPDATE employees 
    SET status = 'inactive', updated_at = NOW()
    WHERE employee_id = $1 AND branch_id = $2 AND status = 'active'
    RETURNING id, name
  `, [employeeId, branchServer.branchId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Active employee not found in this branch'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Employee "${result.rows[0].name}" has been deactivated`,
      employee_id: result.rows[0].id,
      employee_code: employeeId,
      branch_code: branchServer.branchCode
    }
  });
}));

/**
 * GET /api/branches/employees
 * Get all employees in the branch
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const branchServer = req.branchServer!;
  const { 
    page = 1, 
    limit = 50, 
    role,
    status = 'active',
    search 
  } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      id, employee_id, name, role, phone, email, hire_date,
      salary, status, created_at, updated_at,
      (
        SELECT COUNT(*) 
        FROM employee_time_logs etl 
        WHERE etl.employee_id = e.id 
          AND etl.clock_in >= CURRENT_DATE - INTERVAL '30 days'
      ) as recent_time_logs_count,
      (
        SELECT MAX(clock_in) 
        FROM employee_time_logs etl 
        WHERE etl.employee_id = e.id
      ) as last_clock_in
    FROM employees e
    WHERE branch_id = $1
  `;
  
  const params: any[] = [branchServer.branchId];
  
  if (role) {
    params.push(role);
    query += ` AND role = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR employee_id ILIKE $${params.length})`;
  }
  
  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(*) 
    FROM employees 
    WHERE branch_id = $1
  ` + (params.length > 1 ? query.substring(query.indexOf('WHERE branch_id = $1') + 20) : '');
  
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

/**
 * GET /api/branches/employees/:employeeId
 * Get specific employee details
 */
router.get('/:employeeId', asyncHandler(async (req: Request, res: Response) => {
  const { employeeId } = req.params;
  const branchServer = req.branchServer!;
  const { include_time_logs } = req.query;
  
  const query = `
    SELECT 
      id, employee_id, name, role, phone, email, hire_date,
      salary, status,
      created_at, updated_at
    FROM employees
    WHERE employee_id = $1 AND branch_id = $2
  `;
  
  const result = await DatabaseManager.query(query, [employeeId, branchServer.branchId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found in this branch',
      code: 'EMPLOYEE_NOT_FOUND'
    });
  }
  
  const employee = result.rows[0];
  
  // Include recent time logs if requested
  if (include_time_logs === 'true') {
    const timeLogsResult = await DatabaseManager.query(`
      SELECT 
        id as log_id, clock_in, clock_out, break_start, break_end,
        total_hours, overtime_hours, notes, created_at
      FROM employee_time_logs
      WHERE employee_id = $1
      ORDER BY clock_in DESC
      LIMIT 30
    `, [employee.id]);
    
    employee.recent_time_logs = timeLogsResult.rows;
  }
  
  res.json({
    success: true,
    data: employee
  });
}));

/**
 * POST /api/branches/employees/:employeeId/time-log
 * Log employee time entry
 */
router.post('/:employeeId/time-log', asyncHandler(async (req: Request, res: Response) => {
  const { employeeId } = req.params;
  const timeLogData = z.object({
    action: z.enum(['clock_in', 'clock_out', 'break_start', 'break_end']),
    timestamp: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional()
  }).parse(req.body);
  
  const branchServer = req.branchServer!;
  
  // Find employee
  const employeeResult = await DatabaseManager.query(
    'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
    [employeeId, branchServer.branchId]
  );
  
  if (employeeResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found in this branch',
      code: 'EMPLOYEE_NOT_FOUND'
    });
  }
  
  const employeeDbId = employeeResult.rows[0].id;
  const timestamp = timeLogData.timestamp || new Date().toISOString();
  const today = new Date(timestamp).toISOString().split('T')[0];
  
  // For each action, find or create today's time log entry
  let timeLogId: string;
  
  // First, try to find today's time log entry
  const todayLogResult = await DatabaseManager.query(`
    SELECT id, clock_in, clock_out, break_start, break_end
    FROM employee_time_logs
    WHERE employee_id = $1 AND DATE(clock_in) = $2
    ORDER BY clock_in DESC
    LIMIT 1
  `, [employeeDbId, today]);
  
  if (todayLogResult.rows.length > 0) {
    // Update existing log
    const log = todayLogResult.rows[0];
    timeLogId = log.id;
    
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 0;
    
    // Update the appropriate field based on action
    if (timeLogData.action === 'clock_out') {
      paramCount++;
      updateFields.push(`clock_out = $${paramCount}`);
      updateValues.push(timestamp);
    } else if (timeLogData.action === 'break_start') {
      paramCount++;
      updateFields.push(`break_start = $${paramCount}`);
      updateValues.push(timestamp);
    } else if (timeLogData.action === 'break_end') {
      paramCount++;
      updateFields.push(`break_end = $${paramCount}`);
      updateValues.push(timestamp);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(timeLogId);
      
      await DatabaseManager.query(`
        UPDATE employee_time_logs
        SET ${updateFields.join(', ')}
        WHERE id = $${updateValues.length}
      `, updateValues);
    }
    
  } else {
    // Create new log entry
    const insertFields: string[] = ['employee_id', 'branch_id', 'created_at'];
    const insertValues: any[] = [employeeDbId, branchServer.branchId];
    const insertPlaceholders: string[] = ['$1', '$2', 'NOW()'];
    
    let paramCount = 2;
    
    // Set the appropriate field based on action
    if (timeLogData.action === 'clock_in') {
      paramCount++;
      insertFields.push('clock_in');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(timestamp);
    } else if (timeLogData.action === 'clock_out') {
      // Need clock_in for clock_out (set to today start)
      paramCount++;
      insertFields.push('clock_in');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(today + 'T00:00:00.000Z');
      
      paramCount++;
      insertFields.push('clock_out');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(timestamp);
    } else if (timeLogData.action === 'break_start') {
      // Need clock_in for break_start
      paramCount++;
      insertFields.push('clock_in');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(today + 'T00:00:00.000Z');
      
      paramCount++;
      insertFields.push('break_start');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(timestamp);
    } else if (timeLogData.action === 'break_end') {
      // Need clock_in for break_end
      paramCount++;
      insertFields.push('clock_in');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(today + 'T00:00:00.000Z');
      
      paramCount++;
      insertFields.push('break_end');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(timestamp);
    }
    
    if (timeLogData.notes) {
      paramCount++;
      insertFields.push('notes');
      insertPlaceholders.push(`$${paramCount}`);
      insertValues.push(timeLogData.notes);
    }
    
    const insertResult = await DatabaseManager.query(`
      INSERT INTO employee_time_logs (${insertFields.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      RETURNING id
    `, insertValues);
    
    timeLogId = insertResult.rows[0].id;
  }
  
  res.status(201).json({
    success: true,
    data: {
      log_id: timeLogId,
      employee_id: employeeId,
      action: timeLogData.action,
      timestamp,
      location: timeLogData.location,
      branch_code: branchServer.branchCode
    }
  });
}));

/**
 * GET /api/branches/employees/:employeeId/time-logs
 * Get employee time logs
 */
router.get('/:employeeId/time-logs', asyncHandler(async (req: Request, res: Response) => {
  const { employeeId } = req.params;
  const branchServer = req.branchServer!;
  const { from, to } = req.query;
  
  // Find employee
  const employeeResult = await DatabaseManager.query(
    'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
    [employeeId, branchServer.branchId]
  );
  
  if (employeeResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found in this branch',
      code: 'EMPLOYEE_NOT_FOUND'
    });
  }
  
  const employeeDbId = employeeResult.rows[0].id;
  
  let query = `
    SELECT 
      id as log_id, clock_in, clock_out, break_start, break_end,
      total_hours, overtime_hours, notes, created_at
    FROM employee_time_logs
    WHERE employee_id = $1
  `;
  
  const params: any[] = [employeeDbId];
  
  if (from) {
    params.push(from);
    query += ` AND clock_in >= $${params.length}`;
  }
  
  if (to) {
    params.push(to + 'T23:59:59.999Z'); // Include end of day
    query += ` AND clock_in <= $${params.length}`;
  }
  
  query += ` ORDER BY clock_in DESC`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

/**
 * POST /api/branches/employees/bulk-update
 * Bulk update employees
 */
router.post('/bulk-update', asyncHandler(async (req: Request, res: Response) => {
  const bulkData = z.object({
    employees: z.array(z.object({
      employee_id: z.string(),
      name: z.string().optional(),
      role: z.enum(['admin', 'manager', 'supervisor', 'cashier']).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      hire_date: z.string().optional(),
      salary: z.number().positive().optional(),
      status: z.enum(['active', 'inactive', 'terminated']).optional(),
      pin_code: z.string().optional()
    }))
  }).parse(req.body);
  
  const branchServer = req.branchServer!;
  let updatedCount = 0;
  let failedCount = 0;
  const results: any[] = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const employeeUpdate of bulkData.employees) {
      try {
        const { employee_id, ...updates } = employeeUpdate;
        
        // Find employee
        const employeeResult = await DatabaseManager.query(
          'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
          [employee_id, branchServer.branchId]
        );
        
        if (employeeResult.rows.length === 0) {
          results.push({
            employee_id,
            success: false,
            error: 'Employee not found'
          });
          failedCount++;
          continue;
        }
        
        // Build update query
        const updateFields = [];
        const updateValues = [];
        let paramCount = 0;
        
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) {
            paramCount++;
            if (key === 'pin_code') {
              continue; // Skip pin_code updates until database has pin_hash column
            } else {
              updateFields.push(`${key} = $${paramCount}`);
              updateValues.push(value);
            }
          }
        }
        
        if (updateFields.length > 0) {
          updateFields.push(`updated_at = NOW()`);
          updateValues.push(employeeResult.rows[0].id);
          
          const updateQuery = `
            UPDATE employees 
            SET ${updateFields.join(', ')}
            WHERE id = $${updateValues.length}
          `;
          
          await DatabaseManager.query(updateQuery, updateValues);
          updatedCount++;
          
          results.push({
            employee_id,
            success: true,
            updated_fields: Object.keys(updates).filter(key => key !== 'pin_code' && (updates as any)[key] !== undefined)
          });
        } else {
          results.push({
            employee_id,
            success: false,
            error: 'No valid fields to update'
          });
          failedCount++;
        }
        
      } catch (error) {
        results.push({
          employee_id: employeeUpdate.employee_id,
          success: false,
          error: (error as Error).message
        });
        failedCount++;
      }
    }
    
    await DatabaseManager.query('COMMIT');
    
    res.json({
      success: true,
      data: {
        updated_count: updatedCount,
        failed_count: failedCount,
        total_count: bulkData.employees.length,
        results,
        branch_code: branchServer.branchCode
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    throw error;
  }
}));

// ============================================================================
// TIME LOGGING ENDPOINTS
// ============================================================================

/**
 * POST /api/branches/employees/time-logs
 * Submit employee time logs
 */
router.post('/time-logs', asyncHandler(async (req: Request, res: Response) => {
  const timeLogs = z.array(timeLogSchema).parse(req.body);
  const branchServer = req.branchServer!;
  
  const syncId = await createBranchSyncLog(
    branchServer.branchId,
    'time_logs',
    'from_branch',
    timeLogs.length
  );
  
  const results: Array<{
    employee_id: string;
    clock_in: string;
    success: boolean;
    action?: string;
    error?: string;
  }> = [];
  let successCount = 0;
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const timeLogData of timeLogs) {
      try {
        // Find employee
        const employeeResult = await DatabaseManager.query(
          'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
          [timeLogData.employee_id, branchServer.branchId]
        );
        
        if (employeeResult.rows.length === 0) {
          throw new Error(`Employee with ID "${timeLogData.employee_id}" not found in branch`);
        }
        
        const employeeId = employeeResult.rows[0].id;
        
        // Calculate total hours if not provided
        let totalHours = timeLogData.total_hours;
        if (!totalHours && timeLogData.clock_out) {
          const clockIn = new Date(timeLogData.clock_in);
          const clockOut = new Date(timeLogData.clock_out);
          totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
          
          // Subtract break time if provided
          if (timeLogData.break_start && timeLogData.break_end) {
            const breakStart = new Date(timeLogData.break_start);
            const breakEnd = new Date(timeLogData.break_end);
            const breakHours = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60);
            totalHours -= breakHours;
          }
        }
        
        // Check if time log already exists
        const existingResult = await DatabaseManager.query(
          'SELECT id FROM employee_time_logs WHERE employee_id = $1 AND clock_in = $2',
          [employeeId, timeLogData.clock_in]
        );
        
        let timeLogId;
        let action;
        
        if (existingResult.rows.length > 0) {
          // Update existing time log
          timeLogId = existingResult.rows[0].id;
          await DatabaseManager.query(`
            UPDATE employee_time_logs SET
              clock_out = $1,
              break_start = $2,
              break_end = $3,
              total_hours = $4,
              overtime_hours = $5,
              notes = $6,
              metadata = $7,
              updated_at = NOW()
            WHERE id = $8
          `, [
            timeLogData.clock_out, timeLogData.break_start, timeLogData.break_end,
            totalHours, timeLogData.overtime_hours, timeLogData.notes,
            JSON.stringify(timeLogData.metadata || {}), timeLogId
          ]);
          action = 'updated';
        } else {
          // Create new time log
          const insertResult = await DatabaseManager.query(`
            INSERT INTO employee_time_logs (
              employee_id, branch_id, clock_in, clock_out, break_start, break_end,
              total_hours, overtime_hours, notes, metadata, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
            ) RETURNING id
          `, [
            employeeId, branchServer.branchId, timeLogData.clock_in, timeLogData.clock_out,
            timeLogData.break_start, timeLogData.break_end, totalHours,
            timeLogData.overtime_hours, timeLogData.notes,
            JSON.stringify(timeLogData.metadata || {})
          ]);
          timeLogId = insertResult.rows[0].id;
          action = 'created';
        }
        
        results.push({
          employee_id: timeLogData.employee_id,
          clock_in: timeLogData.clock_in,
          success: true,
          action
        });
        successCount++;
        
      } catch (error) {
        results.push({
          employee_id: timeLogData.employee_id,
          clock_in: timeLogData.clock_in,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeBranchSyncLog(syncId, 'completed', successCount);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        total_logs: timeLogs.length,
        successful: successCount,
        failed: timeLogs.length - successCount,
        branch_code: branchServer.branchCode
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeBranchSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

export default router;
