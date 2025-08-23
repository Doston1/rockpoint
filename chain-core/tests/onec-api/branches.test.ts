import { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../../src/database/manager';
import { createAuthHeaders, createMockBranch, createTestApp } from '../helpers/testApp';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  // Clean up tables with foreign key dependencies in proper order
  await DatabaseManager.query('DELETE FROM employees');
  await DatabaseManager.query('DELETE FROM branches');
});

describe('1C API - Branches Management', () => {
  describe('GET /api/1c/branches', () => {
    test('should return empty list when no branches exist', async () => {
      const response = await request(app)
        .get('/api/1c/branches')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branches).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    test('should return branches with proper pagination', async () => {
      // Create test branches directly in database
      const branch1 = createMockBranch({ code: 'BR001', name: 'Branch One' });
      const branch2 = createMockBranch({ code: 'BR002', name: 'Branch Two' });
      
      await DatabaseManager.query(`
        INSERT INTO branches (code, name, address, phone, email, manager_name, timezone, currency, tax_rate, is_active, api_endpoint, network_status, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        branch1.code, branch1.name, branch1.address, branch1.phone, branch1.email,
        branch1.manager_name, branch1.timezone, branch1.currency, branch1.tax_rate,
        branch1.is_active, branch1.api_endpoint, branch1.network_status, branch1.onec_id
      ]);

      await DatabaseManager.query(`
        INSERT INTO branches (code, name, address, phone, email, manager_name, timezone, currency, tax_rate, is_active, api_endpoint, network_status, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        branch2.code, branch2.name, branch2.address, branch2.phone, branch2.email,
        branch2.manager_name, branch2.timezone, branch2.currency, branch2.tax_rate,
        branch2.is_active, branch2.api_endpoint, branch2.network_status, branch2.onec_id
      ]);

      const response = await request(app)
        .get('/api/1c/branches')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branches).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(100);
    });

    test('should filter branches by active status', async () => {
      const activeBranch = createMockBranch({ code: 'ACTIVE', is_active: true });
      const inactiveBranch = createMockBranch({ code: 'INACTIVE', is_active: false });

      await DatabaseManager.query(`
        INSERT INTO branches (code, name, is_active) VALUES ($1, $2, $3)
      `, [activeBranch.code, activeBranch.name, activeBranch.is_active]);

      await DatabaseManager.query(`
        INSERT INTO branches (code, name, is_active) VALUES ($1, $2, $3)
      `, [inactiveBranch.code, inactiveBranch.name, inactiveBranch.is_active]);

      const response = await request(app)
        .get('/api/1c/branches?is_active=true')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branches).toHaveLength(1);
      expect(response.body.data.branches[0].code).toBe('ACTIVE');
    });

    test('should search branches by name and code', async () => {
      const branch1 = createMockBranch({ code: 'SEARCH001', name: 'Main Store' });
      const branch2 = createMockBranch({ code: 'OTHER002', name: 'Side Branch' });

      await DatabaseManager.query(`
        INSERT INTO branches (code, name) VALUES ($1, $2)
      `, [branch1.code, branch1.name]);

      await DatabaseManager.query(`
        INSERT INTO branches (code, name) VALUES ($1, $2)
      `, [branch2.code, branch2.name]);

      const response = await request(app)
        .get('/api/1c/branches?search=Main')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branches).toHaveLength(1);
      expect(response.body.data.branches[0].name).toBe('Main Store');
    });

    test('should handle pagination correctly', async () => {
      // Create 3 branches
      for (let i = 1; i <= 3; i++) {
        await DatabaseManager.query(`
          INSERT INTO branches (code, name) VALUES ($1, $2)
        `, [`BR${i.toString().padStart(3, '0')}`, `Branch ${i}`]);
      }

      const response = await request(app)
        .get('/api/1c/branches?page=1&limit=2')
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branches).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.pages).toBe(2);
    });
  });

  describe('GET /api/1c/branches/:code', () => {
    test('should return specific branch by code', async () => {
      const branch = createMockBranch();
      
      await DatabaseManager.query(`
        INSERT INTO branches (code, name, address, phone, email, manager_name, timezone, currency, tax_rate, is_active, api_endpoint, network_status, onec_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        branch.code, branch.name, branch.address, branch.phone, branch.email,
        branch.manager_name, branch.timezone, branch.currency, branch.tax_rate,
        branch.is_active, branch.api_endpoint, branch.network_status, branch.onec_id
      ]);

      const response = await request(app)
        .get(`/api/1c/branches/${branch.code}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.code).toBe(branch.code);
      expect(response.body.data.branch.name).toBe(branch.name);
      expect(response.body.data.branch.phone).toBe(branch.phone);
    });

    test('should return 404 for non-existent branch', async () => {
      const response = await request(app)
        .get('/api/1c/branches/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Branch not found');
    });

    test('should include servers when requested', async () => {
      const branch = createMockBranch();
      
      // Insert branch
      const branchResult = await DatabaseManager.query(`
        INSERT INTO branches (code, name) VALUES ($1, $2) RETURNING id
      `, [branch.code, branch.name]);
      
      const branchId = branchResult.rows[0].id;

      // Insert server
      await DatabaseManager.query(`
        INSERT INTO branch_servers (branch_id, server_name, ip_address, port)
        VALUES ($1, $2, $3, $4)
      `, [branchId, 'Test Server', '192.168.1.100', 3000]);

      const response = await request(app)
        .get(`/api/1c/branches/${branch.code}?include_servers=true`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.servers).toBeDefined();
      expect(response.body.data.branch.servers).toHaveLength(1);
      expect(response.body.data.branch.servers[0].server_name).toBe('Test Server');
    });
  });

  describe('POST /api/1c/branches', () => {
    test('should create new branch successfully', async () => {
      const newBranch = createMockBranch();

      const response = await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([newBranch])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[0].action).toBe('created');

      // Verify branch was created in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM branches WHERE code = $1',
        [newBranch.code]
      );
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].name).toBe(newBranch.name);
    });

    test('should update existing branch', async () => {
      const branch = createMockBranch();
      
      // First create the branch
      await DatabaseManager.query(`
        INSERT INTO branches (code, name, onec_id) VALUES ($1, $2, $3)
      `, [branch.code, 'Old Name', branch.onec_id]);

      // Update with new data
      const updatedBranch = { ...branch, name: 'Updated Name' };

      const response = await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([updatedBranch])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results[0].action).toBe('updated');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM branches WHERE code = $1',
        [branch.code]
      );
      expect(dbResult.rows[0].name).toBe('Updated Name');
    });

    test('should handle multiple branches in single request', async () => {
      const branch1 = createMockBranch({ code: 'MULTI1', onec_id: 'M1' });
      const branch2 = createMockBranch({ code: 'MULTI2', onec_id: 'M2' });

      const response = await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([branch1, branch2])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);
      expect(response.body.data.failed).toBe(0);

      // Verify both branches were created
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM branches WHERE code IN ($1, $2)',
        [branch1.code, branch2.code]
      );
      expect(dbResult.rows).toHaveLength(2);
    });

    test('should handle validation errors gracefully', async () => {
      const invalidBranch = {
        // Missing required 'code' field
        name: 'Invalid Branch'
      };

      const response = await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([invalidBranch])
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle partial success scenarios', async () => {
      const validBranch = createMockBranch({ code: 'VALID' });
      const invalidBranch = { code: '', name: '' }; // Invalid data

      const response = await request(app)
        .post('/api/1c/branches')
        .set(createAuthHeaders())
        .send([validBranch, invalidBranch])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.results[0].success).toBe(true);
      expect(response.body.data.results[1].success).toBe(false);
    });
  });

  describe('PUT /api/1c/branches/:code', () => {
    test('should update specific branch successfully', async () => {
      const branch = createMockBranch();
      
      // Create branch first
      await DatabaseManager.query(`
        INSERT INTO branches (code, name, phone) VALUES ($1, $2, $3)
      `, [branch.code, branch.name, branch.phone]);

      const updateData = {
        name: 'Updated Branch Name',
        phone: '+998901111111'
      };

      const response = await request(app)
        .put(`/api/1c/branches/${branch.code}`)
        .set(createAuthHeaders())
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Branch updated successfully');

      // Verify update in database
      const dbResult = await DatabaseManager.query(
        'SELECT * FROM branches WHERE code = $1',
        [branch.code]
      );
      expect(dbResult.rows[0].name).toBe('Updated Branch Name');
      expect(dbResult.rows[0].phone).toBe('+998901111111');
    });

    test('should return 404 for non-existent branch', async () => {
      const response = await request(app)
        .put('/api/1c/branches/NON_EXISTENT')
        .set(createAuthHeaders())
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Branch not found');
    });
  });

  describe('DELETE /api/1c/branches/:code', () => {
    test('should deactivate branch successfully', async () => {
      const branch = createMockBranch();
      
      // Create branch first
      await DatabaseManager.query(`
        INSERT INTO branches (code, name, is_active) VALUES ($1, $2, $3)
      `, [branch.code, branch.name, true]);

      const response = await request(app)
        .delete(`/api/1c/branches/${branch.code}`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('has been deactivated');

      // Verify branch is deactivated in database
      const dbResult = await DatabaseManager.query(
        'SELECT is_active FROM branches WHERE code = $1',
        [branch.code]
      );
      expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('should return 404 for non-existent branch', async () => {
      const response = await request(app)
        .delete('/api/1c/branches/NON_EXISTENT')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Branch not found');
    });
  });

  describe('GET /api/1c/branches/:code/status', () => {
    test('should return branch status information', async () => {
      const branch = createMockBranch();
      
      // Create branch
      const branchResult = await DatabaseManager.query(`
        INSERT INTO branches (code, name, network_status, api_endpoint, last_sync_at)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [branch.code, branch.name, 'online', 'http://localhost:3000', new Date()]);
      
      const branchId = branchResult.rows[0].id;

      // Add server
      await DatabaseManager.query(`
        INSERT INTO branch_servers (branch_id, server_name, ip_address, port, status)
        VALUES ($1, $2, $3, $4, $5)
      `, [branchId, 'Main Server', '192.168.1.100', 3000, 'online']);

      const response = await request(app)
        .get(`/api/1c/branches/${branch.code}/status`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.branch.code).toBe(branch.code);
      expect(response.body.data.branch.network_status).toBe('online');
      expect(response.body.data.servers).toHaveLength(1);
      expect(response.body.data.servers[0].server_name).toBe('Main Server');
    });

    test('should return 404 for non-existent branch', async () => {
      const response = await request(app)
        .get('/api/1c/branches/NON_EXISTENT/status')
        .set(createAuthHeaders())
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Branch not found');
    });
  });

  describe('Branch Servers Management', () => {
    test('should get branch servers', async () => {
      const branch = createMockBranch();
      
      // Create branch
      const branchResult = await DatabaseManager.query(`
        INSERT INTO branches (code, name) VALUES ($1, $2) RETURNING id
      `, [branch.code, branch.name]);
      
      const branchId = branchResult.rows[0].id;

      // Add servers
      await DatabaseManager.query(`
        INSERT INTO branch_servers (branch_id, server_name, ip_address, port)
        VALUES ($1, $2, $3, $4)
      `, [branchId, 'Server 1', '192.168.1.100', 3000]);

      await DatabaseManager.query(`
        INSERT INTO branch_servers (branch_id, server_name, ip_address, port)
        VALUES ($1, $2, $3, $4)
      `, [branchId, 'Server 2', '192.168.1.101', 3001]);

      const response = await request(app)
        .get(`/api/1c/branches/${branch.code}/servers`)
        .set(createAuthHeaders())
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.servers).toHaveLength(2);
    });

    test('should add server to branch', async () => {
      const branch = createMockBranch();
      
      // Create branch
      await DatabaseManager.query(`
        INSERT INTO branches (code, name) VALUES ($1, $2)
      `, [branch.code, branch.name]);

      const serverData = {
        server_name: 'New Server',
        ip_address: '192.168.1.200',
        port: 3000,
        api_port: 3001,
        network_type: 'local'
      };

      const response = await request(app)
        .post(`/api/1c/branches/${branch.code}/servers`)
        .set(createAuthHeaders())
        .send(serverData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Server added successfully');

      // Verify server was added to database
      const dbResult = await DatabaseManager.query(`
        SELECT * FROM branch_servers bs
        JOIN branches b ON bs.branch_id = b.id
        WHERE b.code = $1 AND bs.server_name = $2
      `, [branch.code, serverData.server_name]);
      
      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].ip_address).toBe(serverData.ip_address);
    });

    test('should prevent duplicate server names in same branch', async () => {
      const branch = createMockBranch();
      
      // Create branch and server
      const branchResult = await DatabaseManager.query(`
        INSERT INTO branches (code, name) VALUES ($1, $2) RETURNING id
      `, [branch.code, branch.name]);
      
      const branchId = branchResult.rows[0].id;

      await DatabaseManager.query(`
        INSERT INTO branch_servers (branch_id, server_name, ip_address, port)
        VALUES ($1, $2, $3, $4)
      `, [branchId, 'Existing Server', '192.168.1.100', 3000]);

      const duplicateServer = {
        server_name: 'Existing Server',
        ip_address: '192.168.1.101',
        port: 3001
      };

      const response = await request(app)
        .post(`/api/1c/branches/${branch.code}/servers`)
        .set(createAuthHeaders())
        .send(duplicateServer)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });
  });
});
