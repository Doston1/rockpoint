# Branch-Core API for Chain-Core Integration

This API enables chain-core to communicate with individual branch-core systems for inventory management, data synchronization, and operational control.

## Base URL

```
http://branch-server:3000/api/chain-core
```

## Authentication

Include appropriate authentication headers (JWT, API key, etc.)

## 📋 Inventory Management

### Get Current Inventory Levels

```http
GET /inventory?sku=PHONE-001&category=electronics&low_stock_only=true&page=1&limit=100
```

**Response:**

```json
{
  "success": true,
  "data": {
    "inventory": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "sku": "PHONE-001",
        "name": "iPhone 15 Pro",
        "name_ru": "Айфон 15 Про",
        "quantity_in_stock": 25,
        "min_stock_level": 5,
        "max_stock_level": 100,
        "last_updated": "2024-08-02T14:30:00Z",
        "current_price": 999.99,
        "cost": 800.0,
        "category_name": "Electronics",
        "is_low_stock": false
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

### Update Inventory Levels

```http
PUT /inventory
Content-Type: application/json

{
  "updates": [
    {
      "sku": "PHONE-001",
      "quantity_adjustment": 10,
      "adjustment_type": "add",
      "reason": "Stock replenishment",
      "reference_id": "PO-2024-001"
    },
    {
      "product_id": "uuid-456",
      "quantity_adjustment": 50,
      "adjustment_type": "set",
      "reason": "Inventory correction"
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
        "product_id": "uuid",
        "sku": "PHONE-001",
        "old_quantity": 25,
        "new_quantity": 35,
        "adjustment": 10
      }
    ],
    "updated": 1,
    "failed": 0
  }
}
```

**Adjustment Types:**

- `add` - Add to current quantity
- `subtract` - Subtract from current quantity
- `set` - Set exact quantity

## 📦 Product Management

### Get Products with Stock Information

```http
GET /products?category=electronics&active_only=true&page=1&limit=100
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
        "name_uz": "iPhone 15 Pro",
        "description": "Latest iPhone model",
        "price": 999.99,
        "cost": 800.0,
        "barcode": "1234567890",
        "unit_of_measure": "pcs",
        "tax_rate": 0.1,
        "is_active": true,
        "category_name": "Electronics",
        "category_key": "electronics",
        "quantity_in_stock": 25,
        "min_stock_level": 5,
        "max_stock_level": 100,
        "inventory_updated": "2024-08-02T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 150
    }
  }
}
```

### Update Product Prices

```http
PUT /products/prices
Content-Type: application/json

{
  "updates": [
    {
      "sku": "PHONE-001",
      "price": 1099.99,
      "cost": 850.00,
      "effective_date": "2024-08-03T00:00:00Z"
    },
    {
      "product_id": "uuid-456",
      "price": 599.99
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
        "product_id": "uuid",
        "sku": "PHONE-001",
        "old_price": 999.99,
        "new_price": 1099.99,
        "old_cost": 800.0,
        "new_cost": 850.0
      }
    ],
    "updated": 1,
    "failed": 0
  }
}
```

### Sync Products from Chain-Core

```http
POST /products/sync
Content-Type: application/json

{
  "products": [
    {
      "sku": "PHONE-002",
      "name": "Samsung Galaxy S24",
      "name_ru": "Самсунг Галакси С24",
      "name_uz": "Samsung Galaxy S24",
      "description": "Latest Samsung flagship",
      "category_id": "electronics-cat-id",
      "brand": "Samsung",
      "price": 899.99,
      "cost": 720.00,
      "barcode": "9876543210",
      "unit_of_measure": "pcs",
      "tax_rate": 0.1,
      "is_active": true
    }
  ]
}
```

## 👥 Employee Data

### Get Employees Information

```http
GET /employees?status=active&role=cashier&page=1&limit=50
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
        "name": "John Doe",
        "role": "cashier",
        "phone": "+1234567890",
        "email": "john@branch.com",
        "hire_date": "2024-01-15",
        "salary": 3000.0,
        "status": "active",
        "created_at": "2024-01-15T09:00:00Z",
        "updated_at": "2024-08-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 12
    }
  }
}
```

## 💰 Transaction Data

### Get Transaction Information

```http
GET /transactions?start_date=2024-08-01&end_date=2024-08-02&status=completed&include_items=true&page=1&limit=100
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
        "employee_id": "uuid",
        "employee_name": "John Doe",
        "subtotal": 999.99,
        "tax_amount": 99.99,
        "total_amount": 1099.98,
        "payment_method": "card",
        "status": "completed",
        "created_at": "2024-08-02T14:30:00Z",
        "completed_at": "2024-08-02T14:35:00Z",
        "items": [
          {
            "transaction_id": "uuid",
            "product_id": "uuid",
            "sku": "PHONE-001",
            "product_name": "iPhone 15 Pro",
            "quantity": 1,
            "unit_price": 999.99,
            "total_amount": 999.99
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 45
    },
    "summary": {
      "total_transactions": 45,
      "total_amount": 25750.5,
      "average_transaction": 572.23
    }
  }
}
```

## 📊 Branch Status

### Get Branch System Status

```http
GET /status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "system_status": "healthy",
    "branch_id": "BRANCH_001",
    "timestamp": "2024-08-02T15:30:00Z",
    "statistics": {
      "active_products": 1250,
      "active_employees": 12,
      "daily_transactions": 45,
      "daily_revenue": 25750.5,
      "low_stock_items": 8,
      "total_inventory_items": 5240.5
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
- `start_date` - Start date filter (ISO format)
- `end_date` - End date filter (ISO format)
- `status` - Filter by status
- `active_only` - Show only active records (default: true)

### Inventory Specific:

- `sku` - Filter by product SKU
- `category` - Filter by category key
- `low_stock_only` - Show only low stock items

### Transaction Specific:

- `employee_id` - Filter by employee
- `include_items` - Include transaction items (default: false)

## Data Formats

### Dates

All dates should be in ISO 8601 format: `2024-08-02T15:30:00Z`

### Numbers

- Prices and monetary values: decimal with 2 decimal places
- Quantities: decimal with 3 decimal places
- Tax rates: decimal between 0 and 1 (0.1 = 10%)

### Product Identification

Products can be identified by either:

- `sku` - Product SKU code
- `product_id` - Internal product UUID

## Inventory Adjustments

### Adjustment Types:

- `add` - Adds quantity to current stock
- `subtract` - Subtracts quantity from current stock
- `set` - Sets stock to exact quantity

### Logging:

All inventory adjustments are automatically logged with:

- Before/after quantities
- Adjustment amount and type
- Reason and reference ID
- Timestamp

## Price History

All price changes are tracked with:

- Old and new prices/costs
- Effective date
- Change timestamp

## Security Considerations

- All endpoints should be authenticated
- Rate limiting recommended
- Input validation is enforced
- Database transactions ensure data consistency
- Audit logging for all changes
