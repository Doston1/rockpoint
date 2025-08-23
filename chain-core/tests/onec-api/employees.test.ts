import { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../../src/database/manager';
import { createAuthHeaders, createMockBranch, createMockEmployee, createTestApp } from '../helpers/testApp';

let app: Express;
let testBranchId: string;

beforeAll(async () => {
  app = await createTestApp();
  
  // Ensure database is ready before creating test data
  await DatabaseManager.initialize();
  
  // Create test branch
  const branch = createMockBranch();
  const branchResult = await DatabaseManager.query(`
    INSERT INTO branches (code, name, is_active) VALUES ($1, $2, $3) RETURNING id
  `, [branch.code, branch.name, branch.is_active]);
  testBranchId = branchResult.rows[0].id;
});

beforeEach(async () => {
  // Clean up employees table before each test (ensure db is ready)
  try {
    await DatabaseManager.query('DELETE FROM employees');
  } catch (error: any) {
    if (error.message.includes('Database not initialized')) {
      await DatabaseManager.initialize();
      await DatabaseManager.query('DELETE FROM employees');
    } else {
      throw error;
    }
  }
});

afterAll(async () => {
  // Clean up test branch
  await DatabaseManager.query('DELETE FROM branches WHERE id = $1', [testBranchId]);
});

describe('1C API - Employees Management', () => {
  describe('GET /api/1c/employees', () => {
    test('should return empty list when no employees exist', async () => {
      const response = await request(app)
        .get('/api/1c/employees')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employees).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('should return employees with pagination', async () => {
      // Create employees
      const employee1 = createMockEmployee({ employee_id: 'EMP001', name: 'John Doe' });
      const employee2 = createMockEmployee({ employee_id: 'EMP002', name: 'Jane Smith' });

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, phone, email, hire_date, salary, status, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [testBranchId, employee1.employee_id, employee1.name, employee1.role, employee1.phone, employee1.email, employee1.hire_date, employee1.salary, employee1.status, employee1.onec_id]);

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, phone, email, hire_date, salary, status, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [testBranchId, employee2.employee_id, employee2.name, employee2.role, employee2.phone, employee2.email, employee2.hire_date, employee2.salary, employee2.status, employee2.onec_id]);

      const response = await request(app)
        .get('/api/1c/employees')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employees).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    test('should filter employees by branch', async () => {
      // Create another branch
      const branch2Result = await DatabaseManager.query(`
        INSERT INTO branches (code, name, is_active) VALUES ($1, $2, $3) RETURNING id
      `, ['BR002', 'Branch Two', true]);
      const testBranchId2 = branch2Result.rows[0].id;

      // Create employees in different branches
      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, 'EMP001', 'Employee 1', 'cashier', 'active']);

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId2, 'EMP002', 'Employee 2', 'manager', 'active']);

      // Get branch code for filtering
      const branchResult = await DatabaseManager.query('SELECT code FROM branches WHERE id = $1', [testBranchId]);
      const branchCode = branchResult.rows[0].code;

      const response = await request(app)
        .get(`/api/1c/employees?branch_code=${branchCode}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employees).toHaveLength(1);
      expect(response.body.data.employees[0].name).toBe('Employee 1');

      // Clean up
      await DatabaseManager.query('DELETE FROM branches WHERE id = $1', [testBranchId2]);
    });

    test('should filter employees by status', async () => {
      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, 'ACTIVE', 'Active Employee', 'cashier', 'active']);

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, 'INACTIVE', 'Inactive Employee', 'cashier', 'inactive']);

      const response = await request(app)
        .get('/api/1c/employees?status=active')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employees).toHaveLength(1);
      expect(response.body.data.employees[0].employee_id).toBe('ACTIVE');
    });

    test('should filter employees by role', async () => {
      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, 'CASHIER1', 'Cashier One', 'cashier', 'active']);

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, 'MANAGER1', 'Manager One', 'manager', 'active']);

      const response = await request(app)
        .get('/api/1c/employees?role=manager')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employees).toHaveLength(1);
      expect(response.body.data.employees[0].role).toBe('manager');
    });

    test('should search employees by name', async () => {
      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, 'SEARCH1', 'John Smith', 'cashier', 'active']);

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, 'SEARCH2', 'Jane Doe', 'manager', 'active']);

      const response = await request(app)
        .get('/api/1c/employees?search=John')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employees).toHaveLength(1);
      expect(response.body.data.employees[0].name).toBe('John Smith');
    });
  });

  describe('GET /api/1c/employees/:id', () => {
    test('should return employee by employee_id', async () => {
      const employee = createMockEmployee();

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, phone, email, hire_date, salary, status, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [testBranchId, employee.employee_id, employee.name, employee.role, employee.phone, employee.email, employee.hire_date, employee.salary, employee.status, employee.onec_id]);

      const response = await request(app)
        .get(`/api/1c/employees/${employee.employee_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee.employee_id).toBe(employee.employee_id);
      expect(response.body.data.employee.name).toBe(employee.name);
      expect(response.body.data.employee.role).toBe(employee.role);
    });

    test('should return employee by onec_id', async () => {
      const employee = createMockEmployee();

      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, onec_id, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [testBranchId, employee.employee_id, employee.name, employee.role, employee.onec_id, employee.status]);

      const response = await request(app)
        .get(`/api/1c/employees/${employee.onec_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee.onec_id).toBe(employee.onec_id);
    });

    test('should return 404 for non-existent employee', async () => {
      const response = await request(app)
        .get('/api/1c/employees/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Employee not found');
    });
  });

  describe('POST /api/1c/employees', () => {
    test('should create new employee successfully', async () => {
      // Get branch code for the request
      const branchResult = await DatabaseManager.query('SELECT code FROM branches WHERE id = $1', [testBranchId]);
      const branchCode = branchResult.rows[0].code;

      const newEmployee = {
        ...createMockEmployee(),
        branch_code: branchCode
      };

      const response = await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send([newEmployee])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[0].action).toBe('created');

      // Verify employee was created in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM employees WHERE employee_id = $1',
        [newEmployee.employee_id]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe(newEmployee.name);
      expect(dbResult.rows[0].role).toBe(newEmployee.role);
    });

    test('should update existing employee', async () => {
      const branchResult = await DatabaseManager.query('SELECT code FROM branches WHERE id = $1', [testBranchId]);
      const branchCode = branchResult.rows[0].code;

      const employee = createMockEmployee({ name: 'Original Name' });

      // Create employee first
      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, onec_id, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [testBranchId, employee.employee_id, employee.name, employee.role, employee.onec_id, employee.status]);

      // Update with new data
      const updatedEmployee = { 
        ...employee, 
        name: 'Updated Name',
        branch_code: branchCode
      };

      const response = await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send([updatedEmployee])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results[0].action).toBe('updated');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM employees WHERE employee_id = $1',
        [employee.employee_id]
      );
      expect(dbResult.rows[0].name).toBe('Updated Name');
    });

    test('should handle multiple employees in single request', async () => {
      const branchResult = await DatabaseManager.query('SELECT code FROM branches WHERE id = $1', [testBranchId]);
      const branchCode = branchResult.rows[0].code;

      const employee1 = {
        ...createMockEmployee({ employee_id: 'MULTI1', oneC_id: 'M1' }),
        branch_code: branchCode
      };
      const employee2 = {
        ...createMockEmployee({ employee_id: 'MULTI2', oneC_id: 'M2' }),
        branch_code: branchCode
      };

      const response = await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send([employee1, employee2])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);
      expect(response.body.data.failed).toBe(0);

      // Verify both employees were created
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM employees WHERE employee_id IN ($1, $2)',
        [employee1.employee_id, employee2.employee_id]
      );
      expect(dbResult.rows).toHaveLength(2);
    });

    test('should handle validation errors gracefully', async () => {
      const invalidEmployee = {
        // Missing required fields
        name: 'Invalid Employee'
      };

      const response = await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send([invalidEmployee])
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle non-existent branch code', async () => {
      const employee = {
        ...createMockEmployee(),
        branch_code: 'NON_EXISTENT_BRANCH'
      };

      const response = await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send([employee])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(0);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.results[0].success).toBe(false);
      expect(response.body.data.results[0].error).toContain('Branch not found');
    });
  });

  describe('PUT /api/1c/employees/:id', () => {
    test('should update specific employee successfully', async () => {
      const employee = createMockEmployee();

      // Create employee first
      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, phone, status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [testBranchId, employee.employee_id, employee.name, employee.role, employee.phone, employee.status]);

      const updateData = {
        name: 'Updated Employee Name',
        phone: '+998901111111',
        role: 'manager'
      };

      const response = await request(app)
        .put(`/api/1c/employees/${employee.employee_id}`)
        .set(createAuthHeaders())
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Employee updated successfully');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM employees WHERE employee_id = $1',
        [employee.employee_id]
      );
      expect(dbResult.rows[0].name).toBe('Updated Employee Name');
      expect(dbResult.rows[0].phone).toBe('+998901111111');
      expect(dbResult.rows[0].role).toBe('manager');
    });

    test('should return 404 for non-existent employee', async () => {
      const response = await request(app)
        .put('/api/1c/employees/NON_EXISTENT')
        .set(createAuthHeaders())
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Employee not found');
    });
  });

  describe('DELETE /api/1c/employees/:id', () => {
    test('should deactivate employee successfully', async () => {
      const employee = createMockEmployee();

      // Create employee first
      await DatabaseManager.query(`
        INSERT INTO employees (branch_id, employee_id, name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [testBranchId, employee.employee_id, employee.name, employee.role, 'active']);

      const response = await request(app)
        .delete(`/api/1c/employees/${employee.employee_id}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('has been deactivated');

      // Verify employee is deactivated in database
      const dbResult = await DatabaseManager.query(
        'SELECT status FROM employees WHERE employee_id = $1',
        [employee.employee_id]
      );
      expect(dbResult.rows[0].status).toBe('inactive');
    });

    test('should return 404 for non-existent employee', async () => {
      const response = await request(app)
        .delete('/api/1c/employees/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Employee not found');
    });
  });

  describe('Employee role validation', () => {
    test('should accept valid roles', async () => {
      const branchResult = await DatabaseManager.query('SELECT code FROM branches WHERE id = $1', [testBranchId]);
      const branchCode = branchResult.rows[0].code;

      const validRoles = ['cashier', 'manager', 'supervisor', 'admin'];

      for (const role of validRoles) {
        const employee = {
          ...createMockEmployee({ employee_id: `ROLE_${role.toUpperCase()}`, role }),
          branch_code: branchCode
        };

        const response = await request(app)
          .post('/api/1c/employees')
          .set(createAuthHeaders())
          .send([employee])
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.imported).toBe(1);
      }

      // Verify all employees were created with correct roles
      const dbResult = await DatabaseManager.query(
        'SELECT role FROM employees WHERE employee_id LIKE $1',
        ['ROLE_%']
      );
      expect(dbResult.rows).toHaveLength(validRoles.length);
    });
  });

  describe('Employee salary handling', () => {
    test('should handle salary field correctly', async () => {
      const branchResult = await DatabaseManager.query('SELECT code FROM branches WHERE id = $1', [testBranchId]);
      const branchCode = branchResult.rows[0].code;

      const employee = {
        ...createMockEmployee({ salary: 5000000.50 }),
        branch_code: branchCode
      };

      const response = await request(app)
        .post('/api/1c/employees')
        .set(createAuthHeaders())
        .send([employee])
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify salary was stored correctly
      const dbResult = await DatabaseManager.query(
        'SELECT salary FROM employees WHERE employee_id = $1',
        [employee.employee_id]
      );
      expect(parseFloat(dbResult.rows[0].salary)).toBe(5000000.50);
    });
  });
});
