import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../database/manager';
import {
  FastPayConfig,
  FastPayCreatePaymentRequest,
  FastPayCreatePaymentResponse,
  FastPayFiscalizationRequest,
  FastPayRequest,
  FastPayResponse,
  FastPayReversalRequest,
  FastPayStatusRequest
} from '../types';

/**
 * FastPay Service Class
 * 
 * Responsible for all Uzum Bank FastPay operations including payment processing,
 * authentication, error handling, and database persistence.
 */
export class FastPayService {
  private static config: FastPayConfig | null = null;
  private static readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static configLastFetched = 0;

  /**
   * Load configuration from database with caching
   * Credentials are stored securely in the uzum_bank_config table
   */
  private static async loadConfig(): Promise<FastPayConfig> {
    const now = Date.now();
    
    // Return cached config if still valid
    if (this.config && (now - this.configLastFetched) < this.CONFIG_CACHE_TTL) {
      return this.config;
    }

    try {
      const result = await DatabaseManager.query(`
        SELECT config_key, config_value, is_encrypted 
        FROM uzum_bank_config 
        WHERE is_active = true
      `);

      const configMap: Record<string, string> = {};
      
      for (const row of result.rows) {
        let value = row.config_value;
        
        // Decrypt sensitive values if needed (implement your encryption/decryption logic)
        if (row.is_encrypted && value !== 'PLACEHOLDER') {
          // TODO: Implement decryption logic for production
          // value = decrypt(value);
        }
        
        configMap[row.config_key] = value;
      }

      // Validate required configuration
      const requiredKeys = ['merchant_service_user_id', 'secret_key', 'service_id'];
      for (const key of requiredKeys) {
        if (!configMap[key] || configMap[key] === 'PLACEHOLDER') {
          throw new Error(`Missing required FastPay configuration: ${key}`);
        }
      }

      this.config = {
        merchant_service_user_id: configMap.merchant_service_user_id,
        secret_key: configMap.secret_key,
        service_id: parseInt(configMap.service_id),
        api_base_url: configMap.api_base_url || 'https://mobile.apelsin.uz',
        request_timeout_ms: parseInt(configMap.request_timeout_ms || '15000'),
        cashbox_code_prefix: configMap.cashbox_code_prefix || 'RockPoint',
        max_retry_attempts: parseInt(configMap.max_retry_attempts || '3'),
        enable_logging: configMap.enable_logging === 'true'
      };

      this.configLastFetched = now;
      return this.config;
    } catch (error) {
      console.error('❌ Failed to load FastPay configuration:', error);
      throw new Error('FastPay service is not properly configured');
    }
  }

  /**
   * Generate authorization header for Uzum Bank API
   * Format: merchant_service_user_id:hash:timestamp
   * Hash: SHA1(timestamp + secret_key)
   */
  private static generateAuthHeader(secretKey: string, merchantServiceUserId: string): string {
    // Generate timestamp in milliseconds for UTC +5 timezone
    const now = new Date();
    const utcPlus5 = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    const timestamp = utcPlus5.getTime();
    
    // Compute SHA1 hash
    const hashInput = timestamp + secretKey;
    const hash = crypto.createHash('sha1').update(hashInput).digest('hex');
    
    return `${merchantServiceUserId}:${hash}:${timestamp}`;
  }

  /**
   * Generate unique cashbox code for this terminal
   */
  private static generateCashboxCode(terminalId: string, prefix: string): string {
    return `${prefix}_${terminalId}`;
  }

  /**
   * Validate QR code data according to Uzum Bank requirements
   * Must be at least 40 characters long
   */
  private static validateOtpData(otpData: string): { isValid: boolean; error?: string } {
    if (!otpData || typeof otpData !== 'string') {
      return { isValid: false, error: 'QR code data is required' };
    }

    if (otpData.length < 40) {
      return { 
        isValid: false, 
        error: 'QR code data must be at least 40 characters long' 
      };
    }

    return { isValid: true };
  }

  /**
   * Convert UZS amount to tiyin (1 UZS = 100 tiyin)
   */
  private static uzsToTiyin(amountUzs: number): number {
    return Math.round(amountUzs * 100);
  }

  /**
   * Convert tiyin amount to UZS
   */
  private static tiyinToUzs(amountTiyin: number): number {
    return Math.round((amountTiyin / 100) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Generate unique order ID ensuring database-level uniqueness
   */
  private static async generateUniqueOrderId(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const orderId = `RP_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Check if order ID already exists
      const result = await DatabaseManager.query(
        'SELECT id FROM uzum_fastpay_transactions WHERE order_id = $1',
        [orderId]
      );

      if (result.rows.length === 0) {
        return orderId;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique order ID after multiple attempts');
  }

  /**
   * Log audit trail for compliance and debugging
   */
  private static async logAudit(params: {
    fastpayTransactionId?: string;
    action: string;
    details?: any;
    employeeId?: string;
    terminalId?: string;
    httpMethod?: string;
    endpoint?: string;
    responseStatus?: number;
    responseTimeMs?: number;
  }): Promise<void> {
    try {
      await DatabaseManager.query(`
        INSERT INTO uzum_fastpay_audit_log 
        (fastpay_transaction_id, action, details, employee_id, terminal_id, 
         http_method, endpoint, response_status, response_time_ms, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        params.fastpayTransactionId || null,
        params.action,
        params.details ? JSON.stringify(params.details) : null,
        params.employeeId || null,
        params.terminalId || null,
        params.httpMethod || null,
        params.endpoint || null,
        params.responseStatus || null,
        params.responseTimeMs || null
      ]);
    } catch (error) {
      console.error('Failed to log FastPay audit trail:', error);
      // Don't throw - audit logging shouldn't break main functionality
    }
  }

  /**
   * Make HTTP request to Uzum Bank API with proper error handling and timeout
   */
  private static async makeApiRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT',
    payload: any,
    authHeader: string,
    timeoutMs: number
  ): Promise<{ response: any; responseTimeMs: number; httpStatus: number }> {
    const startTime = Date.now();
    
    try {
      const axiosConfig = {
        method,
        url: endpoint,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'User-Agent': 'RockPoint-POS/1.0'
        },
        data: method !== 'GET' ? payload : undefined,
        timeout: timeoutMs
      };

      const response: AxiosResponse = await axios(axiosConfig);
      const responseTimeMs = Date.now() - startTime;
      
      return {
        response: response.data,
        responseTimeMs,
        httpStatus: response.status
      };
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;
      
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      
      if (error.response) {
        // Server responded with error status
        return {
          response: error.response.data,
          responseTimeMs,
          httpStatus: error.response.status
        };
      }
      
      throw new Error(`Network error: ${error.message}`);
    }
  }

  /**
   * Create a new FastPay payment
   * This is the main method called by the API controller
   */
  static async createPayment(request: FastPayCreatePaymentRequest): Promise<FastPayCreatePaymentResponse> {
    const startTime = Date.now();
    let fastpayTransactionId: string | undefined = undefined;

    try {
      // Load configuration
      const config = await this.loadConfig();
      
      // Validate QR code data
      const otpValidation = this.validateOtpData(request.otp_data);
      if (!otpValidation.isValid) {
        await this.logAudit({
          action: 'payment_failed',
          details: { error: otpValidation.error, otp_data_length: request.otp_data?.length },
          employeeId: request.employee_id,
          terminalId: request.terminal_id
        });

        return {
          success: false,
          error: 'Invalid QR code',
          message: otpValidation.error
        };
      }

      // Generate unique identifiers
      const transactionId = uuidv4();
      const orderId = await this.generateUniqueOrderId();
      const cashboxCode = this.generateCashboxCode(request.terminal_id, config.cashbox_code_prefix);
      
      // Convert amount to tiyin
      const amountTiyin = this.uzsToTiyin(request.amount_uzs);
      
      // Generate authorization header
      const authHeader = this.generateAuthHeader(config.secret_key, config.merchant_service_user_id);
      
      // Prepare API request payload
      const apiPayload: FastPayRequest = {
        amount: amountTiyin,
        cashbox_code: cashboxCode,
        otp_data: request.otp_data,
        order_id: orderId,
        transaction_id: transactionId,
        service_id: config.service_id
      };

      // Create database record with pending status
      const dbResult = await DatabaseManager.query(`
        INSERT INTO uzum_fastpay_transactions 
        (id, transaction_id, order_id, pos_transaction_id, amount, amount_uzs, 
         cashbox_code, otp_data, service_id, request_payload, authorization_header,
         status, employee_id, terminal_id, initiated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, NOW())
        RETURNING id
      `, [
        uuidv4(), // database id
        transactionId, // Uzum Bank transaction_id
        orderId,
        request.pos_transaction_id || null,
        amountTiyin,
        request.amount_uzs,
        cashboxCode,
        request.otp_data,
        config.service_id,
        JSON.stringify(apiPayload),
        authHeader,
        request.employee_id,
        request.terminal_id
      ]);

      fastpayTransactionId = dbResult.rows[0].id;

      // Log payment initiation
      await this.logAudit({
        fastpayTransactionId,
        action: 'payment_initiated',
        details: { order_id: orderId, amount_uzs: request.amount_uzs, amount_tiyin: amountTiyin },
        employeeId: request.employee_id,
        terminalId: request.terminal_id
      });

      // Make API request to Uzum Bank
      const endpoint = `${config.api_base_url}/api/apelsin-pay/merchant/v2/payment`;
      
      let apiResult;
      let retryCount = 0;
      let lastError: Error | null = null;

      // Retry logic for network failures
      while (retryCount <= config.max_retry_attempts) {
        try {
          await DatabaseManager.query(
            'UPDATE uzum_fastpay_transactions SET status = $1, retry_count = $2 WHERE id = $3',
            ['processing', retryCount, fastpayTransactionId]
          );

          apiResult = await this.makeApiRequest(
            endpoint,
            'POST',
            apiPayload,
            authHeader,
            config.request_timeout_ms
          );

          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          retryCount++;
          
          if (retryCount <= config.max_retry_attempts) {
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!apiResult) {
        // All retries failed
        await DatabaseManager.query(
          `UPDATE uzum_fastpay_transactions 
           SET status = 'failed', error_code = 500, error_message = $1, 
               timeout_occurred = $2, retry_count = $3, completed_at = NOW()
           WHERE id = $4`,
          [lastError?.message || 'Network timeout', 
           lastError?.message?.includes('timeout') || false,
           retryCount, 
           fastpayTransactionId]
        );

        await this.logAudit({
          fastpayTransactionId,
          action: 'payment_failed',
          details: { error: lastError?.message, retry_count: retryCount },
          employeeId: request.employee_id,
          terminalId: request.terminal_id
        });

        return {
          success: false,
          error: 'Network error',
          message: `Payment request failed after ${retryCount} attempts: ${lastError?.message}`
        };
      }

      const { response, responseTimeMs, httpStatus } = apiResult;
      const processingTime = Date.now() - startTime;

      // Update database with response
      await DatabaseManager.query(
        `UPDATE uzum_fastpay_transactions 
         SET response_payload = $1, error_code = $2, error_message = $3,
             payment_id = $4, client_phone_number = $5, operation_time = $6,
             status = $7, completed_at = NOW(), retry_count = $8
         WHERE id = $9`,
        [
          JSON.stringify(response),
          response.error_code || 0,
          response.error_message || null,
          response.payment_id || null,
          response.client_phone_number || null,
          response.operation_time || null,
          response.error_code === 0 ? 'success' : 'failed',
          retryCount,
          fastpayTransactionId
        ]
      );

      // Log completion
      await this.logAudit({
        fastpayTransactionId,
        action: response.error_code === 0 ? 'payment_completed' : 'payment_failed',
        details: { 
          error_code: response.error_code, 
          error_message: response.error_message,
          payment_id: response.payment_id,
          processing_time_ms: processingTime
        },
        employeeId: request.employee_id,
        terminalId: request.terminal_id,
        httpMethod: 'POST',
        endpoint,
        responseStatus: httpStatus,
        responseTimeMs
      });

      if (response.error_code === 0) {
        // Success - fastpayTransactionId is guaranteed to be defined at this point
        return {
          success: true,
          data: {
            fastpay_transaction_id: fastpayTransactionId!,
            order_id: orderId,
            payment_id: response.payment_id,
            status: 'success',
            error_code: 0,
            processing_time_ms: processingTime
          }
        };
      } else {
        // Uzum Bank returned an error - fastpayTransactionId is guaranteed to be defined at this point
        return {
          success: false,
          error: 'Payment failed',
          message: response.error_message || `Error code: ${response.error_code}`,
          data: {
            fastpay_transaction_id: fastpayTransactionId!,
            order_id: orderId,
            status: 'failed',
            error_code: response.error_code,
            error_message: response.error_message,
            processing_time_ms: processingTime
          }
        };
      }

    } catch (error: any) {
      console.error('❌ FastPay payment creation failed:', error);
      
      // Update database if we have a transaction ID
      if (fastpayTransactionId) {
        await DatabaseManager.query(
          `UPDATE uzum_fastpay_transactions 
           SET status = 'failed', error_code = 500, error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [error.message, fastpayTransactionId]
        );

        await this.logAudit({
          fastpayTransactionId,
          action: 'error_occurred',
          details: { error: error.message, stack: error.stack },
          employeeId: request.employee_id,
          terminalId: request.terminal_id
        });
      }

      return {
        success: false,
        error: 'Internal error',
        message: 'An internal error occurred while processing the payment'
      };
    }
  }

  /**
   * Submit fiscal receipt URL to Uzum Bank
   */
  static async submitFiscalization(fastpayTransactionId: string, fiscalUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.loadConfig();
      
      // Get transaction details
      const transactionResult = await DatabaseManager.query(
        'SELECT payment_id, service_id, employee_id, terminal_id FROM uzum_fastpay_transactions WHERE id = $1 AND status = $2',
        [fastpayTransactionId, 'success']
      );

      if (transactionResult.rows.length === 0) {
        return { success: false, error: 'Transaction not found or not successful' };
      }

      const transaction = transactionResult.rows[0];
      
      // Prepare fiscalization request
      const fiscalizationRequest: FastPayFiscalizationRequest = {
        payment_id: transaction.payment_id,
        service_id: transaction.service_id,
        fiscal_url: fiscalUrl
      };

      // Generate auth header
      const authHeader = this.generateAuthHeader(config.secret_key, config.merchant_service_user_id);
      
      // Create fiscalization record
      const fiscalizationId = uuidv4();
      await DatabaseManager.query(`
        INSERT INTO uzum_fastpay_fiscalization 
        (id, fastpay_transaction_id, payment_id, service_id, fiscal_url, 
         request_payload, status, submitted_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      `, [
        fiscalizationId,
        fastpayTransactionId,
        transaction.payment_id,
        transaction.service_id,
        fiscalUrl,
        JSON.stringify(fiscalizationRequest)
      ]);

      // Make API request
      const endpoint = `${config.api_base_url}/api/apelsin-pay/merchant/payment/fiscal`;
      const result = await this.makeApiRequest(
        endpoint,
        'POST',
        fiscalizationRequest,
        authHeader,
        config.request_timeout_ms
      );

      // Update fiscalization record
      await DatabaseManager.query(
        `UPDATE uzum_fastpay_fiscalization 
         SET response_payload = $1, error_code = $2, error_message = $3,
             status = $4, completed_at = NOW()
         WHERE id = $5`,
        [
          JSON.stringify(result.response),
          result.response.error_code || 0,
          result.response.error_message || null,
          result.response.error_code === 0 ? 'success' : 'failed',
          fiscalizationId
        ]
      );

      await this.logAudit({
        fastpayTransactionId,
        action: 'fiscalization_sent',
        details: { 
          error_code: result.response.error_code,
          fiscal_url: fiscalUrl
        },
        employeeId: transaction.employee_id,
        terminalId: transaction.terminal_id,
        httpMethod: 'POST',
        endpoint,
        responseStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs
      });

      return {
        success: result.response.error_code === 0,
        error: result.response.error_code !== 0 ? result.response.error_message : undefined
      };

    } catch (error: any) {
      console.error('❌ FastPay fiscalization failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel/reverse a FastPay payment
   */
  static async reversePayment(
    orderId: string, 
    reason: string, 
    requestedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.loadConfig();
      
      // Get transaction details
      const transactionResult = await DatabaseManager.query(
        'SELECT id, payment_id, service_id, employee_id, terminal_id FROM uzum_fastpay_transactions WHERE order_id = $1 AND status = $2',
        [orderId, 'success']
      );

      if (transactionResult.rows.length === 0) {
        return { success: false, error: 'Transaction not found or not eligible for reversal' };
      }

      const transaction = transactionResult.rows[0];
      
      // Prepare reversal request
      const reversalRequest: FastPayReversalRequest = {
        service_id: transaction.service_id,
        payment_id: transaction.payment_id
      };

      // Generate auth header
      const authHeader = this.generateAuthHeader(config.secret_key, config.merchant_service_user_id);
      
      // Create reversal record
      const reversalId = uuidv4();
      await DatabaseManager.query(`
        INSERT INTO uzum_fastpay_reversals 
        (id, fastpay_transaction_id, original_order_id, payment_id, service_id, 
         request_payload, reversal_reason, requested_by, status, requested_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
      `, [
        reversalId,
        transaction.id,
        orderId,
        transaction.payment_id,
        transaction.service_id,
        JSON.stringify(reversalRequest),
        reason,
        requestedBy
      ]);

      // Make API request
      const endpoint = `${config.api_base_url}/api/apelsin-pay/merchant/v2/payment/reversal/${orderId}`;
      const result = await this.makeApiRequest(
        endpoint,
        'PUT',
        reversalRequest,
        authHeader,
        config.request_timeout_ms
      );

      // Update reversal record
      await DatabaseManager.query(
        `UPDATE uzum_fastpay_reversals 
         SET response_payload = $1, error_code = $2, error_message = $3,
             status = $4, completed_at = NOW()
         WHERE id = $5`,
        [
          JSON.stringify(result.response),
          result.response.error_code || 0,
          result.response.error_message || null,
          result.response.error_code === 0 ? 'success' : 'failed',
          reversalId
        ]
      );

      // Update original transaction status if reversal was successful
      if (result.response.error_code === 0) {
        await DatabaseManager.query(
          'UPDATE uzum_fastpay_transactions SET status = $1 WHERE id = $2',
          ['reversed', transaction.id]
        );
      }

      await this.logAudit({
        fastpayTransactionId: transaction.id,
        action: 'reversal_requested',
        details: { 
          error_code: result.response.error_code,
          reason,
          requested_by: requestedBy
        },
        employeeId: transaction.employee_id,
        terminalId: transaction.terminal_id,
        httpMethod: 'PUT',
        endpoint,
        responseStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs
      });

      return {
        success: result.response.error_code === 0,
        error: result.response.error_code !== 0 ? result.response.error_message : undefined
      };

    } catch (error: any) {
      console.error('❌ FastPay reversal failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check payment status
   */
  static async checkPaymentStatus(fastpayTransactionId: string): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const config = await this.loadConfig();
      
      // Get transaction details
      const transactionResult = await DatabaseManager.query(
        'SELECT payment_id, service_id, employee_id, terminal_id FROM uzum_fastpay_transactions WHERE id = $1',
        [fastpayTransactionId]
      );

      if (transactionResult.rows.length === 0) {
        return { success: false, error: 'Transaction not found' };
      }

      const transaction = transactionResult.rows[0];
      
      if (!transaction.payment_id) {
        return { success: false, error: 'No payment ID available for status check' };
      }

      // Prepare status request
      const statusRequest: FastPayStatusRequest = {
        payment_id: transaction.payment_id,
        service_id: transaction.service_id
      };

      // Generate auth header
      const authHeader = this.generateAuthHeader(config.secret_key, config.merchant_service_user_id);
      
      // Make API request
      const endpoint = `${config.api_base_url}/api/apelsin-pay/merchant/payment/status`;
      const result = await this.makeApiRequest(
        endpoint,
        'POST',
        statusRequest,
        authHeader,
        config.request_timeout_ms
      );

      await this.logAudit({
        fastpayTransactionId,
        action: 'status_checked',
        details: { 
          error_code: result.response.error_code,
          payment_status: result.response.payment_status
        },
        employeeId: transaction.employee_id,
        terminalId: transaction.terminal_id,
        httpMethod: 'POST',
        endpoint,
        responseStatus: result.httpStatus,
        responseTimeMs: result.responseTimeMs
      });

      return {
        success: result.response.error_code === 0,
        status: result.response.payment_status,
        error: result.response.error_code !== 0 ? result.response.error_message : undefined
      };

    } catch (error: any) {
      console.error('❌ FastPay status check failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get FastPay transaction by ID
   */
  static async getTransaction(fastpayTransactionId: string): Promise<any> {
    try {
      const result = await DatabaseManager.query(
        'SELECT * FROM uzum_fastpay_transaction_summary WHERE id = $1',
        [fastpayTransactionId]
      );

      return result.rows[0] || null;
    } catch (error: any) {
      console.error('❌ Failed to get FastPay transaction:', error);
      throw error;
    }
  }

  /**
   * Get FastPay transactions with filtering and pagination
   */
  static async getTransactions(filters: {
    status?: string;
    employeeId?: string;
    terminalId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ transactions: any[]; total: number }> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (filters.status) {
        whereConditions.push(`status = $${paramIndex++}`);
        queryParams.push(filters.status);
      }

      if (filters.employeeId) {
        whereConditions.push(`employee_id = $${paramIndex++}`);
        queryParams.push(filters.employeeId);
      }

      if (filters.terminalId) {
        whereConditions.push(`terminal_id = $${paramIndex++}`);
        queryParams.push(filters.terminalId);
      }

      if (filters.startDate) {
        whereConditions.push(`initiated_at >= $${paramIndex++}`);
        queryParams.push(filters.startDate);
      }

      if (filters.endDate) {
        whereConditions.push(`initiated_at <= $${paramIndex++}`);
        queryParams.push(filters.endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const [transactionsResult, countResult] = await Promise.all([
        DatabaseManager.query(`
          SELECT * FROM uzum_fastpay_transaction_summary 
          ${whereClause}
          ORDER BY initiated_at DESC
          LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `, [...queryParams, limit, offset]),
        
        DatabaseManager.query(`
          SELECT COUNT(*) as total FROM uzum_fastpay_transactions 
          ${whereClause}
        `, queryParams)
      ]);

      return {
        transactions: transactionsResult.rows,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error: any) {
      console.error('❌ Failed to get FastPay transactions:', error);
      throw error;
    }
  }
}
