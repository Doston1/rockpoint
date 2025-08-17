# Chain-Core 1C Integration API Documentation

## Overview

This API provides comprehensive integration between the 1C Enterprise Resource Planning system and the RockPoint chain management system. It handles product management, inventory synchronization, employee data, and transaction reporting across all retail branches.

**Base URL:** `http://chain-core-server/api/1c`

**Authentication:** API Key required for all endpoints

**Content-Type:** `application/json`

## Authentication

All requests must include a valid API key in the Authorization header using one of these formats:

```http
Authorization: Bearer rp_your_api_key_here
```

or

```http
Authorization: ApiKey rp_your_api_key_here
```

or

```http
Authorization: rp_your_api_key_here
```

**Example Request:**

```bash
curl -X POST http://chain-core-server/api/1c/products \
  -H "Authorization: Bearer rp_1C_DEFAULT_KEY_REPLACE_IN_PRODUCTION" \
  -H "Content-Type: application/json" \
  -d '[{"oneC_id": "PROD_001", "sku": "COCA_500ML", ...}]'
```

## Key Features

- **Barcode-First Product Identification**: All product operations prioritize barcode as primary identifier
- **Multi-Branch Synchronization**: Automatic distribution of changes to all branch servers
- **Background Processing**: Async operations for large data synchronization
- **Comprehensive Logging**: Detailed sync logs and error tracking
- **Real-time Monitoring**: Health checks and system status endpoints

---

## Product Management

### 1. Create/Update Products (Bulk)

```http
POST /api/1c/products
```

**Description:** Creates or updates products in bulk from 1C system. Automatically synchronizes to all active branches.

**Request Body:**

```json
[
  {
    "oneC_id": "PROD_001",
    "sku": "COCA_500ML",
    "barcode": "1234567890123",
    "name": "Coca-Cola 500ml",
    "name_ru": "Кока-Кола 500мл",
    "name_uz": "Koka-Kola 500ml",
    "description": "Carbonated soft drink",
    "description_ru": "Газированный напиток",
    "description_uz": "Gazlangan ichimlik",
    "category_key": "beverages",
    "brand": "Coca-Cola",
    "unit_of_measure": "bottle",
    "base_price": 10.0,
    "cost": 7.5,
    "tax_rate": 0.12,
    "image_url": "https://example.com/coca-cola.jpg",
    "images": ["https://example.com/coca-cola-1.jpg"],
    "attributes": {
      "volume": "500ml",
      "flavor": "original"
    },
    "is_active": true
  }
]
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12345",
    "results": [
      {
        "success": true,
        "product_id": 123,
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "name": "Coca-Cola 500ml",
        "action": "created/updated"
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "field": "barcode",
      "message": "Barcode is required"
    }
  ]
}
```

### 2. Update Product Prices (Multi-Branch)

```http
PUT /api/1c/products/prices
```

**Description:** Updates product prices across specified branches or all branches. Uses barcode as primary identifier.

**Request Body:**

```json
{
  "updates": [
    {
      "barcode": "1234567890123",
      "oneC_id": "PROD_001",
      "sku": "COCA_500ML",
      "base_price": 12.0,
      "cost": 8.5,
      "branch_codes": ["BR001", "BR002"],
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
    "sync_id": "sync_12346",
    "results": [
      {
        "success": true,
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "new_price": 12.0,
        "branches_updated": 2
      }
    ],
    "updated": 1,
    "failed": 0
  }
}
```

---

## Inventory Management

### 3. Update Inventory Levels

```http
PUT /api/1c/inventory
```

**Description:** Updates inventory levels for specific products and branches. Synchronizes with branch-core systems.

**Request Body:**

```json
{
  "updates": [
    {
      "barcode": "1234567890123",
      "oneC_id": "PROD_001",
      "sku": "COCA_500ML",
      "branch_code": "BR001",
      "quantity_in_stock": 150,
      "min_stock_level": 20,
      "max_stock_level": 200
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12347",
    "results": [
      {
        "success": true,
        "barcode": "1234567890123",
        "sku": "COCA_500ML",
        "branch_code": "BR001",
        "old_quantity": 100,
        "new_quantity": 150
      }
    ],
    "updated": 1,
    "failed": 0
  }
}
```

---

## Employee Management

### 4. Create/Update Employees

```http
POST /api/1c/employees
```

**Description:** Creates or updates employee records from 1C system. Synchronizes with respective branch servers.

**Request Body:**

```json
[
  {
    "oneC_id": "EMP_001",
    "employee_id": "E12345",
    "branch_code": "BR001",
    "name": "John Smith",
    "role": "cashier",
    "phone": "+1234567890",
    "email": "john.smith@rockpoint.com",
    "hire_date": "2025-08-01",
    "salary": 3000.0,
    "status": "active"
  }
]
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12348",
    "results": [
      {
        "success": true,
        "employee_id": "E12345",
        "name": "John Smith",
        "branch_code": "BR001",
        "action": "created/updated"
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

---

## Synchronization & Status

### 5. Get Integration Status

```http
GET /api/1c/status
```

**Description:** Returns comprehensive status of 1C integration, sync history, and system health.

**Response:**

```json
{
  "success": true,
  "data": {
    "integration_status": "connected",
    "last_sync_history": [
      {
        "sync_type": "products",
        "direction": "import",
        "status": "completed",
        "records_processed": 150,
        "error_message": null,
        "started_at": "2025-08-17T10:00:00Z",
        "completed_at": "2025-08-17T10:05:00Z"
      }
    ],
    "sync_configuration": {
      "auto_sync_enabled": true,
      "sync_interval_minutes": 30,
      "supported_entities": [
        "products",
        "transactions",
        "inventory",
        "employees"
      ]
    },
    "active_branches": 5,
    "timestamp": "2025-08-17T12:00:00Z"
  }
}
```

### 6. Trigger Manual Sync

```http
POST /api/1c/sync
```

**Description:** Initiates manual synchronization process to specific branches or all branches.

**Request Body:**

```json
{
  "entity_type": "products",
  "branch_codes": ["BR001", "BR002"],
  "force_sync": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12349",
    "message": "Sync process started for products",
    "estimated_duration": "5-10 minutes",
    "target_branches": ["BR001", "BR002"]
  }
}
```

### 7. Get Sync Status

```http
GET /api/1c/sync/{syncId}/status
```

**Description:** Returns status of a specific sync operation.

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12349",
    "entity_type": "products",
    "direction": "to_branches",
    "status": "completed",
    "records_processed": 150,
    "started_at": "2025-08-17T11:00:00Z",
    "completed_at": "2025-08-17T11:05:00Z",
    "error_message": null
  }
}
```

---

## Data Export (For 1C)

### 8. Export Transaction Data

```http
GET /api/1c/export/transactions
```

**Description:** Exports transaction data from all branches for 1C system consumption.

**Query Parameters:**

- `branch_codes[]` (optional): Specific branch codes to export
- `start_date` (optional): Start date for transaction range
- `end_date` (optional): End date for transaction range
- `include_items` (optional): Include transaction line items (default: true)

**Example Request:**

```http
GET /api/1c/export/transactions?start_date=2025-08-01&end_date=2025-08-17&include_items=true
```

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 12345,
        "transaction_number": "TXN-BR001-001",
        "branch_code": "BR001",
        "branch_name": "Main Store",
        "employee_id": "E12345",
        "employee_name": "John Smith",
        "subtotal": 50.0,
        "tax_amount": 6.0,
        "discount_amount": 0.0,
        "total_amount": 56.0,
        "payment_method": "card",
        "status": "completed",
        "completed_at": "2025-08-17T14:30:00Z",
        "onec_id": null,
        "items": [
          {
            "transaction_id": 12345,
            "sku": "COCA_500ML",
            "barcode": "1234567890123",
            "product_name": "Coca-Cola 500ml",
            "product_onec_id": "PROD_001",
            "quantity": 2,
            "unit_price": 12.0,
            "original_price": 12.0,
            "discount_amount": 0.0,
            "total_amount": 24.0
          }
        ]
      }
    ],
    "export_timestamp": "2025-08-17T15:00:00Z",
    "include_items": true,
    "filter": {
      "branch_codes": "all",
      "start_date": "2025-08-01",
      "end_date": "2025-08-17"
    }
  }
}
```

### 9. Export Inventory Data

```http
GET /api/1c/export/inventory
```

**Description:** Exports current inventory levels from all branches for 1C system.

**Query Parameters:**

- `branch_codes[]` (optional): Specific branch codes to export

**Response:**

```json
{
  "success": true,
  "data": {
    "inventory": [
      {
        "branch_code": "BR001",
        "branch_name": "Main Store",
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "product_name": "Coca-Cola 500ml",
        "product_onec_id": "PROD_001",
        "quantity_in_stock": 150,
        "reserved_quantity": 10,
        "min_stock_level": 20,
        "max_stock_level": 200,
        "reorder_point": 30,
        "last_counted_at": "2025-08-15T10:00:00Z",
        "updated_at": "2025-08-17T12:00:00Z"
      }
    ],
    "export_timestamp": "2025-08-17T15:00:00Z",
    "filter": {
      "branch_codes": "all"
    }
  }
}
```

---

## Error Handling

### Common Error Codes

| Status Code | Error Type            | Description                                      |
| ----------- | --------------------- | ------------------------------------------------ |
| 400         | Bad Request           | Invalid request data or missing required fields  |
| 401         | Unauthorized          | Invalid or missing authentication token          |
| 404         | Not Found             | Resource not found (product, branch, etc.)       |
| 409         | Conflict              | Duplicate resource (SKU, barcode already exists) |
| 422         | Validation Error      | Request validation failed                        |
| 500         | Internal Server Error | Server-side error                                |
| 503         | Service Unavailable   | 1C system or branch server unavailable           |

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

- **Products API**: 100 requests per minute
- **Inventory API**: 200 requests per minute
- **Sync Operations**: 10 requests per minute
- **Export Operations**: 20 requests per minute

---

## Data Types & Validation

### Product Schema

- `oneC_id`: Required string, unique identifier from 1C
- `sku`: Required string, stock keeping unit
- `barcode`: Optional string, product barcode (primary identifier)
- `name`: Required string, product name
- `base_price`: Required positive number
- `cost`: Required positive number
- `tax_rate`: Number between 0 and 1 (default: 0)
- `is_active`: Boolean (default: true)

### Employee Roles

- `admin`: Full system access
- `manager`: Branch management access
- `supervisor`: Shift supervision access
- `cashier`: POS operation access

### Sync Entity Types

- `products`: Product data synchronization
- `inventory`: Inventory level synchronization
- `employees`: Employee data synchronization
- `transactions`: Transaction data export
- `all`: Complete system synchronization

---

## Integration Notes

1. **Barcode Priority**: All product operations prioritize barcode identification with fallback to oneC_id and SKU
2. **Async Operations**: Large sync operations run in background with job tracking
3. **Branch Distribution**: Changes automatically propagate to all active branches
4. **Transaction Support**: All bulk operations support database transactions for consistency
5. **Monitoring**: Comprehensive logging for all sync operations and errors

---

## Support

For technical support or integration assistance, contact the RockPoint development team.

**API Version:** 1.0  
**Last Updated:** August 17, 2025
