# Branch-Core Chain-Core Integration API Documentation

## Overview

This API provides integration between individual branch servers (branch-core) and the central chain management system (chain-core). It handles product synchronization, inventory updates, price changes, employee management, and transaction reporting at the branch level.

**Base URL:** `http://branch-server/api/chain-core`

**Authentication:** Bearer token required for all endpoints

**Content-Type:** `application/json`

## Key Features

- **Barcode-First Product Identification**: All product operations prioritize barcode as primary identifier
- **Real-time Synchronization**: Immediate processing of updates from chain-core
- **Local Data Management**: Maintains local branch database for POS operations
- **Transaction Reporting**: Reports sales data back to chain-core
- **Inventory Tracking**: Real-time inventory level management

---

## Product Management

### 1. Sync Products from Chain-Core

```http
POST /api/chain-core/products/sync
```

**Description:** Receives product data from chain-core and updates local branch database.

**Request Body:**

```json
{
  "products": [
    {
      "sku": "COCA_500ML",
      "barcode": "1234567890123",
      "name": "Coca-Cola 500ml",
      "name_ru": "Кока-Кола 500мл",
      "name_uz": "Koka-Kola 500ml",
      "description": "Carbonated soft drink",
      "category_key": "beverages",
      "brand": "Coca-Cola",
      "unit_of_measure": "bottle",
      "base_price": 10.0,
      "cost": 7.5,
      "tax_rate": 0.12,
      "image_url": "https://example.com/coca-cola.jpg",
      "is_active": true
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "barcode": "1234567890123",
        "sku": "COCA_500ML",
        "action": "synced",
        "product_id": 123
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

### 2. Update Product Prices

```http
PUT /api/chain-core/products/prices
```

**Description:** Updates product prices from chain-core instructions. Uses barcode as primary identifier.

**Request Body:**

```json
{
  "updates": [
    {
      "barcode": "1234567890123",
      "sku": "COCA_500ML",
      "price": 12.0,
      "cost": 8.0,
      "effective_date": "2025-08-18T00:00:00Z"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "product_id": 123,
        "barcode": "1234567890123",
        "sku": "COCA_500ML",
        "old_price": 10.0,
        "new_price": 12.0,
        "old_cost": 7.5,
        "new_cost": 8.0
      }
    ],
    "updated": 1,
    "failed": 0
  }
}
```

---

## Inventory Management

### 3. Get Current Inventory

```http
GET /api/chain-core/inventory
```

**Description:** Returns current inventory levels for all products in the branch.

**Query Parameters:**

- `barcode` (optional): Filter by specific product barcode
- `sku` (optional): Filter by specific product SKU
- `low_stock_only` (optional): Return only low stock items (default: false)

**Response:**

```json
{
  "success": true,
  "data": {
    "inventory": [
      {
        "product_id": 123,
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "product_name": "Coca-Cola 500ml",
        "quantity_in_stock": 150,
        "reserved_quantity": 10,
        "available_quantity": 140,
        "min_stock_level": 20,
        "max_stock_level": 200,
        "reorder_point": 30,
        "last_counted_at": "2025-08-15T10:00:00Z",
        "updated_at": "2025-08-17T12:00:00Z"
      }
    ],
    "total_items": 1,
    "low_stock_items": 0
  }
}
```

### 4. Update Inventory Levels

```http
PUT /api/chain-core/inventory
```

**Description:** Updates inventory levels based on chain-core instructions or local adjustments.

**Request Body:**

```json
{
  "updates": [
    {
      "barcode": "1234567890123",
      "sku": "COCA_500ML",
      "quantity_adjustment": 50,
      "adjustment_type": "add",
      "reason": "Stock delivery",
      "reference_number": "DEL-001"
    }
  ]
}
```

**Adjustment Types:**

- `add`: Add to current stock
- `subtract`: Remove from current stock
- `set`: Set absolute quantity

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "product_id": 123,
        "barcode": "1234567890123",
        "sku": "COCA_500ML",
        "old_quantity": 150,
        "new_quantity": 200,
        "adjustment": 50
      }
    ],
    "updated": 1,
    "failed": 0
  }
}
```

---

## Employee Management

### 5. Sync Employees from Chain-Core

```http
POST /api/chain-core/employees
```

**Description:** Receives employee data from chain-core and updates local branch database.

**Request Body:**

```json
{
  "employees": [
    {
      "employee_id": "E12345",
      "name": "John Smith",
      "role": "cashier",
      "phone": "+1234567890",
      "email": "john.smith@rockpoint.com",
      "hire_date": "2025-08-01",
      "status": "active"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "employee_id": "E12345",
        "name": "John Smith",
        "action": "synced"
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

### 6. Get Branch Employees

```http
GET /api/chain-core/employees
```

**Description:** Returns all employees assigned to this branch.

**Query Parameters:**

- `status` (optional): Filter by employee status (active, inactive, terminated)
- `role` (optional): Filter by employee role

**Response:**

```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": 1,
        "employee_id": "E12345",
        "name": "John Smith",
        "role": "cashier",
        "phone": "+1234567890",
        "email": "john.smith@rockpoint.com",
        "hire_date": "2025-08-01T00:00:00Z",
        "status": "active",
        "created_at": "2025-08-01T09:00:00Z",
        "updated_at": "2025-08-01T09:00:00Z"
      }
    ],
    "total_employees": 1
  }
}
```

---

## Transaction Reporting

### 7. Report Transaction to Chain-Core

```http
POST /api/chain-core/transactions
```

**Description:** Reports completed transactions from POS to chain-core system.

**Request Body:**

```json
{
  "transaction": {
    "transaction_number": "TXN-BR001-001",
    "employee_id": "E12345",
    "customer_id": null,
    "subtotal": 24.0,
    "tax_amount": 2.88,
    "discount_amount": 0.0,
    "total_amount": 26.88,
    "payment_method": "card",
    "status": "completed",
    "completed_at": "2025-08-17T14:30:00Z",
    "items": [
      {
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "quantity": 2,
        "unit_price": 12.0,
        "original_price": 12.0,
        "discount_amount": 0.0,
        "total_amount": 24.0
      }
    ]
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "transaction_id": 12345,
    "transaction_number": "TXN-BR001-001",
    "status": "reported",
    "chain_core_id": "CC_TXN_67890",
    "reported_at": "2025-08-17T14:31:00Z"
  }
}
```

### 8. Get Transaction History

```http
GET /api/chain-core/transactions
```

**Description:** Returns transaction history for this branch.

**Query Parameters:**

- `start_date` (optional): Start date for transaction range
- `end_date` (optional): End date for transaction range
- `status` (optional): Filter by transaction status
- `employee_id` (optional): Filter by specific employee
- `limit` (optional): Number of transactions to return (default: 100)
- `offset` (optional): Number of transactions to skip (default: 0)

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 1,
        "transaction_number": "TXN-BR001-001",
        "employee_id": "E12345",
        "employee_name": "John Smith",
        "subtotal": 24.0,
        "tax_amount": 2.88,
        "discount_amount": 0.0,
        "total_amount": 26.88,
        "payment_method": "card",
        "status": "completed",
        "completed_at": "2025-08-17T14:30:00Z",
        "chain_core_id": "CC_TXN_67890"
      }
    ],
    "total_transactions": 1,
    "total_amount": 26.88
  }
}
```

---

## Health & Status

### 9. Get Branch Status

```http
GET /api/chain-core/status
```

**Description:** Returns current branch status and connection to chain-core.

**Response:**

```json
{
  "success": true,
  "data": {
    "branch_status": "online",
    "chain_core_connection": "connected",
    "last_sync": {
      "products": "2025-08-17T12:00:00Z",
      "inventory": "2025-08-17T13:30:00Z",
      "employees": "2025-08-17T09:00:00Z"
    },
    "statistics": {
      "total_products": 150,
      "total_employees": 5,
      "daily_transactions": 25,
      "daily_revenue": 650.0,
      "inventory_items": 148
    },
    "pos_systems": {
      "online": 3,
      "offline": 0,
      "total": 3
    },
    "timestamp": "2025-08-17T15:00:00Z"
  }
}
```

### 10. Health Check

```http
GET /api/chain-core/health
```

**Description:** Simple health check endpoint for monitoring.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "chain_core": "connected",
    "uptime": "72:15:30",
    "timestamp": "2025-08-17T15:00:00Z"
  }
}
```

---

## Synchronization Endpoints

### 11. Force Sync with Chain-Core

```http
POST /api/chain-core/sync
```

**Description:** Manually triggers synchronization with chain-core system.

**Request Body:**

```json
{
  "sync_type": "all",
  "force": false
}
```

**Sync Types:**

- `products`: Sync product data only
- `inventory`: Sync inventory levels only
- `employees`: Sync employee data only
- `all`: Sync all data types

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_branch_001",
    "sync_type": "all",
    "status": "started",
    "estimated_duration": "2-5 minutes",
    "started_at": "2025-08-17T15:00:00Z"
  }
}
```

### 12. Get Sync Status

```http
GET /api/chain-core/sync/{syncId}/status
```

**Description:** Returns status of a specific sync operation.

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_branch_001",
    "sync_type": "all",
    "status": "completed",
    "started_at": "2025-08-17T15:00:00Z",
    "completed_at": "2025-08-17T15:03:00Z",
    "results": {
      "products": {
        "processed": 150,
        "updated": 145,
        "failed": 0
      },
      "inventory": {
        "processed": 148,
        "updated": 12,
        "failed": 0
      },
      "employees": {
        "processed": 5,
        "updated": 0,
        "failed": 0
      }
    }
  }
}
```

---

## Error Handling

### Common Error Codes

| Status Code | Error Type            | Description                                         |
| ----------- | --------------------- | --------------------------------------------------- |
| 400         | Bad Request           | Invalid request data or missing required fields     |
| 401         | Unauthorized          | Invalid or missing authentication token             |
| 404         | Not Found             | Resource not found (product, employee, transaction) |
| 409         | Conflict              | Duplicate resource or constraint violation          |
| 422         | Validation Error      | Request validation failed                           |
| 500         | Internal Server Error | Server-side error                                   |
| 503         | Service Unavailable   | Chain-core system unavailable                       |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific_field",
    "message": "Detailed error description"
  },
  "timestamp": "2025-08-17T15:00:00Z"
}
```

---

## Rate Limiting

- **Product Sync**: 50 requests per minute
- **Inventory Updates**: 100 requests per minute
- **Transaction Reporting**: 200 requests per minute
- **Employee Sync**: 30 requests per minute
- **Status/Health**: Unlimited

---

## Data Types & Validation

### Product Schema

- `barcode`: Primary identifier, string
- `sku`: Required string, stock keeping unit
- `name`: Required string, product name
- `base_price`: Required positive number
- `cost`: Optional positive number
- `is_active`: Boolean (default: true)

### Transaction Schema

- `transaction_number`: Required unique string
- `employee_id`: Required string
- `total_amount`: Required positive number
- `payment_method`: Enum (cash, card, mobile, other)
- `status`: Enum (pending, completed, cancelled, refunded)

### Employee Roles

- `admin`: Full branch access
- `manager`: Branch management access
- `supervisor`: Shift supervision access
- `cashier`: POS operation access

### Adjustment Types

- `add`: Add quantity to current stock
- `subtract`: Remove quantity from current stock
- `set`: Set absolute quantity level

---

## Integration Notes

1. **Barcode Priority**: All product operations prioritize barcode identification with fallback to SKU
2. **Real-time Updates**: Inventory changes are immediately reflected in local database
3. **Offline Support**: System can operate offline and sync when connection is restored
4. **Transaction Integrity**: All operations support database transactions for consistency
5. **Audit Trail**: All changes are logged with timestamps and reference information

---

## Webhooks (Optional)

### Chain-Core Notifications

The branch-core system can receive webhooks from chain-core for real-time updates:

```http
POST /api/chain-core/webhooks/product-update
POST /api/chain-core/webhooks/price-change
POST /api/chain-core/webhooks/inventory-adjustment
POST /api/chain-core/webhooks/employee-update
```

Each webhook follows the same authentication and response format as regular API endpoints.

---

## Support

For technical support or integration assistance, contact the RockPoint development team.

**API Version:** 1.0  
**Last Updated:** August 17, 2025
