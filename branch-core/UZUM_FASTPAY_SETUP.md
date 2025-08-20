# Uzum Bank FastPay Integration - Quick Setup Guide

## Overview

This guide will help you set up the Uzum Bank FastPay integration for your RockPoint Branch Management System.

## Prerequisites

- Node.js 18+ with npm
- PostgreSQL database
- Valid Uzum Bank merchant account
- Redis (optional, for caching)

## Step 1: Install Dependencies

The FastPay integration requires the `axios` HTTP client, which has already been added to the project.

```bash
cd branch-core
npm install
```

## Step 2: Database Setup

Run the database migration to create FastPay tables:

```bash
# Make sure your DATABASE_URL is configured in .env
npm run db:migrate

# Or manually run the SQL file
psql -d your_database < database/uzum_bank_tables.sql
```

## Step 3: Environment Configuration

Copy the example environment file and configure your Uzum Bank credentials:

```bash
cp .env.example .env
```

Edit `.env` and set the following required variables:

```bash
# REQUIRED: Get these from your Uzum Bank manager
UZUM_MERCHANT_SERVICE_USER_ID=your-cash-register-id
UZUM_SECRET_KEY=your-secret-key-from-uzum-bank
UZUM_SERVICE_ID=your-service-id

# OPTIONAL: Environment settings
UZUM_API_BASE_URL=https://mobile.apelsin.uz  # Use test URL for development
FASTPAY_ENABLED=true
```

## Step 4: Test Configuration

Start the server and test the configuration endpoint:

```bash
npm run dev
```

Visit: `http://localhost:3001/api/admin/uzum-bank/config` (requires admin authentication)

## Step 5: API Endpoints

### For POS Integration:

- `POST /api/fastpay` - Create payment
- `POST /api/fastpay/fiscalize` - Submit fiscalization
- `POST /api/fastpay/reverse` - Reverse payment
- `GET /api/fastpay/status/:id` - Check payment status
- `GET /api/fastpay/transactions` - Get transaction history

### For Admin/Management:

- `GET /api/admin/uzum-bank/config` - View configuration
- `PUT /api/admin/uzum-bank/config` - Update configuration
- `GET /api/admin/uzum-bank/analytics` - View analytics
- `GET /api/admin/uzum-bank/transactions` - Transaction management

## Step 6: Testing the Integration

### Test Payment Flow:

```bash
# 1. Create a payment
curl -X POST http://localhost:3001/api/fastpay \
  -H "Content-Type: application/json" \
  -d '{
    "qrCode": "your-40-plus-character-qr-code-from-uzum-app",
    "amount": 50000,
    "description": "Test payment",
    "cashboxCode": "RockPoint_001"
  }'

# 2. Check payment status
curl http://localhost:3001/api/fastpay/status/payment-id-from-step-1

# 3. Submit fiscalization (if payment succeeded)
curl -X POST http://localhost:3001/api/fastpay/fiscalize \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "payment-id-from-step-1",
    "receiptId": "receipt-12345",
    "items": [
      {
        "name": "Test Product",
        "quantity": 1,
        "price": 50000
      }
    ]
  }'
```

## Security Considerations

### Production Setup:

1. **Use HTTPS**: Ensure all API calls use HTTPS in production
2. **Secure Credentials**: Store Uzum Bank credentials securely
3. **Database Encryption**: Consider encrypting sensitive data in the database
4. **Access Control**: Implement proper authentication for admin endpoints
5. **Rate Limiting**: Add rate limiting to prevent abuse

### Credential Management:

```bash
# Enable credential encryption (optional)
UZUM_CONFIG_ENCRYPTION_KEY=your-32-character-encryption-key
```

## Monitoring and Logging

The integration includes comprehensive logging:

- All API requests/responses are logged
- Payment status changes are tracked
- Error details are captured for debugging
- Performance metrics are recorded

View logs:

```bash
# Check application logs
tail -f logs/application.log

# Check FastPay specific logs
grep "FastPay" logs/application.log
```

## Common Issues

### 1. "QR code must be at least 40 characters"

- Ensure the QR code from Uzum app is complete
- QR codes are typically 40+ characters for valid payments

### 2. "Authentication failed"

- Verify your UZUM_SECRET_KEY is correct
- Check that UZUM_MERCHANT_SERVICE_USER_ID matches your account

### 3. "Payment timeout"

- Default timeout is 15 seconds
- Increase UZUM_REQUEST_TIMEOUT_MS if needed

### 4. Database connection errors

- Ensure PostgreSQL is running
- Verify DATABASE_URL is correct
- Check that FastPay tables exist

## Support

For technical issues:

1. Check the logs for detailed error messages
2. Verify all environment variables are set
3. Test with the Uzum Bank test environment first
4. Contact your Uzum Bank integration manager for API issues

For production deployment:

1. Use the production Uzum Bank API URL
2. Enable HTTPS
3. Set up monitoring and alerting
4. Configure backup and recovery procedures

---

**Note**: This integration requires active coordination with Uzum Bank for merchant onboarding and API credentials.
