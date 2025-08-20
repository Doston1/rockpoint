# Uzum Bank FastPay Integration Documentation

## Overview

This document describes the implementation of Uzum Bank FastPay integration in the RockPoint Branch Management System. FastPay allows customers to pay instantly by presenting a QR code that the POS scans, after which we send a payment request to Uzum Bank and receive an immediate response.

## Table of Contents

- [Architecture](#architecture)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Payment Flow](#payment-flow)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Architecture

### Components

1. **FastPayService** (`src/services/FastPayService.ts`)

   - Core service handling Uzum Bank API interactions
   - Payment processing, authentication, and database persistence
   - Retry logic and error handling

2. **FastPay API Controller** (`src/api/fastpay.ts`)

   - REST API endpoints for POS integration
   - Request validation and response formatting
   - Business logic orchestration

3. **UzumBankConfig** (`src/services/UzumBankConfig.ts`)

   - Configuration management utility
   - Secure credential storage and validation
   - Environment variable integration

4. **Admin Interface** (`src/api/uzum-bank-admin.ts`)
   - Administrative endpoints for configuration
   - Transaction monitoring and analytics
   - System health checks

### Technology Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL with JSONB support
- **Authentication**: SHA1 hashing with timestamp validation
- **HTTP Client**: Native fetch API with timeout handling
- **Validation**: Zod schema validation

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Required - Get from Uzum Bank manager
UZUM_MERCHANT_SERVICE_USER_ID=your-cash-register-id
UZUM_SECRET_KEY=your-secret-key-from-uzum-bank
UZUM_SERVICE_ID=your-service-id

# Optional - Defaults provided
UZUM_API_BASE_URL=https://mobile.apelsin.uz
UZUM_REQUEST_TIMEOUT_MS=15000
UZUM_CASHBOX_CODE_PREFIX=RockPoint
UZUM_MAX_RETRY_ATTEMPTS=3
UZUM_ENABLE_LOGGING=true
```

### Database Setup

1. Run the migration to create FastPay tables:

```bash
npm run db:migrate
```

2. The tables will be created automatically:
   - `uzum_bank_config` - Configuration storage
   - `uzum_fastpay_transactions` - Payment tracking
   - `uzum_fastpay_fiscalization` - Fiscal receipt submissions
   - `uzum_fastpay_reversals` - Payment cancellations
   - `uzum_fastpay_audit_log` - Comprehensive audit trail

### Initial Setup

1. Set up configuration via admin API or environment variables
2. Test configuration using the test endpoint
3. Validate all required credentials are present

## API Endpoints

### Payment Processing

#### Create Payment

```http
POST /api/payments/fastpay
Content-Type: application/json

{
  "amount_uzs": 50000,
  "otp_data": "6385735999467329369938571759997073400776",
  "employee_id": "EMP001",
  "terminal_id": "TERM001",
  "pos_transaction_id": "uuid-optional"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "fastpay_transaction_id": "uuid",
    "order_id": "RP_1627890123456_ABC123",
    "payment_id": "uzum-payment-id",
    "status": "success",
    "error_code": 0,
    "processing_time_ms": 1234
  }
}
```

#### Submit Fiscalization

```http
POST /api/payments/fastpay/:id/fiscalize
Content-Type: application/json

{
  "fiscal_url": "https://your-fiscal-system.com/receipt/123"
}
```

#### Cancel Payment

```http
PUT /api/payments/fastpay/:orderId/reverse
Content-Type: application/json

{
  "reason": "Customer requested refund",
  "requested_by": "EMP001"
}
```

### Administrative Endpoints

#### Get Configuration

```http
GET /api/admin/uzum-bank/config
```

#### Update Configuration

```http
PUT /api/admin/uzum-bank/config
Content-Type: application/json

{
  "merchant_service_user_id": "new-value",
  "secret_key": "new-secret"
}
```

#### Test Configuration

```http
POST /api/admin/uzum-bank/config/test
```

#### Get System Status

```http
GET /api/admin/uzum-bank/status
```

#### Get Analytics

```http
GET /api/admin/uzum-bank/analytics?group_by=day&start_date=2023-01-01
```

## Database Schema

### Key Tables

#### `uzum_fastpay_transactions`

Primary table tracking all payment attempts:

- Transaction identifiers and linking
- Payment amounts in tiyin and UZS
- QR code data and cashbox codes
- Request/response payloads
- Status tracking and error handling
- Timing and retry information

#### `uzum_fastpay_audit_log`

Comprehensive audit trail for compliance:

- Action logging (payment events, API calls)
- Employee and terminal context
- Request details and response metrics
- Error tracking and debugging information

### Views for Reporting

- `uzum_fastpay_transaction_summary` - Enriched transaction data
- `uzum_fastpay_daily_stats` - Daily aggregated statistics

## Payment Flow

### 1. QR Code Scanning

```javascript
// POS scans QR code and validates
if (qrData.length < 40) {
  throw new Error("Invalid QR code");
}
```

### 2. Payment Request

```javascript
const response = await fetch("/api/payments/fastpay", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    amount_uzs: totalAmount,
    otp_data: scannedQrData,
    employee_id: currentEmployee.id,
    terminal_id: terminalId,
  }),
});
```

### 3. Response Handling

```javascript
const result = await response.json();

if (result.success && result.data.status === "success") {
  // Payment successful - proceed with receipt
  await printReceipt(result.data);
  await submitFiscalization(result.data.fastpay_transaction_id, receiptUrl);
} else {
  // Payment failed - show error
  showError(result.message);
}
```

### 4. Fiscalization (Optional)

```javascript
await fetch(`/api/payments/fastpay/${transactionId}/fiscalize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fiscal_url: "https://fiscal-system.com/receipt/123",
  }),
});
```

## Error Handling

### Uzum Bank Error Codes

| Code | Description          | Action                               |
| ---- | -------------------- | ------------------------------------ |
| 0    | Success              | Continue processing                  |
| 400  | Invalid request data | Validate QR code and amount          |
| 401  | Authentication error | Check credentials                    |
| 403  | Request timeout      | Retry request                        |
| 416  | Safe mode enabled    | User must complete setup in Uzum app |

### Common Error Scenarios

1. **Invalid QR Code**

   - Error: `apelsin.pay.wrong.prefix.otp.data`
   - Action: Ask customer to generate new QR code

2. **Expired QR Code**

   - Error: `apelsin.pay.user.otp.data.expired`
   - Action: Ask customer to refresh QR code

3. **Insufficient Funds**

   - Error: `operation.failed`
   - Action: Suggest alternative payment method

4. **Network Timeout**
   - Automatic retry with exponential backoff
   - Maximum 3 retry attempts

## Testing

### Unit Tests

```bash
# Run FastPay service tests
npm test -- FastPayService.test.ts

# Test configuration management
npm test -- UzumBankConfig.test.ts
```

### Integration Tests

1. **Hash Computation Test**

```javascript
const hash = FastPayService.generateAuthHeader("secret", "merchant123");
// Verify format: merchant123:hash:timestamp
```

2. **Mock Payment Test**

```javascript
// Mock Uzum Bank API for testing
const mockResponse = { error_code: 0, payment_id: "test123" };
// Test payment flow with mocked response
```

### Manual Testing Checklist

- [ ] Configuration validation
- [ ] QR code validation (length, format)
- [ ] Amount conversion (UZS to tiyin)
- [ ] Authentication header generation
- [ ] Network timeout handling
- [ ] Retry mechanism
- [ ] Database persistence
- [ ] Error response handling

## Production Deployment

### Pre-deployment Checklist

1. **Configuration**

   - [ ] All environment variables set
   - [ ] Credentials from Uzum Bank configured
   - [ ] Database tables created
   - [ ] Configuration validation passes

2. **Security**

   - [ ] Implement proper encryption for secret_key
   - [ ] Set up secure API key authentication
   - [ ] Enable request logging for audit
   - [ ] Configure rate limiting

3. **Monitoring**
   - [ ] Set up transaction monitoring
   - [ ] Configure error alerting
   - [ ] Enable performance tracking
   - [ ] Set up backup procedures

### Environment Setup

```bash
# Production environment variables
NODE_ENV=production
UZUM_MERCHANT_SERVICE_USER_ID=actual-merchant-id
UZUM_SECRET_KEY=actual-secret-key
UZUM_SERVICE_ID=actual-service-id
UZUM_ENABLE_LOGGING=false
```

### Health Checks

Monitor these endpoints:

- `/api/admin/uzum-bank/status` - Overall system health
- `/api/admin/uzum-bank/config/test` - Configuration validation
- `/health` - Basic server health

## Troubleshooting

### Common Issues

1. **Authentication Failures**

   ```
   Error: apelsin.pay.authorization.error
   ```

   - Check merchant_service_user_id and secret_key
   - Verify timestamp is UTC+5
   - Ensure SHA1 hash computation is correct

2. **Network Timeouts**

   ```
   Error: Request timeout after 15000ms
   ```

   - Check network connectivity
   - Increase timeout if needed
   - Monitor retry attempts

3. **QR Code Issues**
   ```
   Error: QR code data must be at least 40 characters
   ```
   - Verify QR scanner is working correctly
   - Check QR code format from customer app
   - Ensure complete scan (not partial)

### Debug Logging

Enable detailed logging:

```bash
UZUM_ENABLE_LOGGING=true
LOG_LEVEL=debug
```

Check audit logs:

```sql
SELECT * FROM uzum_fastpay_audit_log
WHERE action = 'error_occurred'
ORDER BY created_at DESC
LIMIT 10;
```

### Performance Monitoring

Monitor key metrics:

- Average processing time
- Success rate by hour/day
- Error frequency by type
- Network timeout occurrences

Query for performance analysis:

```sql
SELECT
  DATE(initiated_at) as date,
  COUNT(*) as total_transactions,
  AVG(EXTRACT(EPOCH FROM (completed_at - initiated_at)) * 1000) as avg_time_ms,
  COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM uzum_fastpay_transactions
WHERE initiated_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(initiated_at)
ORDER BY date DESC;
```

## Support

For technical support or questions:

1. Check this documentation first
2. Review audit logs for error details
3. Contact Uzum Bank support for API issues
4. Open issue in project repository for bugs

## Security Considerations

1. **Credential Storage**

   - Store secret_key encrypted in database
   - Use environment variables in production
   - Rotate credentials periodically

2. **Request Validation**

   - Validate all input parameters
   - Implement rate limiting
   - Log all API requests for audit

3. **Network Security**

   - Use HTTPS for all communications
   - Implement request timeouts
   - Monitor for suspicious activity

4. **Data Protection**
   - Mask sensitive data in logs
   - Implement data retention policies
   - Ensure GDPR compliance for customer data
