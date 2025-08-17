import { Request, Response, Router } from 'express';
import { DatabaseManager } from '../database/manager';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Get all POS terminals
router.get('/terminals', asyncHandler(async (req: Request, res: Response) => {
  const { status, assigned_employee_id } = req.query;
  
  let query = `
    SELECT 
      pt.*,
      e.name as assigned_employee_name,
      e.role as assigned_employee_role
    FROM pos_terminals pt
    LEFT JOIN employees e ON pt.assigned_employee_id = e.id
    WHERE pt.is_active = true
  `;
  
  const params: any[] = [];
  
  if (status) {
    params.push(status);
    query += ` AND pt.status = $${params.length}`;
  }
  
  if (assigned_employee_id) {
    params.push(assigned_employee_id);
    query += ` AND pt.assigned_employee_id = $${params.length}`;
  }
  
  query += ' ORDER BY pt.name ASC';
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows,
    total: result.rows.length
  });
}));

// Get POS terminal by ID
router.get('/terminals/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      pt.*,
      e.name as assigned_employee_name,
      e.role as assigned_employee_role
    FROM pos_terminals pt
    LEFT JOIN employees e ON pt.assigned_employee_id = e.id
    WHERE pt.id = $1
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'POS terminal not found'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Get POS terminal by terminal_id
router.get('/terminals/by-terminal-id/:terminalId', asyncHandler(async (req: Request, res: Response) => {
  const { terminalId } = req.params;
  
  const query = `
    SELECT 
      pt.*,
      e.name as assigned_employee_name,
      e.role as assigned_employee_role
    FROM pos_terminals pt
    LEFT JOIN employees e ON pt.assigned_employee_id = e.id
    WHERE pt.terminal_id = $1
  `;
  
  const result = await DatabaseManager.query(query, [terminalId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'POS terminal not found'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Create or update POS terminal
router.post('/terminals', asyncHandler(async (req: Request, res: Response) => {
  const {
    terminal_id,
    name,
    ip_address,
    port,
    mac_address,
    location,
    assigned_employee_id,
    hardware_info,
    software_version
  } = req.body;
  
  // Validate required fields
  if (!terminal_id || !name || !ip_address) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: terminal_id, name, ip_address'
    });
  }
  
  const query = `
    INSERT INTO pos_terminals (
      terminal_id, name, ip_address, port, mac_address, location,
      assigned_employee_id, hardware_info, software_version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (terminal_id) 
    DO UPDATE SET
      name = EXCLUDED.name,
      ip_address = EXCLUDED.ip_address,
      port = EXCLUDED.port,
      mac_address = EXCLUDED.mac_address,
      location = EXCLUDED.location,
      assigned_employee_id = EXCLUDED.assigned_employee_id,
      hardware_info = EXCLUDED.hardware_info,
      software_version = EXCLUDED.software_version,
      updated_at = NOW()
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [
    terminal_id, name, ip_address, port || 5173, mac_address, location,
    assigned_employee_id, hardware_info ? JSON.stringify(hardware_info) : null,
    software_version
  ]);
  
  res.json({
    success: true,
    data: result.rows[0],
    message: 'POS terminal configuration saved successfully'
  });
}));

// Update POS terminal status
router.patch('/terminals/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, hardware_info, software_version } = req.body;
  
  const query = `
    UPDATE pos_terminals 
    SET 
      status = $2,
      last_seen = NOW(),
      hardware_info = COALESCE($3, hardware_info),
      software_version = COALESCE($4, software_version),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [
    id, status, 
    hardware_info ? JSON.stringify(hardware_info) : null,
    software_version
  ]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'POS terminal not found'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Update POS terminal status by terminal_id (for self-reporting)
router.patch('/terminals/by-terminal-id/:terminalId/status', asyncHandler(async (req: Request, res: Response) => {
  const { terminalId } = req.params;
  const { status, hardware_info, software_version } = req.body;
  
  const query = `
    UPDATE pos_terminals 
    SET 
      status = $2,
      last_seen = NOW(),
      hardware_info = COALESCE($3, hardware_info),
      software_version = COALESCE($4, software_version),
      updated_at = NOW()
    WHERE terminal_id = $1
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [
    terminalId, status, 
    hardware_info ? JSON.stringify(hardware_info) : null,
    software_version
  ]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'POS terminal not found'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Assign employee to POS terminal
router.patch('/terminals/:id/assign', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { employee_id } = req.body;
  
  if (!employee_id) {
    return res.status(400).json({
      success: false,
      error: 'employee_id is required'
    });
  }
  
  // First, check if employee exists
  const employeeCheck = await DatabaseManager.query(
    'SELECT id FROM employees WHERE id = $1 AND status = \'active\'',
    [employee_id]
  );
  
  if (employeeCheck.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Employee not found or inactive'
    });
  }
  
  const query = `
    UPDATE pos_terminals 
    SET 
      assigned_employee_id = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [id, employee_id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'POS terminal not found'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0],
    message: 'Employee assigned to POS terminal successfully'
  });
}));

// Delete POS terminal
router.delete('/terminals/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const query = `
    UPDATE pos_terminals 
    SET is_active = false, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'POS terminal not found'
    });
  }
  
  res.json({
    success: true,
    message: 'POS terminal deleted successfully'
  });
}));

// Get branch network configuration
router.get('/config', asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;
  
  let query = 'SELECT * FROM branch_network_config WHERE 1=1';
  const params: any[] = [];
  
  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  
  query += ' ORDER BY category ASC, config_key ASC';
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

// Update branch network configuration
router.patch('/config/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { config_value, description } = req.body;
  
  if (!config_value) {
    return res.status(400).json({
      success: false,
      error: 'config_value is required'
    });
  }
  
  const query = `
    UPDATE branch_network_config 
    SET 
      config_value = $2,
      description = COALESCE($3, description),
      updated_at = NOW()
    WHERE config_key = $1 AND is_system = false
    RETURNING *
  `;
  
  const result = await DatabaseManager.query(query, [
    key, config_value, description
  ]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'Network configuration not found or is a system setting'
    });
  }
  
  res.json({
    success: true,
    data: result.rows[0]
  });
}));

// Test connection to POS terminal
router.post('/terminals/:id/test-connection', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Get POS terminal details
  const terminalQuery = 'SELECT * FROM pos_terminals WHERE id = $1';
  const terminalResult = await DatabaseManager.query(terminalQuery, [id]);
  
  if (terminalResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: 'POS terminal not found'
    });
  }
  
  const terminal = terminalResult.rows[0];
  
  try {
    // Test HTTP connection using built-in fetch
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`http://${terminal.ip_address}:${terminal.port}/`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok;
    
    // Log the connection test
    const logQuery = `
      INSERT INTO connection_health_logs (
        source_type, source_id, target_type, target_id,
        connection_status, response_time_ms, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    
    await DatabaseManager.query(logQuery, [
      'branch_core', process.env.BRANCH_ID || 'unknown',
      'pos_terminal', terminal.terminal_id,
      isHealthy ? 'success' : 'failed',
      responseTime
    ]);
    
    // Update terminal status
    const updateQuery = `
      UPDATE pos_terminals 
      SET 
        status = $2,
        last_seen = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `;
    
    await DatabaseManager.query(updateQuery, [
      id, isHealthy ? 'online' : 'error'
    ]);
    
    res.json({
      success: true,
      data: {
        status: isHealthy ? 'online' : 'error',
        response_time_ms: responseTime,
        message: isHealthy ? 'Connection successful' : 'Connection failed'
      }
    });
    
  } catch (error: any) {
    // Log the failed connection
    const logQuery = `
      INSERT INTO connection_health_logs (
        source_type, source_id, target_type, target_id,
        connection_status, error_message, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    
    await DatabaseManager.query(logQuery, [
      'branch_core', process.env.BRANCH_ID || 'unknown',
      'pos_terminal', terminal.terminal_id,
      'error',
      error.message
    ]);
    
    // Update terminal status to error
    const updateQuery = `
      UPDATE pos_terminals 
      SET 
        status = 'error',
        last_seen = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `;
    
    await DatabaseManager.query(updateQuery, [id]);
    
    res.json({
      success: false,
      data: {
        status: 'error',
        message: error.message
      }
    });
  }
}));

// Get connection health logs
router.get('/health-logs', asyncHandler(async (req: Request, res: Response) => {
  const { limit = 50, source_type, target_type } = req.query;
  
  let query = `
    SELECT * FROM connection_health_logs
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (source_type) {
    params.push(source_type);
    query += ` AND source_type = $${params.length}`;
  }
  
  if (target_type) {
    params.push(target_type);
    query += ` AND target_type = $${params.length}`;
  }
  
  query += ` ORDER BY checked_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  
  const result = await DatabaseManager.query(query, params);
  
  res.json({
    success: true,
    data: result.rows
  });
}));

// Network discovery - scan for POS terminals on the network
router.post('/terminals/discover', asyncHandler(async (req: Request, res: Response) => {
  const { ip_range } = req.body;
  
  // This is a placeholder for network discovery functionality
  // In a real implementation, you would scan the network for devices
  res.json({
    success: true,
    message: 'Network discovery initiated',
    data: {
      scanning_range: ip_range || '192.168.1.0/24',
      status: 'in_progress'
    }
  });
}));

// Get client IP address (helper for terminals)
router.get('/client-ip', (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress || 
                    (req.connection as any)?.socket?.remoteAddress ||
                    req.headers['x-forwarded-for'] as string ||
                    req.headers['x-real-ip'] as string;

    res.json({
      success: true,
      ip: clientIp,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'user-agent': req.headers['user-agent']
      }
    });
  } catch (error) {
    console.error('Error getting client IP:', error);
    res.status(500).json({ success: false, error: 'Failed to get client IP' });
  }
});

export default router;
