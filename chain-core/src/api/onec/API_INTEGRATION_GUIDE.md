# OneC Integration API Documentation

## Overview

The OneC Integration API provides comprehensive endpoints for managing all aspects of supermarket chain operations through 1C integration. The API is now organized into specialized modules for better maintainability and functionality.

## Base URL

```
http://localhost:3001/api/1c
```

## Authentication

All endpoints require API key authentication:

```http
Authorization: Bearer your-api-key
```

## API Structure

The API is organized into the following modules:

### 🛍️ Products Management (`/api/1c/products`)

**Endpoints:**

- `GET /` - List products with filtering and pagination
- `POST /` - Import/create products from 1C
- `GET /:id` - Get specific product details
- `PUT /:id` - Update product information
- `DELETE /:id` - Deactivate product
- `PUT /prices` - Bulk price updates
- `POST /bulk` - Bulk product operations
- `GET /sync-status` - Check product sync status

**Example - Import Products:**

```bash
POST /api/1c/products
Content-Type: application/json

{
  "products": [
    {
      "onec_id": "PROD001",
      "sku": "SKU001",
      "barcode": "1234567890123",
      "name": "Sample Product",
      "name_ru": "Пример товара",
      "name_uz": "Namuna mahsulot",
      "category_key": "ELECTRONICS",
      "base_price": 99.99,
      "cost": 75.00,
      "is_active": true
    }
  ]
}
```

### 📂 Categories Management (`/api/1c/categories`)

**Endpoints:**

- `GET /` - List categories with hierarchy
- `POST /` - Import/create categories
- `GET /:id` - Get category details
- `PUT /:id` - Update category
- `DELETE /:id` - Remove category
- `GET /tree` - Get full category tree
- `PUT /reorder` - Reorder categories

### 🏪 Branches Management (`/api/1c/branches`)

**Endpoints:**

- `GET /` - List branches with server info
- `POST /` - Create/update branches
- `GET /:id` - Get branch details
- `PUT /:id` - Update branch information
- `DELETE /:id` - Deactivate branch
- `GET /:id/servers` - Get branch servers
- `POST /:id/servers` - Add branch server
- `GET /:id/health` - Check branch health

### 👥 Customers Management (`/api/1c/customers`)

**Endpoints:**

- `GET /` - List customers with search
- `POST /` - Import/create customers
- `GET /:id` - Get customer details
- `PUT /:id` - Update customer information
- `DELETE /:id` - Deactivate customer
- `GET /:id/transactions` - Get customer transactions
- `PUT /:id/loyalty` - Update loyalty points

### 💰 Transactions Management (`/api/1c/transactions`)

**Endpoints:**

- `GET /` - List transactions with filtering
- `POST /` - Import transactions from 1C
- `GET /:id` - Get transaction details
- `PUT /:id` - Update transaction status
- `GET /:id/items` - Get transaction items
- `POST /:id/items` - Add transaction items
- `PUT /:id/items/:itemId` - Update transaction item

### 👨‍💼 Employees Management (`/api/1c/employees`)

**Endpoints:**

- `GET /` - List employees
- `POST /` - Import/create employees
- `GET /:id` - Get employee details
- `PUT /:id` - Update employee information
- `DELETE /:id` - Deactivate employee
- `GET /:id/time-logs` - Get employee time logs
- `POST /:id/time-logs` - Import time logs

### 📦 Inventory Management (`/api/1c/inventory`)

**Endpoints:**

- `GET /` - List inventory across branches
- `PUT /` - Update inventory levels
- `GET /:productId/:branchId` - Get specific inventory
- `PUT /:productId/:branchId` - Update specific inventory
- `GET /movements` - Get stock movements
- `POST /movements` - Record stock movement
- `GET /low-stock` - Get low stock alerts

### 💳 Payments Management (`/api/1c/payments`)

**Endpoints:**

- `GET /` - List payments
- `POST /` - Import payment data
- `GET /:id` - Get payment details
- `PUT /:id/status` - Update payment status
- `GET /methods/summary` - Get payment methods summary
- `GET /daily-summary` - Get daily payment summary

### 📊 Sync Logs & Analytics (`/api/1c/sync-logs`)

**Endpoints:**

- `GET /` - List sync operations
- `GET /:id` - Get sync details
- `GET /summary` - Get sync summary
- `GET /status` - Get current sync status
- `DELETE /cleanup` - Cleanup old logs
- `GET /settings` - Get integration settings
- `PUT /settings` - Update integration settings

### 📈 Analytics & Reporting (`/api/1c/analytics`)

**Endpoints:**

- `GET /` - Get comprehensive analytics
- `GET /trends` - Get time-series data
- `GET /performance` - Get system performance
- `GET /health` - System health check
- `GET /reports` - Generate reports

## Legacy Endpoints (Maintained for Compatibility)

The original 1C endpoints are still available and maintained:

- `POST /api/1c/products` - Original product import
- `PUT /api/1c/products/prices` - Original price updates
- `PUT /api/1c/inventory` - Original inventory updates
- `POST /api/1c/employees` - Original employee import
- `GET /api/1c/status` - Integration status
- `POST /api/1c/sync` - Manual sync trigger
- `GET /api/1c/export/transactions` - Export transactions
- `GET /api/1c/export/inventory` - Export inventory

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

## Success Responses

All successful responses follow this pattern:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "metadata": {
    // Additional metadata (pagination, timing, etc.)
  }
}
```

## Validation

All inputs are validated using Zod schemas. Invalid data will return a 400 error with validation details.

## Sync Logging

All import/export operations are logged in the `onec_sync_logs` table for monitoring and debugging.

## Branch Communication

The system automatically communicates with branch servers when data is updated, ensuring real-time synchronization across the network.

## Rate Limiting

API endpoints are protected against abuse with rate limiting. Contact your administrator if you encounter rate limit errors.

## Testing

Use tools like Postman, Insomnia, or curl to test the endpoints. All endpoints require proper authentication and return JSON responses.

## Support

For API support, refer to the system logs or contact your system administrator.
