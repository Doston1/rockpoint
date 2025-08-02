# Chain-Core API for 1C Integration

This API allows 1C ERP system to interact with the RockPoint chain-core system. All endpoints use JSON for request/response bodies.

## Base URL

```
http://your-chain-core-server:3001/api/1c-integration
```

## Authentication

Add authentication headers as needed (JWT, API key, etc.)

## 📦 Product Management

### Get All Products

```http
GET /products?page=1&limit=100&category=electronics&active_only=true
```

**Response:**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid",
        "sku": "PHONE-001",
        "name": "iPhone 15 Pro",
        "name_ru": "Айфон 15 Про",
        "base_price": 999.99,
        "cost": 800.0,
        "oneC_id": "1C_PRODUCT_123",
        "category_name": "Electronics"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 150,
      "pages": 2
    }
  }
}
```

### Create New Product

```http
POST /products
Content-Type: application/json

{
  "sku": "PHONE-001",
  "barcode": "1234567890",
  "name": "iPhone 15 Pro",
  "name_ru": "Айфон 15 Про",
  "name_uz": "iPhone 15 Pro",
  "description": "Latest iPhone model",
  "category_key": "electronics",
  "brand": "Apple",
  "unit_of_measure": "pcs",
  "base_price": 999.99,
  "cost": 800.00,
  "tax_rate": 0.1,
  "is_active": true,
  "oneC_id": "1C_PRODUCT_123"
}
```

### Update Product Prices

```http
PUT /products/prices
Content-Type: application/json

[
  {
    "sku": "PHONE-001",
    "base_price": 1099.99,
    "cost": 850.00
  },
  {
    "oneC_id": "1C_PRODUCT_456",
    "base_price": 599.99
  }
]
```

## 📋 Inventory Management

### Get Inventory Levels

```http
GET /inventory?branch_code=BRANCH_001&sku=PHONE-001&low_stock_only=false
```

**Response:**

```json
{
  "success": true,
  "data": {
    "inventory": [
      {
        "id": "uuid",
        "branch_code": "BRANCH_001",
        "branch_name": "Main Store",
        "sku": "PHONE-001",
        "name": "iPhone 15 Pro",
        "quantity_in_stock": 25,
        "min_stock_level": 5,
        "max_stock_level": 100,
        "product_oneC_id": "1C_PRODUCT_123"
      }
    ],
    "total_items": 1
  }
}
```

### Update Inventory Levels

```http
PUT /inventory
Content-Type: application/json

{
  "branch_code": "BRANCH_001",
  "updates": [
    {
      "sku": "PHONE-001",
      "quantity_in_stock": 30,
      "min_stock_level": 5,
      "max_stock_level": 100
    },
    {
      "oneC_id": "1C_PRODUCT_456",
      "quantity_in_stock": 15
    }
  ]
}
```

## 👥 Employee Management

### Get Employees

```http
GET /employees?branch_code=BRANCH_001&status=active
```

**Response:**

```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "uuid",
        "employee_id": "EMP_001",
        "branch_code": "BRANCH_001",
        "name": "John Doe",
        "role": "cashier",
        "status": "active",
        "hire_date": "2024-01-15",
        "salary": 3000.0,
        "oneC_id": "1C_EMP_123"
      }
    ],
    "total_employees": 1
  }
}
```

### Create Employee

```http
POST /employees
Content-Type: application/json

{
  "employee_id": "EMP_002",
  "branch_code": "BRANCH_001",
  "name": "Jane Smith",
  "role": "manager",
  "phone": "+1234567890",
  "email": "jane@example.com",
  "hire_date": "2024-08-01",
  "salary": 4500.00,
  "status": "active",
  "oneC_id": "1C_EMP_456"
}
```

## ⏰ Time Tracking

### Get Working Hours

```http
GET /time-logs?branch_code=BRANCH_001&period=day&employee_id=EMP_001
GET /time-logs?start_date=2024-08-01&end_date=2024-08-31
```

**Response:**

```json
{
  "success": true,
  "data": {
    "time_logs": [
      {
        "id": "uuid",
        "employee_name": "John Doe",
        "employee_id": "EMP_001",
        "branch_code": "BRANCH_001",
        "clock_in": "2024-08-02T09:00:00Z",
        "clock_out": "2024-08-02T17:30:00Z",
        "total_hours": 8.5,
        "overtime_hours": 0.5,
        "status": "completed"
      }
    ],
    "summary": {
      "total_hours": 8.5,
      "overtime_hours": 0.5,
      "total_logs": 1
    },
    "period": "day"
  }
}
```

## 💰 Transaction Reports

### Get Transactions

```http
GET /transactions?branch_code=BRANCH_001&start_date=2024-08-01&end_date=2024-08-02&include_items=true
```

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "transaction_number": "TXN_001",
        "branch_code": "BRANCH_001",
        "employee_name": "John Doe",
        "subtotal": 999.99,
        "tax_amount": 99.99,
        "total_amount": 1099.98,
        "status": "completed",
        "completed_at": "2024-08-02T14:30:00Z",
        "items": [
          {
            "product_name": "iPhone 15 Pro",
            "sku": "PHONE-001",
            "quantity": 1,
            "unit_price": 999.99,
            "total_amount": 999.99
          }
        ]
      }
    ],
    "summary": {
      "total_amount": 1099.98,
      "total_transactions": 1,
      "average_transaction": 1099.98
    }
  }
}
```

## 📊 System Status

### Get System Status

```http
GET /status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "system_status": "healthy",
    "timestamp": "2024-08-02T15:30:00Z",
    "statistics": {
      "active_branches": 5,
      "active_products": 1250,
      "active_employees": 45,
      "daily_transactions": 128,
      "daily_revenue": 15750.25
    }
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "timestamp": "2024-08-02T15:30:00Z"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error

## Query Parameters

### Common Parameters:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 100)
- `branch_code` - Filter by specific branch
- `start_date` - Start date filter (ISO format)
- `end_date` - End date filter (ISO format)
- `status` - Filter by status
- `active_only` - Show only active records (default: true)

## Data Formats

### Dates

All dates should be in ISO 8601 format: `2024-08-02T15:30:00Z`

### Numbers

- Prices and monetary values: decimal with 2 decimal places
- Quantities: decimal with 3 decimal places
- Tax rates: decimal between 0 and 1 (0.1 = 10%)

### Product Identification

Products can be identified by either:

- `sku` - Internal SKU code
- `oneC_id` - 1C system product ID

### Branch Identification

Branches are identified by:

- `branch_code` - Unique branch code (e.g., "BRANCH_001")
