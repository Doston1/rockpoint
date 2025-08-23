# 1C Integration API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Response Format](#response-format)
4. [Error Handling](#error-handling)
5. [API Endpoints](#api-endpoints)
   - [Products Management](#products-management)
   - [Inventory Management](#inventory-management)
   - [Employee Management](#employee-management)
   - [Customers Management](#customers-management)
   - [Transactions Management](#transactions-management)
   - [Payments Management](#payments-management)
   - [Data Export](#data-export)
   - [Synchronization](#synchronization)
6. [Data Schemas](#data-schemas)
7. [Rate Limiting](#rate-limiting)

---

## Overview

This API provides comprehensive integration between the 1C Enterprise Resource Planning system and the RockPoint chain management system. It handles product management, inventory synchronization, employee data, and transaction reporting across all retail branches.

**API Information:**

- **Base URL:** `http://chain-core-server/api/1c`
- **Version:** 2.0
- **Last Updated:** August 23, 2025
- **Content-Type:** `application/json`
- **Test Coverage:** 100% (Products Module)

**Key Capabilities:**

- ✅ **Multi-identifier Support**: UUID, oneC_id, SKU, barcode
- ✅ **Advanced Validation**: Individual and bulk validation with partial success
- ✅ **Multi-language Support**: English, Russian, Uzbek
- ✅ **Real-time Sync**: Automatic branch synchronization
- ✅ **Robust Error Handling**: Detailed error reporting and recovery
- ✅ **Performance Optimized**: Advanced pagination and caching

---

## Authentication

All API requests require authentication using an API key in the Authorization header.

**Supported Formats:**

```http
Authorization: Bearer rp_your_api_key_here
Authorization: ApiKey rp_your_api_key_here
Authorization: rp_your_api_key_here
```

**Example Request:**

```bash
curl -X GET http://chain-core-server/api/1c/products \
  -H "Authorization: Bearer rp_1C_DEFAULT_KEY_REPLACE_IN_PRODUCTION" \
  -H "Content-Type: application/json"
```

**Security Notes:**

- Replace default API keys in production
- API keys should be kept secure and rotated regularly
- Invalid or missing API keys return 401 Unauthorized

---

## Response Format

All API responses follow a consistent format for predictable integration.

**Success Response:**

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "metadata": {
    "timestamp": "2025-08-23T15:00:00Z",
    "processing_time_ms": 125
  }
}
```

**Paginated Response:**

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1000,
      "pages": 20
    }
  }
}
```

---

## Error Handling

The API implements comprehensive error handling with detailed error information.

**Error Response Format:**

```json
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific_field",
    "validation_errors": [...]
  },
  "timestamp": "2025-08-23T15:00:00Z"
}
```

**Common Error Codes:**

| Code                 | Status | Description                |
| -------------------- | ------ | -------------------------- |
| `VALIDATION_ERROR`   | 400    | Request validation failed  |
| `UNAUTHORIZED`       | 401    | Invalid or missing API key |
| `NOT_FOUND`          | 404    | Resource not found         |
| `DUPLICATE_RESOURCE` | 409    | Resource already exists    |
| `SERVER_ERROR`       | 500    | Internal server error      |

**Partial Success Handling:**

For bulk operations, the API supports partial success scenarios:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "oneC_id": "PROD_001",
        "success": true,
        "action": "created"
      },
      {
        "oneC_id": "PROD_002",
        "success": false,
        "error": "Validation failed: Invalid price"
      }
    ],
    "imported": 1,
    "failed": 1
  }
}
```

---

## API Endpoints

### Products Management

The Products API provides comprehensive product management capabilities with advanced validation, multi-identifier support, and real-time synchronization across all branches.

#### 1. List Products

```http
GET /api/1c/products
```

**Description:** Retrieves products with advanced filtering, search, and pagination capabilities.

**Query Parameters:**

| Parameter      | Type    | Required | Description                              |
| -------------- | ------- | -------- | ---------------------------------------- |
| `page`         | integer | No       | Page number (default: 1)                 |
| `limit`        | integer | No       | Items per page (default: 100, max: 1000) |
| `category_key` | string  | No       | Filter by category                       |
| `is_active`    | boolean | No       | Filter by active status                  |
| `search`       | string  | No       | Search in name, SKU, or barcode          |

**Example Request:**

```bash
GET /api/1c/products?page=1&limit=50&search=coca&is_active=true
```

**Response:**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "oneC_id": "PROD_001",
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "name": "Coca-Cola 500ml",
        "name_ru": "Кока-Кола 500мл",
        "name_uz": "Koka-Kola 500ml",
        "description": "Carbonated soft drink",
        "brand": "Coca-Cola",
        "unit_of_measure": "bottle",
        "base_price": "12.00",
        "cost": "8.50",
        "tax_rate": "0.12",
        "image_url": "https://example.com/coca-cola.jpg",
        "attributes": {
          "volume": "500ml",
          "flavor": "original"
        },
        "is_active": true,
        "category_key": "beverages",
        "created_at": "2025-08-23T10:00:00Z",
        "updated_at": "2025-08-23T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

#### 2. Get Product by ID

```http
GET /api/1c/products/{identifier}
```

**Description:** Retrieves a specific product using any identifier type (UUID, oneC_id, SKU, or barcode).

**Path Parameters:**

| Parameter    | Type   | Description                            |
| ------------ | ------ | -------------------------------------- |
| `identifier` | string | Product UUID, oneC_id, SKU, or barcode |

**Example Requests:**

```bash
GET /api/1c/products/PROD_001                              # oneC_id
GET /api/1c/products/COCA_500ML                            # SKU
GET /api/1c/products/1234567890123                         # barcode
GET /api/1c/products/550e8400-e29b-41d4-a716-446655440000  # UUID
```

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "oneC_id": "PROD_001",
      "sku": "COCA_500ML",
      "barcode": "1234567890123",
      "name": "Coca-Cola 500ml",
      "base_price": "12.00",
      "cost": "8.50",
      "is_active": true,
      "category_key": "beverages"
    }
  }
}
```

#### 3. Create/Update Products (Bulk)

```http
POST /api/1c/products
```

**Description:** Creates or updates products in bulk with individual validation and partial success support.

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
    "category_key": "beverages",
    "brand": "Coca-Cola",
    "unit_of_measure": "bottle",
    "base_price": 12.0,
    "cost": 8.5,
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

**Success Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12345",
    "results": [
      {
        "oneC_id": "PROD_001",
        "sku": "COCA_500ML",
        "success": true,
        "action": "created"
      }
    ],
    "imported": 1,
    "failed": 0
  }
}
```

**Partial Success Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12346",
    "results": [
      {
        "oneC_id": "PROD_001",
        "success": true,
        "action": "created"
      },
      {
        "oneC_id": "PROD_002",
        "success": false,
        "error": "Validation failed: Required field 'name' is missing"
      }
    ],
    "imported": 1,
    "failed": 1
  }
}
```

#### 4. Update Product

```http
PUT /api/1c/products/{identifier}
```

**Description:** Updates a specific product identified by UUID, oneC_id, SKU, or barcode.

**Path Parameters:**

| Parameter    | Type   | Description                            |
| ------------ | ------ | -------------------------------------- |
| `identifier` | string | Product UUID, oneC_id, SKU, or barcode |

**Request Body:**

```json
{
  "name": "Updated Product Name",
  "base_price": 15.0,
  "cost": 10.0,
  "is_active": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Product updated successfully",
    "product_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### 5. Update Product Prices (Multi-Branch)

```http
PUT /api/1c/products/prices
```

**Description:** Updates product prices across specified branches with flexible product identification.

**Request Body:**

```json
{
  "updates": [
    {
      "barcode": "1234567890123",
      "oneC_id": "PROD_001",
      "sku": "COCA_500ML",
      "base_price": 15.0,
      "cost": 10.5,
      "branch_codes": ["BR001", "BR002"],
      "effective_date": "2025-08-24T00:00:00Z"
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
        "oneC_id": "PROD_001",
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "success": true,
        "old_price": "12.00",
        "new_price": "15.00",
        "branches_updated": 2
      }
    ],
    "updated": 1,
    "failed": 0
  }
}
```

#### 6. Deactivate Product

```http
DELETE /api/1c/products/{identifier}
```

**Description:** Deactivates a product (sets is_active to false) without permanent deletion.

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Product deactivated successfully"
  }
}
```

### Inventory Management

#### Update Inventory Levels

```http
PUT /api/1c/inventory
```

**Description:** Updates inventory levels for specific products and branches with real-time synchronization.

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

### Employee Management

#### Create/Update Employees

```http
POST /api/1c/employees
```

**Description:** Creates or updates employee records from 1C system with role validation and branch assignment.

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
        "action": "created"
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

### Customers Management

#### List Customers

```http
GET /api/1c/customers
```

**Description:** Retrieves customers with search capabilities, purchase history, and loyalty information.

**Query Parameters:**

| Parameter      | Type    | Required | Description                              |
| -------------- | ------- | -------- | ---------------------------------------- |
| `page`         | integer | No       | Page number (default: 1)                 |
| `limit`        | integer | No       | Items per page (default: 100, max: 1000) |
| `search`       | string  | No       | Search in name, phone, or email          |
| `loyalty_tier` | string  | No       | Filter by loyalty tier                   |
| `branch_code`  | string  | No       | Filter by branch                         |

**Example Request:**

```bash
GET /api/1c/customers?page=1&limit=50&search=john&loyalty_tier=gold
```

**Response:**

```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "CUST_001",
        "oneC_id": "1C_CUST_001",
        "name": "John Doe",
        "phone": "+998901234567",
        "email": "john.doe@email.com",
        "loyalty_card": "LC123456789",
        "loyalty_tier": "gold",
        "loyalty_points": 1250,
        "total_purchases": 15,
        "total_spent": "1500.00",
        "last_visit": "2025-08-20T14:30:00Z",
        "created_at": "2025-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 500,
      "pages": 10
    }
  }
}
```

#### Create/Update Customers

```http
POST /api/1c/customers
```

**Description:** Creates or updates customer records from 1C system with loyalty integration.

**Request Body:**

```json
[
  {
    "oneC_id": "1C_CUST_001",
    "name": "John Doe",
    "phone": "+998901234567",
    "email": "john.doe@email.com",
    "birth_date": "1990-05-15",
    "loyalty_card": "LC123456789",
    "loyalty_tier": "silver",
    "loyalty_points": 500,
    "address": {
      "street": "Main Street 123",
      "city": "Tashkent",
      "region": "Tashkent",
      "postal_code": "100000"
    },
    "preferences": {
      "language": "uz",
      "notifications": true
    }
  }
]
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12349",
    "results": [
      {
        "success": true,
        "oneC_id": "1C_CUST_001",
        "customer_id": "CUST_001",
        "name": "John Doe",
        "action": "created"
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

#### Get Customer Details

```http
GET /api/1c/customers/{identifier}
```

**Description:** Retrieves detailed customer information including purchase history and loyalty status.

**Response:**

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "CUST_001",
      "oneC_id": "1C_CUST_001",
      "name": "John Doe",
      "phone": "+998901234567",
      "email": "john.doe@email.com",
      "loyalty_card": "LC123456789",
      "loyalty_tier": "gold",
      "loyalty_points": 1250,
      "purchase_history": {
        "total_transactions": 15,
        "total_spent": "1500.00",
        "average_purchase": "100.00",
        "last_visit": "2025-08-20T14:30:00Z"
      }
    }
  }
}
```

### Transactions Management

#### List Transactions

```http
GET /api/1c/transactions
```

**Description:** Retrieves transactions with advanced filtering, analytics, and line-item details.

**Query Parameters:**

| Parameter        | Type    | Required | Description                              |
| ---------------- | ------- | -------- | ---------------------------------------- |
| `page`           | integer | No       | Page number (default: 1)                 |
| `limit`          | integer | No       | Items per page (default: 100, max: 1000) |
| `branch_codes[]` | array   | No       | Filter by branch codes                   |
| `start_date`     | string  | No       | Start date (ISO 8601)                    |
| `end_date`       | string  | No       | End date (ISO 8601)                      |
| `status`         | string  | No       | Transaction status                       |
| `payment_method` | string  | No       | Payment method filter                    |
| `include_items`  | boolean | No       | Include line items (default: false)      |

**Example Request:**

```bash
GET /api/1c/transactions?start_date=2025-08-01&end_date=2025-08-23&branch_codes[]=BR001&include_items=true
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
        "customer_id": "CUST_001",
        "customer_name": "John Doe",
        "subtotal": "50.00",
        "tax_amount": "6.00",
        "discount_amount": "5.00",
        "total_amount": "51.00",
        "payment_method": "card",
        "status": "completed",
        "completed_at": "2025-08-17T14:30:00Z",
        "oneC_id": "1C_TXN_001",
        "items": [
          {
            "product_id": "PROD_001",
            "sku": "COCA_500ML",
            "barcode": "1234567890123",
            "product_name": "Coca-Cola 500ml",
            "quantity": 2,
            "unit_price": "12.00",
            "total_amount": "24.00",
            "discount_amount": "1.00"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 1000,
      "pages": 10
    },
    "summary": {
      "total_amount": "51000.00",
      "transaction_count": 1000,
      "average_transaction": "51.00"
    }
  }
}
```

#### Get Transaction Details

```http
GET /api/1c/transactions/{id}
```

**Description:** Retrieves detailed transaction information including all line items and payment details.

**Response:**

```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": 12345,
      "transaction_number": "TXN-BR001-001",
      "branch_code": "BR001",
      "employee_id": "E12345",
      "customer_id": "CUST_001",
      "subtotal": "50.00",
      "tax_amount": "6.00",
      "discount_amount": "5.00",
      "total_amount": "51.00",
      "payment_method": "card",
      "status": "completed",
      "items": [
        {
          "product_id": "PROD_001",
          "sku": "COCA_500ML",
          "product_name": "Coca-Cola 500ml",
          "quantity": 2,
          "unit_price": "12.00",
          "total_amount": "24.00"
        }
      ],
      "payments": [
        {
          "method": "card",
          "amount": "51.00",
          "status": "confirmed",
          "processed_at": "2025-08-17T14:30:00Z"
        }
      ]
    }
  }
}
```

#### Import Transactions

```http
POST /api/1c/transactions
```

**Description:** Imports transaction data from branch systems for 1C integration.

**Request Body:**

```json
[
  {
    "transaction_number": "TXN-BR001-001",
    "branch_code": "BR001",
    "employee_id": "E12345",
    "customer_id": "CUST_001",
    "subtotal": 50.0,
    "tax_amount": 6.0,
    "discount_amount": 5.0,
    "total_amount": 51.0,
    "payment_method": "card",
    "status": "completed",
    "completed_at": "2025-08-17T14:30:00Z",
    "items": [
      {
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "quantity": 2,
        "unit_price": 12.0,
        "discount_amount": 1.0
      }
    ]
  }
]
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12350",
    "results": [
      {
        "success": true,
        "transaction_number": "TXN-BR001-001",
        "transaction_id": 12345,
        "action": "imported"
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

### Payments Management

#### List Payments

```http
GET /api/1c/payments
```

**Description:** Retrieves payment transactions with filtering and reconciliation status.

**Query Parameters:**

| Parameter        | Type    | Required | Description                              |
| ---------------- | ------- | -------- | ---------------------------------------- |
| `page`           | integer | No       | Page number (default: 1)                 |
| `limit`          | integer | No       | Items per page (default: 100, max: 1000) |
| `payment_method` | string  | No       | Filter by payment method                 |
| `status`         | string  | No       | Payment status filter                    |
| `start_date`     | string  | No       | Start date (ISO 8601)                    |
| `end_date`       | string  | No       | End date (ISO 8601)                      |
| `branch_codes[]` | array   | No       | Filter by branch codes                   |

**Example Request:**

```bash
GET /api/1c/payments?payment_method=card&status=confirmed&start_date=2025-08-01
```

**Response:**

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "PAY_001",
        "transaction_id": 12345,
        "transaction_number": "TXN-BR001-001",
        "branch_code": "BR001",
        "payment_method": "card",
        "amount": "51.00",
        "status": "confirmed",
        "processed_at": "2025-08-17T14:30:00Z",
        "reconciliation_status": "matched",
        "card_details": {
          "last_four": "1234",
          "card_type": "visa",
          "authorization_code": "AUTH123"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 500,
      "pages": 5
    },
    "summary": {
      "total_amount": "25500.00",
      "payment_count": 500,
      "by_method": {
        "card": "20000.00",
        "cash": "5500.00"
      }
    }
  }
}
```

#### Import Payment Data

```http
POST /api/1c/payments
```

**Description:** Imports payment data from POS systems with reconciliation support.

**Request Body:**

```json
[
  {
    "transaction_id": 12345,
    "payment_method": "card",
    "amount": 51.0,
    "status": "confirmed",
    "processed_at": "2025-08-17T14:30:00Z",
    "payment_details": {
      "card_last_four": "1234",
      "card_type": "visa",
      "authorization_code": "AUTH123",
      "terminal_id": "TERM001"
    }
  }
]
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sync_id": "sync_12351",
    "results": [
      {
        "success": true,
        "payment_id": "PAY_001",
        "transaction_id": 12345,
        "amount": "51.00",
        "action": "imported"
      }
    ],
    "processed": 1,
    "failed": 0
  }
}
```

#### Get Payment Summary

```http
GET /api/1c/payments/summary
```

**Description:** Retrieves payment summary and analytics for specified date range.

**Query Parameters:**

| Parameter        | Type   | Required | Description            |
| ---------------- | ------ | -------- | ---------------------- |
| `start_date`     | string | Yes      | Start date (ISO 8601)  |
| `end_date`       | string | Yes      | End date (ISO 8601)    |
| `branch_codes[]` | array  | No       | Filter by branch codes |

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_amount": "125000.00",
      "transaction_count": 2500,
      "by_method": {
        "card": {
          "amount": "100000.00",
          "count": 2000,
          "percentage": 80.0
        },
        "cash": {
          "amount": "25000.00",
          "count": 500,
          "percentage": 20.0
        }
      },
      "by_branch": [
        {
          "branch_code": "BR001",
          "branch_name": "Main Store",
          "amount": "75000.00",
          "count": 1500
        }
      ],
      "reconciliation": {
        "matched": 2400,
        "unmatched": 50,
        "disputed": 50
      }
    }
  }
}
```

### Data Export

#### Export Transaction Data

```http
GET /api/1c/export/transactions
```

**Description:** Exports transaction data from all branches for 1C system consumption.

**Query Parameters:**

| Parameter        | Type    | Required | Description                        |
| ---------------- | ------- | -------- | ---------------------------------- |
| `branch_codes[]` | array   | No       | Specific branch codes              |
| `start_date`     | string  | No       | Start date (ISO 8601)              |
| `end_date`       | string  | No       | End date (ISO 8601)                |
| `include_items`  | boolean | No       | Include line items (default: true) |

**Example Request:**

```bash
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
        "employee_id": "E12345",
        "subtotal": 50.0,
        "tax_amount": 6.0,
        "total_amount": 56.0,
        "payment_method": "card",
        "status": "completed",
        "completed_at": "2025-08-17T14:30:00Z",
        "items": [
          {
            "sku": "COCA_500ML",
            "barcode": "1234567890123",
            "product_name": "Coca-Cola 500ml",
            "quantity": 2,
            "unit_price": 12.0,
            "total_amount": 24.0
          }
        ]
      }
    ],
    "export_timestamp": "2025-08-17T15:00:00Z"
  }
}
```

#### Export Inventory Data

```http
GET /api/1c/export/inventory
```

**Description:** Exports current inventory levels from all branches for 1C system.

**Response:**

```json
{
  "success": true,
  "data": {
    "inventory": [
      {
        "branch_code": "BR001",
        "sku": "COCA_500ML",
        "barcode": "1234567890123",
        "product_name": "Coca-Cola 500ml",
        "quantity_in_stock": 150,
        "min_stock_level": 20,
        "last_counted_at": "2025-08-15T10:00:00Z"
      }
    ],
    "export_timestamp": "2025-08-17T15:00:00Z"
  }
}
```

### Synchronization

#### Get Integration Status

```http
GET /api/1c/status
```

**Description:** Returns comprehensive status of 1C integration and system health.

**Response:**

```json
{
  "success": true,
  "data": {
    "integration_status": "connected",
    "last_sync_history": [
      {
        "sync_type": "products",
        "status": "completed",
        "records_processed": 150,
        "started_at": "2025-08-17T10:00:00Z",
        "completed_at": "2025-08-17T10:05:00Z"
      }
    ],
    "active_branches": 5,
    "timestamp": "2025-08-17T12:00:00Z"
  }
}
```

#### Trigger Manual Sync

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

---

## Data Schemas

### Product Schema

| Field             | Type    | Required | Description                      |
| ----------------- | ------- | -------- | -------------------------------- |
| `oneC_id`         | string  | ✅       | Unique identifier from 1C system |
| `sku`             | string  | ✅       | Stock keeping unit (unique)      |
| `barcode`         | string  | ❌       | Product barcode                  |
| `name`            | string  | ✅       | Product name                     |
| `name_ru`         | string  | ❌       | Product name in Russian          |
| `name_uz`         | string  | ❌       | Product name in Uzbek            |
| `description`     | string  | ❌       | Product description              |
| `category_key`    | string  | ❌       | Product category identifier      |
| `brand`           | string  | ❌       | Product brand                    |
| `unit_of_measure` | string  | ❌       | Unit of measure (default: 'pcs') |
| `base_price`      | number  | ✅       | Selling price (positive)         |
| `cost`            | number  | ✅       | Product cost (positive)          |
| `tax_rate`        | number  | ❌       | Tax rate between 0 and 1         |
| `image_url`       | string  | ❌       | Main product image URL           |
| `images`          | array   | ❌       | Additional product images        |
| `attributes`      | object  | ❌       | Custom product attributes (JSON) |
| `is_active`       | boolean | ❌       | Product status (default: true)   |

### Employee Schema

| Field         | Type   | Required | Description                                   |
| ------------- | ------ | -------- | --------------------------------------------- |
| `oneC_id`     | string | ✅       | 1C system identifier                          |
| `employee_id` | string | ✅       | Employee ID                                   |
| `branch_code` | string | ✅       | Branch assignment                             |
| `name`        | string | ✅       | Employee full name                            |
| `role`        | string | ✅       | Employee role (admin, manager, cashier, etc.) |
| `phone`       | string | ❌       | Contact phone number                          |
| `email`       | string | ❌       | Contact email                                 |
| `hire_date`   | string | ❌       | Hire date (ISO 8601)                          |
| `salary`      | number | ❌       | Employee salary                               |
| `status`      | string | ❌       | Employment status (active, inactive)          |

### Inventory Schema

| Field               | Type   | Required | Description                |
| ------------------- | ------ | -------- | -------------------------- |
| `barcode`           | string | ✅\*     | Product barcode identifier |
| `oneC_id`           | string | ✅\*     | 1C system identifier       |
| `sku`               | string | ✅\*     | Stock keeping unit         |
| `branch_code`       | string | ✅       | Branch identifier          |
| `quantity_in_stock` | number | ✅       | Current stock quantity     |
| `min_stock_level`   | number | ❌       | Minimum stock level        |
| `max_stock_level`   | number | ❌       | Maximum stock level        |

\*At least one product identifier required

### Customer Schema

| Field            | Type   | Required | Description                                   |
| ---------------- | ------ | -------- | --------------------------------------------- |
| `oneC_id`        | string | ✅       | 1C system identifier                          |
| `name`           | string | ✅       | Customer full name                            |
| `phone`          | string | ✅       | Contact phone number                          |
| `email`          | string | ❌       | Contact email address                         |
| `birth_date`     | string | ❌       | Birth date (ISO 8601)                         |
| `loyalty_card`   | string | ❌       | Loyalty card number                           |
| `loyalty_tier`   | string | ❌       | Loyalty tier (bronze, silver, gold, platinum) |
| `loyalty_points` | number | ❌       | Current loyalty points                        |
| `address`        | object | ❌       | Customer address information                  |
| `preferences`    | object | ❌       | Customer preferences (JSON)                   |

### Transaction Schema

| Field                | Type   | Required | Description                                        |
| -------------------- | ------ | -------- | -------------------------------------------------- |
| `transaction_number` | string | ✅       | Unique transaction identifier                      |
| `branch_code`        | string | ✅       | Branch where transaction occurred                  |
| `employee_id`        | string | ✅       | Employee who processed transaction                 |
| `customer_id`        | string | ❌       | Customer identifier (if applicable)                |
| `subtotal`           | number | ✅       | Subtotal before tax and discounts                  |
| `tax_amount`         | number | ❌       | Tax amount (default: 0)                            |
| `discount_amount`    | number | ❌       | Total discount amount (default: 0)                 |
| `total_amount`       | number | ✅       | Final transaction amount                           |
| `payment_method`     | string | ✅       | Payment method (cash, card, mixed)                 |
| `status`             | string | ✅       | Transaction status (pending, completed, cancelled) |
| `completed_at`       | string | ❌       | Transaction completion time (ISO 8601)             |
| `items`              | array  | ✅       | Array of transaction line items                    |

### Payment Schema

| Field                   | Type   | Required | Description                                          |
| ----------------------- | ------ | -------- | ---------------------------------------------------- |
| `transaction_id`        | number | ✅       | Associated transaction ID                            |
| `payment_method`        | string | ✅       | Payment method (cash, card, digital)                 |
| `amount`                | number | ✅       | Payment amount                                       |
| `status`                | string | ✅       | Payment status (pending, confirmed, failed)          |
| `processed_at`          | string | ✅       | Payment processing time (ISO 8601)                   |
| `payment_details`       | object | ❌       | Method-specific payment details                      |
| `reconciliation_status` | string | ❌       | Reconciliation status (matched, unmatched, disputed) |

### Validation Rules

**Product Validation:**

- `oneC_id` must be unique across all products
- `sku` must be unique across all products
- `barcode` must be unique if provided
- `base_price` and `cost` must be positive numbers
- `tax_rate` must be between 0 and 1
- URLs must be valid format
- `attributes` must be valid JSON object

**Employee Validation:**

- `role` must be one of: admin, manager, supervisor, cashier, inventory_manager
- `email` must be valid email format if provided
- `hire_date` must be valid ISO 8601 date
- `salary` must be positive number if provided

**Inventory Validation:**

- At least one product identifier (barcode, oneC_id, or sku) required
- `quantity_in_stock` must be non-negative number
- Stock levels must be non-negative numbers
- `branch_code` must reference existing branch

**Customer Validation:**

- `oneC_id` must be unique across all customers
- `phone` must be valid phone number format
- `email` must be valid email format if provided
- `birth_date` must be valid ISO 8601 date if provided
- `loyalty_tier` must be one of: bronze, silver, gold, platinum
- `loyalty_points` must be non-negative number
- `address` must be valid JSON object if provided

**Transaction Validation:**

- `transaction_number` must be unique across system
- `branch_code` must reference existing branch
- `employee_id` must reference existing employee
- `customer_id` must reference existing customer if provided
- All amount fields must be non-negative numbers
- `total_amount` must equal subtotal + tax_amount - discount_amount
- `payment_method` must be one of: cash, card, digital, mixed
- `status` must be one of: pending, completed, cancelled, refunded
- `completed_at` must be valid ISO 8601 datetime
- `items` array must contain at least one item

**Payment Validation:**

- `transaction_id` must reference existing transaction
- `payment_method` must be one of: cash, card, digital_wallet, bank_transfer
- `amount` must be positive number
- `status` must be one of: pending, confirmed, failed, disputed
- `processed_at` must be valid ISO 8601 datetime
- `reconciliation_status` must be one of: matched, unmatched, disputed if provided
- Payment amount cannot exceed transaction total
- `branch_code` must reference existing branch

---

## Rate Limiting

API endpoints have different rate limits based on operation complexity:

| Endpoint Category        | Rate Limit          | Notes                                 |
| ------------------------ | ------------------- | ------------------------------------- |
| **Products API**         | 100 requests/minute | Standard CRUD operations              |
| **Customers API**        | 150 requests/minute | Customer management operations        |
| **Transactions API**     | 200 requests/minute | High-frequency transaction data       |
| **Payments API**         | 300 requests/minute | Payment processing and reconciliation |
| **Bulk Operations**      | 20 requests/minute  | POST/PUT with multiple items          |
| **Inventory Updates**    | 200 requests/minute | High-frequency updates supported      |
| **Export Operations**    | 20 requests/minute  | Large data exports                    |
| **Sync Operations**      | 10 requests/minute  | Resource-intensive operations         |
| **Status/Health Checks** | 500 requests/minute | Monitoring endpoints                  |

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1693728000
```

**Rate Limit Exceeded Response:**

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "reset_time": "2025-08-23T16:00:00Z"
  }
}
```

---

## API Status & Support

**Current API Status:**

- ✅ **Version:** 2.0 (Production Ready)
- ✅ **Test Coverage:** 100% (Products Module)
- ✅ **Uptime:** 99.9% availability target
- ✅ **Performance:** <200ms average response time
- ✅ **Security:** Enterprise-grade authentication & validation

**Support Channels:**

- **Technical Documentation:** Complete API reference
- **Issue Tracking:** GitHub repository for bug reports
- **Emergency Support:** 24/7 availability for production issues
- **Feature Requests:** Product team coordination

**Last Updated:** August 23, 2025  
**Next Review:** September 15, 2025
