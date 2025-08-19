import axios from 'axios';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { DatabaseManager } from '../../database/manager';
import { authenticateApiKey, requirePermission } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateApiKey);

// Validation schemas
const employeeSchema = z.object({
  oneC_id: z.string(),
  employee_id: z.string(),
  branch_code: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'manager', 'supervisor', 'cashier']),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  hire_date: z.string().optional(),
  salary: z.number().positive().optional(),
  status: z.enum(['active', 'inactive', 'terminated']).default('active')
});

const timeLogSchema = z.object({
  employee_onec_id: z.string().optional(),
  employee_id: z.string(),
  branch_code: z.string(),
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

// GET /api/1c/employees - Get all employees
router.get('/', requirePermission('employees:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 100, 
    branch_code,
    role,
    status,
    search 
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      e.id, e.onec_id, e.employee_id, e.name, e.role, e.phone, e.email,
      e.hire_date, e.salary, e.status, e.created_at, e.updated_at,
      b.code as branch_code, b.name as branch_name,
      COUNT(DISTINCT etl.id) as time_log_count,
      MAX(etl.clock_in) as last_clock_in
    FROM employees e
    LEFT JOIN branches b ON e.branch_id = b.id
    LEFT JOIN employee_time_logs etl ON e.id = etl.employee_id AND etl.clock_in >= CURRENT_DATE - INTERVAL '30 days'
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (role) {
    params.push(role);
    query += ` AND e.role = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND e.status = $${params.length}`;
  }
  
  if (search) {
    params.push(`%${search}%`);
    query += ` AND (e.name ILIKE $${params.length} OR e.employee_id ILIKE $${params.length})`;
  }
  
  query += ` GROUP BY e.id, b.code, b.name`;
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(DISTINCT e.id) FROM').split('GROUP BY')[0];
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY e.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      employees: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// GET /api/1c/employees/:id - Get specific employee
router.get('/:id', requirePermission('employees:read'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { include_time_logs } = req.query;
  
  const query = `
    SELECT 
      e.id, e.onec_id, e.employee_id, e.name, e.role, e.phone, e.email,
      e.hire_date, e.salary, e.status, e.created_at, e.updated_at,
      b.code as branch_code, b.name as branch_name
    FROM employees e
    LEFT JOIN branches b ON e.branch_id = b.id
    WHERE e.id = $1 OR e.onec_id = $1 OR e.employee_id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
  
  const employee = result.rows[0];
  
  // Include recent time logs if requested
  if (include_time_logs === 'true') {
    const timeLogsResult = await DatabaseManager.query(`
      SELECT 
        id as log_id, clock_in, clock_out, break_start, break_end,
        total_hours, overtime_hours, notes, metadata, created_at
      FROM employee_time_logs
      WHERE employee_id = $1
      ORDER BY clock_in DESC
      LIMIT 50
    `, [employee.id]);
    
    employee.recent_time_logs = timeLogsResult.rows;
  }
  
  res.json({
    success: true,
    data: {
      employee
    }
  });
}));

// POST /api/1c/employees - Create or update employees from 1C
router.post('/', requirePermission('employees:write'), asyncHandler(async (req: Request, res: Response) => {
  const employees = z.array(employeeSchema).parse(req.body);
  
  const syncId = await createSyncLog('employees', 'import', employees.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const employeeData of employees) {
      try {
        // Find branch
        const branchResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1',
          [employeeData.branch_code]
        );
        
        if (branchResult.rows.length === 0) {
          throw new Error(`Branch with code "${employeeData.branch_code}" not found`);
        }
        
        const branchId = branchResult.rows[0].id;
        
        // Check if employee exists
        const existingResult = await DatabaseManager.query(
          'SELECT id FROM employees WHERE (employee_id = $1 AND branch_id = $2) OR onec_id = $3',
          [employeeData.employee_id, branchId, employeeData.oneC_id]
        );
        
        let employeeId;
        if (existingResult.rows.length > 0) {
          // Update existing employee
          employeeId = existingResult.rows[0].id;
          await DatabaseManager.query(`
            UPDATE employees SET
              onec_id = $1,
              employee_id = $2,
              name = $3,
              role = $4,
              phone = $5,
              email = $6,
              hire_date = $7,
              salary = $8,
              status = $9,
              updated_at = NOW()
            WHERE id = $10
          `, [
            employeeData.oneC_id, employeeData.employee_id, employeeData.name,
            employeeData.role, employeeData.phone, employeeData.email,
            employeeData.hire_date, employeeData.salary, employeeData.status,
            employeeId
          ]);
        } else {
          // Create new employee
          const insertResult = await DatabaseManager.query(`
            INSERT INTO employees (
              onec_id, employee_id, branch_id, name, role, phone, email,
              hire_date, salary, status, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
            ) RETURNING id
          `, [
            employeeData.oneC_id, employeeData.employee_id, branchId,
            employeeData.name, employeeData.role, employeeData.phone, employeeData.email,
            employeeData.hire_date, employeeData.salary, employeeData.status
          ]);
          employeeId = insertResult.rows[0].id;
        }
        
        // Sync to branch if employee is active
        if (employeeData.status === 'active') {
          await sendEmployeeDataToBranch(employeeData.branch_code, {
            ...employeeData,
            id: employeeId
          });
        }
        
        results.push({
          oneC_id: employeeData.oneC_id,
          employee_id: employeeData.employee_id,
          branch_code: employeeData.branch_code,
          success: true,
          action: existingResult.rows.length > 0 ? 'updated' : 'created',
          employee_uuid: employeeId
        });
        
      } catch (error) {
        results.push({
          oneC_id: employeeData.oneC_id,
          employee_id: employeeData.employee_id,
          branch_code: employeeData.branch_code,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// PUT /api/1c/employees/:id - Update specific employee
router.put('/:id', requirePermission('employees:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const employeeData = employeeSchema.partial().parse(req.body);
  
  // Find employee
  const employeeResult = await DatabaseManager.query(
    'SELECT id, branch_id FROM employees WHERE id = $1 OR onec_id = $1 OR employee_id = $1',
    [id]
  );
  
  if (employeeResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
  
  const employee = employeeResult.rows[0];
  let branchId = employee.branch_id;
  
  // Handle branch change
  if (employeeData.branch_code) {
    const branchResult = await DatabaseManager.query(
      'SELECT id FROM branches WHERE code = $1',
      [employeeData.branch_code]
    );
    
    if (branchResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Branch with code "${employeeData.branch_code}" not found`
      });
    }
    
    branchId = branchResult.rows[0].id;
  }
  
  // Update employee
  const result = await DatabaseManager.query(`
    UPDATE employees SET
      onec_id = COALESCE($1, onec_id),
      employee_id = COALESCE($2, employee_id),
      branch_id = COALESCE($3, branch_id),
      name = COALESCE($4, name),
      role = COALESCE($5, role),
      phone = COALESCE($6, phone),
      email = COALESCE($7, email),
      hire_date = COALESCE($8, hire_date),
      salary = COALESCE($9, salary),
      status = COALESCE($10, status),
      updated_at = NOW()
    WHERE id = $11
    RETURNING id, name, employee_id
  `, [
    employeeData.oneC_id, employeeData.employee_id, branchId,
    employeeData.name, employeeData.role, employeeData.phone, employeeData.email,
    employeeData.hire_date, employeeData.salary, employeeData.status,
    employee.id
  ]);
  
  // Sync to branch if needed
  if (employeeData.branch_code && (employeeData.status === 'active' || !employeeData.status)) {
    await sendEmployeeDataToBranch(employeeData.branch_code, {
      ...employeeData,
      id: employee.id
    });
  }
  
  res.json({
    success: true,
    data: {
      message: 'Employee updated successfully',
      employee_id: result.rows[0].id,
      employee_name: result.rows[0].name
    }
  });
}));

// ============================================================================
// EMPLOYEE TIME LOGS ENDPOINTS
// ============================================================================

// GET /api/1c/employees/time-logs - Get employee time logs
router.get('/time-logs', requirePermission('employees:read'), asyncHandler(async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 100, 
    employee_id,
    branch_code,
    start_date,
    end_date
  } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let query = `
    SELECT 
      etl.id as log_id, etl.clock_in, etl.clock_out, etl.break_start, etl.break_end,
      etl.total_hours, etl.overtime_hours, etl.notes, etl.metadata,
      etl.created_at, etl.updated_at,
      e.employee_id, e.name as employee_name, e.onec_id,
      b.code as branch_code, b.name as branch_name
    FROM employee_time_logs etl
    LEFT JOIN employees e ON etl.employee_id = e.id
    LEFT JOIN branches b ON etl.branch_id = b.id
    WHERE 1=1
  `;
  
  const params: any[] = [];
  
  if (employee_id) {
    params.push(employee_id);
    query += ` AND (e.employee_id = $${params.length} OR e.onec_id = $${params.length})`;
  }
  
  if (branch_code) {
    params.push(branch_code);
    query += ` AND b.code = $${params.length}`;
  }
  
  if (start_date) {
    params.push(start_date);
    query += ` AND etl.clock_in >= $${params.length}`;
  }
  
  if (end_date) {
    params.push(end_date);
    query += ` AND etl.clock_in <= $${params.length}`;
  }
  
  // Get total count for pagination
  const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
  const countResult = await DatabaseManager.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count);
  
  // Add pagination
  params.push(Number(limit), offset);
  query += ` ORDER BY etl.clock_in DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: {
      time_logs: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// POST /api/1c/employees/time-logs - Import time logs from 1C
router.post('/time-logs', requirePermission('employees:write'), asyncHandler(async (req: Request, res: Response) => {
  const timeLogs = z.array(timeLogSchema).parse(req.body);
  
  const syncId = await createSyncLog('time_logs', 'import', timeLogs.length);
  const results = [];
  
  await DatabaseManager.query('BEGIN');
  
  try {
    for (const timeLogData of timeLogs) {
      try {
        // Find branch
        const branchResult = await DatabaseManager.query(
          'SELECT id FROM branches WHERE code = $1',
          [timeLogData.branch_code]
        );
        
        if (branchResult.rows.length === 0) {
          throw new Error(`Branch with code "${timeLogData.branch_code}" not found`);
        }
        
        const branchId = branchResult.rows[0].id;
        
        // Find employee
        let employeeResult;
        if (timeLogData.employee_onec_id) {
          employeeResult = await DatabaseManager.query(
            'SELECT id FROM employees WHERE onec_id = $1 AND branch_id = $2',
            [timeLogData.employee_onec_id, branchId]
          );
        } else {
          employeeResult = await DatabaseManager.query(
            'SELECT id FROM employees WHERE employee_id = $1 AND branch_id = $2',
            [timeLogData.employee_id, branchId]
          );
        }
        
        if (employeeResult.rows.length === 0) {
          throw new Error(`Employee with ID "${timeLogData.employee_id}" not found in branch "${timeLogData.branch_code}"`);
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
            employeeId, branchId, timeLogData.clock_in, timeLogData.clock_out,
            timeLogData.break_start, timeLogData.break_end, totalHours,
            timeLogData.overtime_hours, timeLogData.notes,
            JSON.stringify(timeLogData.metadata || {})
          ]);
          timeLogId = insertResult.rows[0].id;
        }
        
        results.push({
          employee_id: timeLogData.employee_id,
          branch_code: timeLogData.branch_code,
          clock_in: timeLogData.clock_in,
          success: true,
          action: existingResult.rows.length > 0 ? 'updated' : 'created',
          time_log_id: timeLogId,
          total_hours: totalHours
        });
        
      } catch (error) {
        results.push({
          employee_id: timeLogData.employee_id,
          branch_code: timeLogData.branch_code,
          clock_in: timeLogData.clock_in,
          success: false,
          error: (error as Error).message
        });
      }
    }
    
    await DatabaseManager.query('COMMIT');
    await completeSyncLog(syncId, 'completed', results.filter(r => r.success).length);
    
    res.json({
      success: true,
      data: {
        sync_id: syncId,
        results,
        imported: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    await DatabaseManager.query('ROLLBACK');
    await completeSyncLog(syncId, 'failed', 0, (error as Error).message);
    throw error;
  }
}));

// DELETE /api/1c/employees/:id - Deactivate employee
router.delete('/:id', requirePermission('employees:write'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const result = await DatabaseManager.query(`
    UPDATE employees 
    SET status = 'terminated', updated_at = NOW()
    WHERE id = $1 OR onec_id = $1 OR employee_id = $1
    RETURNING id, name, employee_id
  `, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      message: `Employee "${result.rows[0].name}" has been terminated`,
      employee_id: result.rows[0].id,
      employee_code: result.rows[0].employee_id
    }
  });
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createSyncLog(syncType: string, direction: string, totalRecords: number): Promise<string> {
  const result = await DatabaseManager.query(`
    INSERT INTO onec_sync_logs (sync_type, direction, status, records_total, started_at)
    VALUES ($1, $2, 'in_progress', $3, NOW())
    RETURNING id
  `, [syncType, direction, totalRecords]);
  
  return result.rows[0].id;
}

async function completeSyncLog(
  syncId: string, 
  status: string, 
  recordsProcessed: number, 
  errorMessage?: string
): Promise<void> {
  await DatabaseManager.query(`
    UPDATE onec_sync_logs 
    SET status = $1, records_processed = $2, error_message = $3, completed_at = NOW()
    WHERE id = $4
  `, [status, recordsProcessed, errorMessage, syncId]);
}

async function getBranchApiEndpoint(branchCode: string): Promise<{ endpoint: string; apiKey: string } | null> {
  const result = await DatabaseManager.query(`
    SELECT api_endpoint, api_key 
    FROM branches 
    WHERE code = $1 AND is_active = true
  `, [branchCode]);
  
  if (result.rows.length === 0) return null;
  
  return {
    endpoint: result.rows[0].api_endpoint,
    apiKey: result.rows[0].api_key
  };
}

async function sendEmployeeDataToBranch(branchCode: string, employeeData: any): Promise<void> {
  const branchApi = await getBranchApiEndpoint(branchCode);
  if (!branchApi) return;
  
  try {
    await axios.post(`${branchApi.endpoint}/api/chain-core/employees`, {
      employees: [employeeData]
    }, {
      headers: {
        'Authorization': `Bearer ${branchApi.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  } catch (error) {
    console.error(`Failed to send employee data to branch ${branchCode}:`, error);
    throw error;
  }
}

export default router;
