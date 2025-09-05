import crypto from 'crypto';
import { DatabaseManager } from '../database/manager';

// =================================================================
// INTERFACES AND TYPES
// =================================================================

export interface CreateClickPassPaymentRequest {
  amount_uzs: number;
  otp_data: string;
  employee_id: string;
  terminal_id: string;
  pos_transaction_id?: string;
  cashbox_code?: string;
}

export interface ClickPassPaymentResult {
  success: boolean;
  data?: {
    click_transaction_id: string;
    order_id: string;
    click_trans_id?: number;
    status: string;
    payment_status?: number;
    card_type?: string;
    masked_card_number?: string;
    requires_confirmation?: boolean;
    confirmation_code?: string;
  };
  error?: string;
  message?: string;
}

export interface ClickPassCredentials {
  service_id: string;
  merchant_id: string;
  merchant_user_id: string;
  secret_key: string;
  api_base_url?: string;
  request_timeout_ms?: string;
}

export interface TransactionFilters {
  status?: string;
  employeeId?: string;
  terminalId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

// =================================================================
// CLICK PASS SERVICE CLASS
// =================================================================

export class ClickPassService {
  private static async getCredentials(): Promise<ClickPassCredentials> {
    const result = await DatabaseManager.query(`
      SELECT credential_key, credential_value 
      FROM payment_method_credentials 
      WHERE payment_method_code = 'click'
    `);

    if (result.rows.length === 0) {
      throw new Error('Click Pass credentials not configured');
    }

    const credentials: any = {};
    result.rows.forEach((row: any) => {
      credentials[row.credential_key] = row.credential_value;
    });

    // Validate required credentials
    const required = ['service_id', 'merchant_id', 'merchant_user_id', 'secret_key'];
    for (const field of required) {
      if (!credentials[field]) {
        throw new Error(`Missing required Click Pass credential: ${field}`);
      }
    }

    return {
      service_id: credentials.service_id,
      merchant_id: credentials.merchant_id,
      merchant_user_id: credentials.merchant_user_id,
      secret_key: credentials.secret_key,
      api_base_url: credentials.api_base_url || 'https://api.click.uz',
      request_timeout_ms: credentials.request_timeout_ms || '15000'
    };
  }

  private static generateDigest(timestamp: number, secretKey: string): string {
    const message = timestamp.toString();
    return crypto.createHash('sha1').update(message + secretKey).digest('hex');
  }

  private static generateAuthHeader(merchantUserId: string, secretKey: string): {
    header: string;
    timestamp: number;
    digest: string;
  } {
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = this.generateDigest(timestamp, secretKey);
    const header = `${merchantUserId}:${digest}:${timestamp}`;
    
    return { header, timestamp, digest };
  }

  /**
   * Create a new Click Pass payment
   */
  static async createPayment(request: CreateClickPassPaymentRequest): Promise<ClickPassPaymentResult> {
    console.log('🔄 Creating Click Pass payment:', {
      amount_uzs: request.amount_uzs,
      employee_id: request.employee_id,
      terminal_id: request.terminal_id,
      pos_transaction_id: request.pos_transaction_id
    });

    try {
      // Get credentials
      const credentials = await this.getCredentials();
      
      console.log('🔍 Raw credentials:', {
        service_id: credentials.service_id,
        merchant_id: credentials.merchant_id,
        merchant_user_id: credentials.merchant_user_id,
        service_id_type: typeof credentials.service_id,
        merchant_id_type: typeof credentials.merchant_id
      });
      
      // Parse credentials to numbers with validation
      const serviceId = parseInt(credentials.service_id);
      const merchantId = parseInt(credentials.merchant_id);
      const merchantUserId = parseInt(credentials.merchant_user_id);
      
      if (isNaN(serviceId)) {
        throw new Error(`Invalid service_id: ${credentials.service_id} is not a valid number`);
      }
      if (isNaN(merchantId)) {
        throw new Error(`Invalid merchant_id: ${credentials.merchant_id} is not a valid number`);
      }
      if (isNaN(merchantUserId)) {
        throw new Error(`Invalid merchant_user_id: ${credentials.merchant_user_id} is not a valid number`);
      }
      
      // Generate order ID
      const orderId = `CLICK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Convert amount to tiyin (1 UZS = 100 tiyin)
      const amountTiyin = Math.round(request.amount_uzs * 100);
      
      // Generate authentication
      const auth = this.generateAuthHeader(credentials.merchant_user_id, credentials.secret_key);
      
      // Prepare Click API request
      const clickRequest = {
        service_id: serviceId,
        merchant_id: merchantId,
        amount: amountTiyin,
        order_id: orderId,
        otp: request.otp_data,
        timestamp: auth.timestamp
      };

      console.log('📤 Sending request to Click API:', {
        service_id: clickRequest.service_id,
        merchant_id: clickRequest.merchant_id,
        amount: clickRequest.amount,
        order_id: clickRequest.order_id,
        timestamp: clickRequest.timestamp
      });

      // Store transaction in database first
      const transactionResult = await DatabaseManager.query(`
        INSERT INTO click_pass_transactions (
          transaction_id, order_id, pos_transaction_id,
          service_id, merchant_id, merchant_user_id,
          amount, amount_tiyin, otp_data, cashbox_code,
          request_payload, auth_header, request_timestamp, digest_hash,
          status, employee_id, terminal_id,
          initiated_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), NOW()
        ) RETURNING id
      `, [
        crypto.randomUUID(),
        orderId,
        null, // Don't link to POS transaction yet - this will be done after payment confirmation
        parseInt(credentials.service_id),
        parseInt(credentials.merchant_id),
        parseInt(credentials.merchant_user_id),
        request.amount_uzs,
        amountTiyin,
        request.otp_data,
        request.cashbox_code || null,
        JSON.stringify(clickRequest),
        auth.header,
        auth.timestamp,
        auth.digest,
        'pending',
        request.employee_id,
        request.terminal_id
      ]);

      const clickTransactionId = transactionResult.rows[0].id;

      // Make API call to Click (simulate for now - replace with actual API call)
      const apiResponse = await this.makeClickAPICall(
        `${credentials.api_base_url}/v2/payment`,
        'POST',
        clickRequest,
        auth.header,
        parseInt(credentials.request_timeout_ms || '15000')
      );

      // Update transaction with response
      await DatabaseManager.query(`
        UPDATE click_pass_transactions 
        SET 
          response_payload = $1,
          status = $2,
          click_trans_id = $3,
          payment_status = $4,
          error_code = $5,
          error_message = $6,
          card_type = $7,
          card_token = $8,
          masked_card_number = $9,
          requires_confirmation = $10,
          confirmation_code = $11,
          completed_at = CASE WHEN $2 IN ('success', 'failed') THEN NOW() ELSE NULL END,
          updated_at = NOW()
        WHERE id = $12
      `, [
        JSON.stringify(apiResponse),
        apiResponse.success ? 'success' : 'failed',
        apiResponse.click_trans_id || null,
        apiResponse.payment_status || null,
        apiResponse.error_code || 0,
        apiResponse.error_message || null,
        apiResponse.card_type || null,
        apiResponse.card_token || null,
        apiResponse.masked_card_number || null,
        apiResponse.requires_confirmation || false,
        apiResponse.confirmation_code || null,
        clickTransactionId
      ]);

      if (apiResponse.success) {
        console.log('✅ Click Pass payment successful:', {
          order_id: orderId,
          click_trans_id: apiResponse.click_trans_id
        });

        return {
          success: true,
          data: {
            click_transaction_id: clickTransactionId,
            order_id: orderId,
            click_trans_id: apiResponse.click_trans_id,
            status: 'success',
            payment_status: apiResponse.payment_status,
            card_type: apiResponse.card_type,
            masked_card_number: apiResponse.masked_card_number,
            requires_confirmation: apiResponse.requires_confirmation,
            confirmation_code: apiResponse.confirmation_code
          }
        };
      } else {
        console.log('❌ Click Pass payment failed:', {
          order_id: orderId,
          error: apiResponse.error_message
        });

        return {
          success: false,
          error: apiResponse.error_message || 'Payment failed',
          message: 'Click Pass payment could not be processed',
          data: {
            click_transaction_id: clickTransactionId,
            order_id: orderId,
            status: 'failed'
          }
        };
      }

    } catch (error: any) {
      console.error('❌ Click Pass payment creation failed:', error);
      return {
        success: false,
        error: error.message || 'Internal error',
        message: 'Failed to process Click Pass payment'
      };
    }
  }

  /**
   * Make API call to Click (mock implementation)
   */
  private static async makeClickAPICall(
    url: string,
    method: string,
    data: any,
    authHeader: string,
    timeout: number
  ): Promise<any> {
    // TODO: Replace with actual Click API integration
    // This is a mock implementation for development
    
    console.log('🌐 Mock Click API call:', { url, method, authHeader });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Mock successful response (80% success rate)
    if (Math.random() > 0.2) {
      return {
        success: true,
        click_trans_id: Math.floor(Math.random() * 1000000000),
        payment_status: 1, // Success status
        card_type: 'UZCARD',
        masked_card_number: '**** **** **** 1234',
        requires_confirmation: false
      };
    } else {
      return {
        success: false,
        error_code: 5,
        error_message: 'Insufficient funds or invalid card',
        payment_status: -1
      };
    }
  }

  /**
   * Confirm or reject a payment that requires confirmation
   */
  static async confirmPayment(
    clickTransactionId: string, 
    action: 'confirm' | 'reject', 
    employeeId: string
  ): Promise<ClickPassPaymentResult> {
    // TODO: Implement confirmation logic
    console.log('🔄 Click Pass payment confirmation:', {
      click_transaction_id: clickTransactionId,
      action,
      employee_id: employeeId
    });

    // Mock implementation
    return {
      success: true,
      data: {
        click_transaction_id: clickTransactionId,
        order_id: 'mock_order',
        status: action === 'confirm' ? 'confirmed' : 'rejected'
      }
    };
  }

  /**
   * Reverse/cancel a Click Pass payment
   */
  static async reversePayment(
    orderId: string,
    reason: string,
    requestedBy: string,
    reversalAmount?: number
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement reversal logic
    console.log('🔄 Click Pass payment reversal:', {
      order_id: orderId,
      reason,
      requested_by: requestedBy,
      reversal_amount: reversalAmount
    });

    // Mock implementation
    return { success: true };
  }

  /**
   * Check payment status from Click
   */
  static async checkPaymentStatus(clickTransactionId: string): Promise<{
    success: boolean;
    status?: string;
    payment_status?: number;
    error?: string;
  }> {
    // TODO: Implement status checking
    console.log('🔍 Checking Click Pass payment status:', { click_transaction_id: clickTransactionId });

    // Mock implementation
    return {
      success: true,
      status: 'success',
      payment_status: 1
    };
  }

  /**
   * Get transaction details from database
   */
  static async getTransaction(clickTransactionId: string): Promise<any> {
    const result = await DatabaseManager.query(`
      SELECT 
        id, transaction_id, order_id, pos_transaction_id,
        service_id, merchant_id, merchant_user_id,
        amount, amount_tiyin, status, click_trans_id,
        payment_status, card_type, masked_card_number,
        error_code, error_message,
        employee_id, terminal_id,
        initiated_at, completed_at,
        created_at, updated_at
      FROM click_pass_transactions
      WHERE id = $1
    `, [clickTransactionId]);

    return result.rows[0] || null;
  }

  /**
   * Get transactions with filtering and pagination
   */
  static async getTransactions(filters: TransactionFilters): Promise<{
    transactions: any[];
    total: number;
  }> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.employeeId) {
      whereClause += ` AND employee_id = $${paramIndex}`;
      params.push(filters.employeeId);
      paramIndex++;
    }

    if (filters.terminalId) {
      whereClause += ` AND terminal_id = $${paramIndex}`;
      params.push(filters.terminalId);
      paramIndex++;
    }

    if (filters.startDate) {
      whereClause += ` AND initiated_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      whereClause += ` AND initiated_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    // Count total
    const countResult = await DatabaseManager.query(
      `SELECT COUNT(*) as total FROM click_pass_transactions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get transactions with pagination
    const offset = (filters.page - 1) * filters.limit;
    const transactionsResult = await DatabaseManager.query(`
      SELECT 
        id, transaction_id, order_id, pos_transaction_id,
        amount, status, click_trans_id, payment_status,
        card_type, masked_card_number,
        employee_id, terminal_id,
        initiated_at, completed_at
      FROM click_pass_transactions
      ${whereClause}
      ORDER BY initiated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, filters.limit, offset]);

    return {
      transactions: transactionsResult.rows,
      total
    };
  }
}
