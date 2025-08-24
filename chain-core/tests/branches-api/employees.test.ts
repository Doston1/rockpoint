import { Express } from 'express';
import request from 'supertest';
import { cleanupTestBranchData, createBranchAuthHeaders, createBranchTestApp, createMockEmployee, createMockTimeLog, setupTestBranchData } from '../helpers/branchTestApp';

let app: Express;
let testData: any;

beforeAll(async () => {
  app = await createBranchTestApp();
  testData = await setupTestBranchData();
});

afterAll(async () => {
  await cleanupTestBranchData();
});

describe('Branch Employees API', () => {
  describe('POST /api/branch-api/employees', () => {
    test('should create a new employee successfully', async () => {
      const employee = createMockEmployee({
        employee_id: 'EMP_CREATE_TEST',
        name: 'Create Test Employee'
      });

      const response = await request(app)
        .post('/api/branch-api/employees')
        .set(createBranchAuthHeaders())
        .send(employee)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee_id).toBe('EMP_CREATE_TEST');
      expect(response.body.data.name).toBe('Create Test Employee');
    });

    test('should validate required employee fields', async () => {
      const invalidEmployee = {
        // Missing required fields
        name: 'Test Employee'
      };

      const response = await request(app)
        .post('/api/branch-api/employees')
        .set(createBranchAuthHeaders())
        .send(invalidEmployee)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle duplicate employee ID', async () => {
      const employee = createMockEmployee({
        employee_id: 'EMP_DUPLICATE_TEST'
      });

      // Create first employee
      await request(app)
        .post('/api/branch-api/employees')
        .set(createBranchAuthHeaders())
        .send(employee)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/branch-api/employees')
        .set(createBranchAuthHeaders())
        .send(employee)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('EMPLOYEE_ALREADY_EXISTS');
    });
  });

  describe('GET /api/branch-api/employees', () => {
    test('should list all employees', async () => {
      const response = await request(app)
        .get('/api/branch-api/employees')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should filter employees by status', async () => {
      const response = await request(app)
        .get('/api/branch-api/employees?status=active')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((emp: any) => {
        expect(emp.status).toBe('active');
      });
    });

    test('should filter employees by role', async () => {
      const response = await request(app)
        .get('/api/branch-api/employees?role=cashier')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/branch-api/employees/:employeeId', () => {
    test('should get employee by ID', async () => {
      const response = await request(app)
        .get('/api/branch-api/employees/EMP_TEST_001')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.employee_id).toBe('EMP_TEST_001');
    });

    test('should return not found for non-existent employee', async () => {
      const response = await request(app)
        .get('/api/branch-api/employees/NON_EXISTENT')
        .set(createBranchAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('EMPLOYEE_NOT_FOUND');
    });
  });

  describe('PUT /api/branch-api/employees/:employeeId', () => {
    test('should update employee successfully', async () => {
      const updateData = {
        name: 'Updated Employee Name',
        phone: '+998901111111',
        salary: 3500000.00
      };

      const response = await request(app)
        .put('/api/branch-api/employees/EMP_TEST_001')
        .set(createBranchAuthHeaders())
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Employee Name');
      expect(response.body.data.phone).toBe('+998901111111');
    });

    test('should validate update data', async () => {
      const invalidUpdate = {
        salary: -1000 // Invalid negative salary
      };

      const response = await request(app)
        .put('/api/branch-api/employees/EMP_TEST_001')
        .set(createBranchAuthHeaders())
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/branch-api/employees/:employeeId', () => {
    test('should deactivate employee successfully', async () => {
      // First create an employee to deactivate
      const employee = createMockEmployee({
        employee_id: 'EMP_DELETE_TEST',
        name: 'Delete Test Employee'
      });

      await request(app)
        .post('/api/branch-api/employees')
        .set(createBranchAuthHeaders())
        .send(employee)
        .expect(201);

      // Then deactivate
      const response = await request(app)
        .delete('/api/branch-api/employees/EMP_DELETE_TEST')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('inactive');
    });
  });

  describe('POST /api/branch-api/employees/:employeeId/time-log', () => {
    test('should log employee time successfully', async () => {
      const timeLog = createMockTimeLog({
        action: 'clock_in',
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/branch-api/employees/EMP_TEST_001/time-log')
        .set(createBranchAuthHeaders())
        .send(timeLog)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('clock_in');
      expect(response.body.data.employee_id).toBe('EMP_TEST_001');
    });

    test('should validate time log data', async () => {
      const invalidTimeLog = {
        // Missing required action
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/api/branch-api/employees/EMP_TEST_001/time-log')
        .set(createBranchAuthHeaders())
        .send(invalidTimeLog)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('should handle invalid employee for time log', async () => {
      const timeLog = createMockTimeLog();

      const response = await request(app)
        .post('/api/branch-api/employees/NON_EXISTENT/time-log')
        .set(createBranchAuthHeaders())
        .send(timeLog)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('EMPLOYEE_NOT_FOUND');
    });
  });

  describe('GET /api/branch-api/employees/:employeeId/time-logs', () => {
    test('should get employee time logs', async () => {
      const response = await request(app)
        .get('/api/branch-api/employees/EMP_TEST_001/time-logs')
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should filter time logs by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await request(app)
        .get(`/api/branch-api/employees/EMP_TEST_001/time-logs?from=${today}&to=${today}`)
        .set(createBranchAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/branch-api/employees/bulk-update', () => {
    test('should bulk update employees', async () => {
      const updates = [
        {
          employee_id: 'EMP_TEST_001',
          salary: 3200000.00
        }
      ];

      const response = await request(app)
        .post('/api/branch-api/employees/bulk-update')
        .set(createBranchAuthHeaders())
        .send({ employees: updates })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated_count).toBe(1);
      expect(response.body.data.failed_count).toBe(0);
    });

    test('should validate bulk update data', async () => {
      const invalidUpdates = [
        {
          // Missing employee_id
          salary: 3000000
        }
      ];

      const response = await request(app)
        .post('/api/branch-api/employees/bulk-update')
        .set(createBranchAuthHeaders())
        .send({ employees: invalidUpdates })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
