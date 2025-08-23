import express from 'express';
import request from 'supertest';
import fastpayRouter from '../../src/api/uzum-bank/fastpay';
import { DatabaseManager } from '../../src/database/manager';
import { FastPayService } from '../../src/services/FastPayService';
import {
  cleanupDatabase,
  createTestConfig,
  generateMockOrderId,
  generateMockQRCode,
  generateMockTransactionId,
  generateTestPaymentData
} from '../setup';

// Mock FastPayService
jest.mock('../../src/services/FastPayService');
const mockedFastPayService = FastPayService as any;

describe('FastPay API Endpoints', () => {
  let app: express.Application;

  beforeEach(async () => {
    await cleanupDatabase();
    await createTestConfig();

    // Create Express app with the FastPay router
    app = express();
    app.use(express.json());
    app.use('/api/payments/fastpay', fastpayRouter);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/payments/fastpay', () => {
    test('should create payment successfully', async () => {
      const mockOrderId = generateMockOrderId();
      const mockTransactionId = generateMockTransactionId();
      const testPaymentData = generateTestPaymentData();
      
      mockedFastPayService.createPayment.mockResolvedValueOnce({
        success: true,
        data: {
          fastpay_transaction_id: mockTransactionId,
          order_id: mockOrderId,
          status: 'success',
          amount_uzs: testPaymentData.amount_uzs,
          created_at: new Date().toISOString()
        }
      });

      const response = await request(app)
        .post('/api/payments/fastpay')
        .send(testPaymentData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          fastpay_transaction_id: mockTransactionId,
          order_id: mockOrderId,
          status: 'success',
          amount_uzs: testPaymentData.amount_uzs
        }
      });

      expect(mockedFastPayService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_uzs: testPaymentData.amount_uzs,
          otp_data: testPaymentData.otp_data,
          employee_id: testPaymentData.employee_id,
          terminal_id: testPaymentData.terminal_id
        })
      );

      expect(mockedFastPayService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_uzs: testPaymentData.amount_uzs,
          otp_data: testPaymentData.otp_data,
          employee_id: testPaymentData.employee_id,
          terminal_id: testPaymentData.terminal_id
        })
      );
    });

    test('should handle payment failure', async () => {
      const testPaymentData = generateTestPaymentData({ amount_uzs: 100000 });
      
      mockedFastPayService.createPayment.mockResolvedValueOnce({
        success: false,
        error: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds in account'
      });

      const response = await request(app)
        .post('/api/payments/fastpay')
        .send(testPaymentData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: false,
        error: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds in account'
      });
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/payments/fastpay')
        .send({
          amount_uzs: 50000,
          // Missing otp_data
          employee_id: 'emp_001',
          terminal_id: 'term_001'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation error',
        message: 'Invalid request data'
      });
    });

    test('should validate amount constraints', async () => {
      // Test negative amount
      const response1 = await request(app)
        .post('/api/payments/fastpay')
        .send({
          amount_uzs: -1000,
          otp_data: generateMockQRCode(),
          employee_id: 'emp_001',
          terminal_id: 'term_001'
        });

      expect(response1.status).toBe(400);

      // Test zero amount
      const response2 = await request(app)
        .post('/api/payments/fastpay')
        .send({
          amount_uzs: 0,
          otp_data: generateMockQRCode(),
          employee_id: 'emp_001',
          terminal_id: 'term_001'
        });

      expect(response2.status).toBe(400);

      // Test amount too large
      const response3 = await request(app)
        .post('/api/payments/fastpay')
        .send({
          amount_uzs: 9999999999,
          otp_data: generateMockQRCode(),
          employee_id: 'emp_001',
          terminal_id: 'term_001'
        });

      expect(response3.status).toBe(400);
    });

    test('should validate QR code data length', async () => {
      // Test QR code too short
      const response1 = await request(app)
        .post('/api/payments/fastpay')
        .send({
          amount_uzs: 50000,
          otp_data: 'short',
          employee_id: 'emp_001',
          terminal_id: 'term_001'
        });

      expect(response1.status).toBe(400);

      // Test QR code too long
      const response2 = await request(app)
        .post('/api/payments/fastpay')
        .send({
          amount_uzs: 50000,
          otp_data: 'a'.repeat(501),
          employee_id: 'emp_001',
          terminal_id: 'term_001'
        });

      expect(response2.status).toBe(400);
    });

    test('should handle service errors', async () => {
      mockedFastPayService.createPayment.mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .post('/api/payments/fastpay')
        .send({
          amount_uzs: 50000,
          otp_data: generateMockQRCode(),
          employee_id: 'emp_001',
          terminal_id: 'term_001'
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing the payment'
      });
    });
  });

  describe('POST /api/payments/fastpay/:id/fiscalize', () => {
    test('should submit fiscal receipt successfully', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();
      
      mockedFastPayService.submitFiscalization.mockResolvedValueOnce({
        success: true
      });

      const response = await request(app)
        .post(`/api/payments/fastpay/${mockTransactionId}/fiscalize`)
        .send({
          fiscal_url: 'https://fiscal.uz/receipt/123456'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Fiscal receipt submitted successfully'
      });

      expect(mockedFastPayService.submitFiscalization).toHaveBeenCalledWith(
        mockTransactionId,
        'https://fiscal.uz/receipt/123456'
      );
    });

    test('should validate fiscal URL format', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();

      const response = await request(app)
        .post(`/api/payments/fastpay/${mockTransactionId}/fiscalize`)
        .send({
          fiscal_url: 'invalid-url'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation error'
      });
    });

    test('should handle fiscalization service errors', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();
      
      mockedFastPayService.submitFiscalization.mockResolvedValueOnce({
        success: false,
        error: 'Transaction not found'
      });

      const response = await request(app)
        .post(`/api/payments/fastpay/${mockTransactionId}/fiscalize`)
        .send({
          fiscal_url: 'https://fiscal.uz/receipt/123456'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Fiscalization failed',
        message: 'Transaction not found'
      });
    });
  });

  describe('PUT /api/payments/fastpay/:orderId/reverse', () => {
    test('should reverse payment successfully', async () => {
      const mockOrderId = generateMockOrderId();
      
      mockedFastPayService.reversePayment.mockResolvedValueOnce({
        success: true
      });

      const response = await request(app)
        .put(`/api/payments/fastpay/${mockOrderId}/reverse`)
        .send({
          reason: 'Customer request',
          requested_by: 'emp_001'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment reversed successfully'
      });

      expect(mockedFastPayService.reversePayment).toHaveBeenCalledWith(
        mockOrderId,
        'Customer request',
        'emp_001'
      );
    });

    test('should validate reversal request', async () => {
      const mockOrderId = generateMockOrderId();

      // Test missing reason
      const response1 = await request(app)
        .put(`/api/payments/fastpay/${mockOrderId}/reverse`)
        .send({
          requested_by: 'emp_001'
        });

      expect(response1.status).toBe(400);

      // Test missing requested_by
      const response2 = await request(app)
        .put(`/api/payments/fastpay/${mockOrderId}/reverse`)
        .send({
          reason: 'Customer request'
        });

      expect(response2.status).toBe(400);

      // Test reason too long
      const response3 = await request(app)
        .put(`/api/payments/fastpay/${mockOrderId}/reverse`)
        .send({
          reason: 'a'.repeat(501),
          requested_by: 'emp_001'
        });

      expect(response3.status).toBe(400);
    });

    test('should handle reversal service errors', async () => {
      const mockOrderId = generateMockOrderId();
      
      mockedFastPayService.reversePayment.mockResolvedValueOnce({
        success: false,
        error: 'Reversal not allowed'
      });

      const response = await request(app)
        .put(`/api/payments/fastpay/${mockOrderId}/reverse`)
        .send({
          reason: 'Customer request',
          requested_by: 'emp_001'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Reversal failed',
        message: 'Reversal not allowed'
      });
    });
  });

  describe('GET /api/payments/fastpay/:id/status', () => {
    test('should check payment status successfully', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();
      
      mockedFastPayService.checkPaymentStatus.mockResolvedValueOnce({
        success: true,
        status: 'success'
      });

      const response = await request(app)
        .get(`/api/payments/fastpay/${mockTransactionId}/status`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'success'
        }
      });

      expect(mockedFastPayService.checkPaymentStatus).toHaveBeenCalledWith(
        mockTransactionId
      );
    });

    test('should handle status check errors', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();
      
      mockedFastPayService.checkPaymentStatus.mockResolvedValueOnce({
        success: false,
        error: 'Transaction not found'
      });

      const response = await request(app)
        .get(`/api/payments/fastpay/${mockTransactionId}/status`);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Status check failed',
        message: 'Transaction not found'
      });
    });
  });

  describe('GET /api/payments/fastpay/:id', () => {
    test('should get transaction details successfully', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();
      const mockTransaction = {
        id: mockTransactionId,
        order_id: generateMockOrderId(),
        amount_uzs: '50000',
        status: 'success',
        employee_id: 'emp_001',
        terminal_id: 'term_001',
        created_at: new Date().toISOString()
      };
      
      mockedFastPayService.getTransaction.mockResolvedValueOnce(mockTransaction);

      const response = await request(app)
        .get(`/api/payments/fastpay/${mockTransactionId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockTransaction
      });

      expect(mockedFastPayService.getTransaction).toHaveBeenCalledWith(
        mockTransactionId
      );
    });

    test('should handle transaction not found', async () => {
      const mockTransactionId = 'fp_nonexistent';
      
      mockedFastPayService.getTransaction.mockResolvedValueOnce(null);

      const response = await request(app)
        .get(`/api/payments/fastpay/${mockTransactionId}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Transaction not found',
        message: 'The specified FastPay transaction does not exist'
      });
    });
  });

  describe('GET /api/payments/fastpay', () => {
    test('should list transactions with default pagination', async () => {
      const mockTransactions = {
        transactions: [
          {
            id: 'fp_001',
            order_id: 'order_001',
            amount_uzs: '50000',
            status: 'success'
          },
          {
            id: 'fp_002',
            order_id: 'order_002',
            amount_uzs: '30000',
            status: 'failed'
          }
        ],
        total: 2
      };
      
      mockedFastPayService.getTransactions.mockResolvedValueOnce(mockTransactions);

      const response = await request(app)
        .get('/api/payments/fastpay');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          transactions: mockTransactions.transactions,
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1
          }
        }
      });

      expect(mockedFastPayService.getTransactions).toHaveBeenCalledWith({
        page: 1,
        limit: 20
      });
    });

    test('should list transactions with filters', async () => {
      const mockTransactions = {
        transactions: [],
        total: 0
      };
      
      mockedFastPayService.getTransactions.mockResolvedValueOnce(mockTransactions);

      const response = await request(app)
        .get('/api/payments/fastpay')
        .query({
          status: 'success',
          employee_id: 'emp_001',
          page: 2,
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(mockedFastPayService.getTransactions).toHaveBeenCalledWith({
        status: 'success',
        employeeId: 'emp_001',
        page: 2,
        limit: 10
      });
    });

    test('should validate pagination parameters', async () => {
      // Test invalid page number
      const response1 = await request(app)
        .get('/api/payments/fastpay')
        .query({ page: 0 });

      expect(response1.status).toBe(400);

      // Test limit too large
      const response2 = await request(app)
        .get('/api/payments/fastpay')
        .query({ limit: 101 });

      expect(response2.status).toBe(400);
    });
  });

  describe('POST /api/payments/fastpay/:id/link-transaction', () => {
    test('should link FastPay to POS transaction successfully', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();
      const posTransactionId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock successful database update
      const mockQueryResult = { rowCount: 1 };
      DatabaseManager.query = jest.fn().mockResolvedValueOnce(mockQueryResult);

      const response = await request(app)
        .post(`/api/payments/fastpay/${mockTransactionId}/link-transaction`)
        .send({
          pos_transaction_id: posTransactionId
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'FastPay transaction linked to POS transaction successfully'
      });

      expect(DatabaseManager.query).toHaveBeenCalledWith(
        'UPDATE uzum_fastpay_transactions SET pos_transaction_id = $1 WHERE id = $2 AND status = $3',
        [posTransactionId, mockTransactionId, 'success']
      );
    });

    test('should handle transaction not found for linking', async () => {
      const mockTransactionId = 'fp_nonexistent';
      const posTransactionId = '550e8400-e29b-41d4-a716-446655440000';

      // Mock no rows updated
      const mockQueryResult = { rowCount: 0 };
      DatabaseManager.query = jest.fn().mockResolvedValueOnce(mockQueryResult);

      const response = await request(app)
        .post(`/api/payments/fastpay/${mockTransactionId}/link-transaction`)
        .send({
          pos_transaction_id: posTransactionId
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Transaction not found',
        message: 'FastPay transaction not found or not successful'
      });
    });

    test('should validate UUID format for POS transaction ID', async () => {
      const mockTransactionId = 'fp_' + generateMockOrderId();

      const response = await request(app)
        .post(`/api/payments/fastpay/${mockTransactionId}/link-transaction`)
        .send({
          pos_transaction_id: 'invalid-uuid'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation error'
      });
    });
  });
});
