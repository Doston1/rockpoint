import crypto from 'crypto';
import { DatabaseManager } from '../database/manager';

// =================================================================
// INTERFACES AND TYPES
// =================================================================

export interface CreatePaymeQRReceiptRequest {
  amount_uzs: number;
  employee_id: string;
  terminal_id: string;
  pos_transaction_id?: string;
  description?: string;
  account_data?: Record<string, any>;
}

export interface PaymeQRReceiptResult {
  success: boolean;
  data?: {
    payme_receipt_id: string;
    order_id: string;
    receipt_id?: string;
    status: string;
    payme_state?: number;
    qr_code_data?: string;
    payment_url?: string;
  };
  error?: string;
  message?: string;
}

export interface PaymeCredentials {
  cashbox_id: string;
  key_password: string;
  api_base_url?: string;
  request_timeout_ms?: string;
}

export interface ReceiptFilters {
  status?: string;
  employeeId?: string;
  terminalId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

// =================================================================
// PAYME QR SERVICE CLASS
// =================================================================

export class PaymeQRService {
  private static async getCredentials(): Promise<PaymeCredentials> {
    const result = await DatabaseManager.query(`
      SELECT credential_key, credential_value 
      FROM payment_method_credentials 
      WHERE payment_method_code = 'payme'
    `);

    if (result.rows.length === 0) {
      throw new Error('Payme credentials not configured');
    }

    const credentials: any = {};
    result.rows.forEach((row: any) => {
      credentials[row.credential_key] = row.credential_value;
    });

    // Validate required credentials
    const required = ['cashbox_id', 'key_password'];
    for (const field of required) {
      if (!credentials[field]) {
        throw new Error(`Missing required Payme credential: ${field}`);
      }
    }

    return {
      cashbox_id: credentials.cashbox_id,
      key_password: credentials.key_password,
      api_base_url: credentials.api_base_url || 'https://checkout.paycom.uz',
      request_timeout_ms: credentials.request_timeout_ms || '15000'
    };
  }

  private static generateAuthHeader(cashboxId: string, keyPassword: string): string {
    return `${cashboxId}:${keyPassword}`;
  }

  /**
   * Create a new Payme QR receipt
   */
  static async createReceipt(request: CreatePaymeQRReceiptRequest): Promise<PaymeQRReceiptResult> {
    console.log('🔄 Creating Payme QR receipt:', {
      amount_uzs: request.amount_uzs,
      employee_id: request.employee_id,
      terminal_id: request.terminal_id,
      pos_transaction_id: request.pos_transaction_id
    });

    try {
      // Get credentials
      const credentials = await this.getCredentials();
      
      // Generate order ID
      const orderId = `PAYME_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Convert amount to tiyin (1 UZS = 100 tiyin)
      const amountTiyin = Math.round(request.amount_uzs * 100);
      
      // Generate authentication header
      const authHeader = this.generateAuthHeader(credentials.cashbox_id, credentials.key_password);
      
      // Prepare account data for Payme
      const accountData = {
        order_id: orderId,
        terminal_id: request.terminal_id,
        employee_id: request.employee_id,
        ...request.account_data
      };
      
      // Prepare Payme API request
      const paymeRequest = {
        id: crypto.randomUUID(),
        method: 'receipts.create',
        params: {
          amount: amountTiyin,
          account: accountData,
          description: request.description || `POS Payment - Order ${orderId}`
        }
      };

      console.log('📤 Sending request to Payme API:', {
        method: paymeRequest.method,
        amount: paymeRequest.params.amount,
        account: paymeRequest.params.account,
        description: paymeRequest.params.description
      });

      // Store receipt in database first
      const receiptResult = await DatabaseManager.query(`
        INSERT INTO payme_qr_receipts (
          transaction_id, order_id, pos_transaction_id,
          cashbox_id, amount, amount_uzs,
          account_data, description,
          request_payload, x_auth_header,
          payme_state, status,
          employee_id, terminal_id,
          initiated_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, NOW(), NOW(), NOW()
        ) RETURNING id
      `, [
        crypto.randomUUID(),
        orderId,
        request.pos_transaction_id || null,
        credentials.cashbox_id,
        amountTiyin,
        request.amount_uzs,
        JSON.stringify(accountData),
        request.description || null,
        JSON.stringify(paymeRequest),
        authHeader,
        0, // Created state
        'created',
        request.employee_id,
        request.terminal_id
      ]);

      const paymeReceiptId = receiptResult.rows[0].id;

      // Make API call to Payme (simulate for now - replace with actual API call)
      const apiResponse = await this.makePaymeAPICall(
        `${credentials.api_base_url}/api`,
        'POST',
        paymeRequest,
        authHeader,
        parseInt(credentials.request_timeout_ms || '15000')
      );

      // Update receipt with response
      await DatabaseManager.query(`
        UPDATE payme_qr_receipts 
        SET 
          response_payload = $1,
          receipt_id = $2,
          status = $3,
          payme_state = $4,
          qr_code_data = $5,
          payment_url = $6,
          error_code = $7,
          error_message = $8,
          created_at_payme = $9,
          expires_at = $10,
          updated_at = NOW()
        WHERE id = $11
      `, [
        JSON.stringify(apiResponse),
        apiResponse.receipt_id || null,
        apiResponse.success ? 'waiting_for_payment' : 'error',
        apiResponse.success ? 1 : -2, // 1 = waiting for payment, -2 = error
        apiResponse.qr_code_data || null,
        apiResponse.payment_url || null,
        apiResponse.error_code || 0,
        apiResponse.error_message || null,
        apiResponse.created_at || null,
        apiResponse.expires_at || null,
        paymeReceiptId
      ]);

      if (apiResponse.success) {
        console.log('✅ Payme QR receipt created successfully:', {
          order_id: orderId,
          receipt_id: apiResponse.receipt_id
        });

        return {
          success: true,
          data: {
            payme_receipt_id: paymeReceiptId,
            order_id: orderId,
            receipt_id: apiResponse.receipt_id,
            status: 'waiting_for_payment',
            payme_state: 1,
            qr_code_data: apiResponse.qr_code_data,
            payment_url: apiResponse.payment_url
          }
        };
      } else {
        console.log('❌ Payme QR receipt creation failed:', {
          order_id: orderId,
          error: apiResponse.error_message
        });

        return {
          success: false,
          error: apiResponse.error_message || 'Receipt creation failed',
          message: 'Payme QR receipt could not be created',
          data: {
            payme_receipt_id: paymeReceiptId,
            order_id: orderId,
            status: 'error'
          }
        };
      }

    } catch (error: any) {
      console.error('❌ Payme QR receipt creation failed:', error);
      return {
        success: false,
        error: error.message || 'Internal error',
        message: 'Failed to create Payme QR receipt'
      };
    }
  }

  /**
   * Make API call to Payme (mock implementation)
   */
  private static async makePaymeAPICall(
    url: string,
    method: string,
    data: any,
    authHeader: string,
    timeout: number
  ): Promise<any> {
    // TODO: Replace with actual Payme API integration
    // This is a mock implementation for development
    
    console.log('🌐 Mock Payme API call:', { url, method, authHeader });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

    // Mock successful response (85% success rate)
    if (Math.random() > 0.15) {
      const receiptId = Math.floor(Math.random() * 1000000000).toString();
      const qrCodeData = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
      
      return {
        success: true,
        receipt_id: receiptId,
        qr_code_data: qrCodeData,
        payment_url: `https://checkout.paycom.uz/receipt/${receiptId}`,
        created_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor((Date.now() + 30 * 60 * 1000) / 1000) // 30 minutes
      };
    } else {
      return {
        success: false,
        error_code: -31001,
        error_message: 'Insufficient permissions or invalid account data'
      };
    }
  }

  /**
   * Check receipt status from Payme
   */
  static async checkReceiptStatus(paymeReceiptId: string): Promise<{
    success: boolean;
    status?: string;
    payme_state?: number;
    payment_info?: any;
    error?: string;
  }> {
    console.log('🔍 Checking Payme QR receipt status:', { payme_receipt_id: paymeReceiptId });

    try {
      // Get current receipt from database
      const receiptResult = await DatabaseManager.query(`
        SELECT receipt_id, status, payme_state
        FROM payme_qr_receipts
        WHERE id = $1
      `, [paymeReceiptId]);

      if (receiptResult.rows.length === 0) {
        return {
          success: false,
          error: 'Receipt not found'
        };
      }

      const receipt = receiptResult.rows[0];

      // TODO: Make actual API call to check status
      // For now, return mock data
      return {
        success: true,
        status: receipt.status,
        payme_state: receipt.payme_state,
        payment_info: {
          // Mock payment info
          card_type: 'UZCARD',
          phone_number: '+998901234567'
        }
      };

    } catch (error: any) {
      console.error('❌ Failed to check Payme QR receipt status:', error);
      return {
        success: false,
        error: error.message || 'Status check failed'
      };
    }
  }

  /**
   * Submit fiscal data to Payme
   */
  static async submitFiscalData(
    paymeReceiptId: string, 
    fiscalData: any
  ): Promise<{ success: boolean; error?: string }> {
    console.log('🧾 Submitting fiscal data to Payme:', {
      payme_receipt_id: paymeReceiptId,
      fiscal_url: fiscalData.fiscal_url
    });

    try {
      // Store fiscal data submission in database
      await DatabaseManager.query(`
        INSERT INTO payme_fiscal_receipts (
          payme_receipt_id, receipt_id, fiscal_data,
          request_payload, status, submitted_at,
          created_at, updated_at
        ) VALUES (
          $1, (SELECT receipt_id FROM payme_qr_receipts WHERE id = $1),
          $2, $3, 'pending', NOW(), NOW(), NOW()
        )
      `, [
        paymeReceiptId,
        JSON.stringify(fiscalData),
        JSON.stringify({ method: 'receipts.set_fiscal_data', params: fiscalData })
      ]);

      // TODO: Make actual API call to submit fiscal data
      // For now, mark as successful
      await DatabaseManager.query(`
        UPDATE payme_fiscal_receipts 
        SET status = 'success', completed_at = NOW(), updated_at = NOW()
        WHERE payme_receipt_id = $1
      `, [paymeReceiptId]);

      return { success: true };

    } catch (error: any) {
      console.error('❌ Failed to submit fiscal data:', error);
      return {
        success: false,
        error: error.message || 'Fiscal data submission failed'
      };
    }
  }

  /**
   * Cancel a Payme QR receipt
   */
  static async cancelReceipt(
    paymeReceiptId: string,
    reason: string,
    requestedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log('🔄 Cancelling Payme QR receipt:', {
      payme_receipt_id: paymeReceiptId,
      reason,
      requested_by: requestedBy
    });

    try {
      // Store cancellation request
      await DatabaseManager.query(`
        INSERT INTO payme_receipt_cancellations (
          payme_receipt_id, receipt_id, reason,
          request_payload, status, requested_by,
          requested_at, created_at, updated_at
        ) VALUES (
          $1, (SELECT receipt_id FROM payme_qr_receipts WHERE id = $1),
          $2, $3, 'pending', $4, NOW(), NOW(), NOW()
        )
      `, [
        paymeReceiptId,
        reason,
        JSON.stringify({ method: 'receipts.cancel', params: { reason } }),
        requestedBy
      ]);

      // Update receipt status
      await DatabaseManager.query(`
        UPDATE payme_qr_receipts 
        SET status = 'cancelled', payme_state = -1, updated_at = NOW()
        WHERE id = $1
      `, [paymeReceiptId]);

      return { success: true };

    } catch (error: any) {
      console.error('❌ Failed to cancel Payme QR receipt:', error);
      return {
        success: false,
        error: error.message || 'Receipt cancellation failed'
      };
    }
  }

  /**
   * Get receipt details from database
   */
  static async getReceipt(paymeReceiptId: string): Promise<any> {
    const result = await DatabaseManager.query(`
      SELECT 
        id, transaction_id, order_id, pos_transaction_id,
        cashbox_id, receipt_id, amount, amount_uzs,
        account_data, description, status, payme_state,
        qr_code_data, payment_url, payment_id,
        card_number, card_type, phone_number,
        error_code, error_message,
        employee_id, terminal_id,
        initiated_at, paid_at, expires_at,
        created_at, updated_at
      FROM payme_qr_receipts
      WHERE id = $1
    `, [paymeReceiptId]);

    return result.rows[0] || null;
  }

  /**
   * Get receipts with filtering and pagination
   */
  static async getReceipts(filters: ReceiptFilters): Promise<{
    receipts: any[];
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
      `SELECT COUNT(*) as total FROM payme_qr_receipts ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get receipts with pagination
    const offset = (filters.page - 1) * filters.limit;
    const receiptsResult = await DatabaseManager.query(`
      SELECT 
        id, transaction_id, order_id, pos_transaction_id,
        amount_uzs, status, payme_state, receipt_id,
        payment_id, card_type, phone_number,
        employee_id, terminal_id,
        initiated_at, paid_at, expires_at
      FROM payme_qr_receipts
      ${whereClause}
      ORDER BY initiated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, filters.limit, offset]);

    return {
      receipts: receiptsResult.rows,
      total
    };
  }

  /**
   * Start status polling for a receipt
   */
  static async startStatusPolling(paymeReceiptId: string): Promise<{
    success: boolean;
    interval_ms?: number;
    error?: string;
  }> {
    console.log('🔄 Starting status polling for Payme QR receipt:', { payme_receipt_id: paymeReceiptId });

    // TODO: Implement actual polling mechanism
    // For now, return mock success
    return {
      success: true,
      interval_ms: 5000 // Poll every 5 seconds
    };
  }
}
