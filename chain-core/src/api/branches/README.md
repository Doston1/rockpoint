# Branch-to-Chain-Core API Documentation

This API provides endpoints for branches to communicate with the chain-core server. All endpoints require authentication via the `api_key` from the `branch_servers` table.

## Authentication

All requests must include the API key in the Authorization header:

```
Authorization: Bearer <api_key>
```

The API key authenticates the branch server and identifies which branch is making the request.

## Base URL

All endpoints are prefixed with `/api/branch-api/`

## Endpoints

### 1. Transactions API (`/api/branch-api/transactions`)

#### POST `/api/branch-api/transactions`

Submit a single transaction from branch to chain-core.

**Request Body:**

```typescript
{
  transaction_number: string,
  terminal_id?: string,
  employee_id: string,
  customer_id?: string,
  customer_phone?: string,
  customer_loyalty_card?: string,
  transaction_date: string,
  subtotal: number,
  tax_amount: number,
  discount_amount: number,
  total_amount: number,
  status: 'completed' | 'cancelled' | 'refunded' | 'pending',
  items: [
    {
      product_id?: string,
      product_barcode?: string,
      product_name: string,
      quantity: number,
      unit_price: number,
      discount_amount: number,
      tax_amount: number,
      total_price: number,
      metadata?: object
    }
  ],
  payments: [
    {
      method: 'cash' | 'card' | 'digital_wallet' | 'fastpay' | 'credit' | 'loyalty_points',
      amount: number,
      currency: string,
      card_type?: string,
      card_last_four?: string,
      reference_number?: string,
      fastpay_transaction_id?: string,
      status: 'completed' | 'pending' | 'failed',
      metadata?: object
    }
  ],
  notes?: string,
  receipt_printed: boolean,
  metadata?: object
}
```

#### POST `/api/branch-api/transactions/bulk`

Submit multiple transactions at once.

#### PUT `/api/branch-api/transactions/:transactionNumber/status`

Update transaction status (for refunds, cancellations, etc.).

### 2. Employees API (`/api/branch-api/employees`)

#### POST `/api/branch-api/employees`

Create a new employee in the branch.

#### PUT `/api/branch-api/employees/:employeeId`

Update employee information.

#### PUT `/api/branch-api/employees/:employeeId/deactivate`

Deactivate employee (soft delete).

#### GET `/api/branch-api/employees`

Get all employees in the branch.

#### GET `/api/branch-api/employees/:employeeId`

Get specific employee details.

#### POST `/api/branch-api/employees/time-logs`

Submit employee time logs.

### 3. Products API (`/api/branch-api/products`)

#### GET `/api/branch-api/products`

Get products available in chain with pricing and availability info.

#### GET `/api/branch-api/products/:productId`

Get specific product details with branch-specific pricing and stock.

#### GET `/api/branch-api/products/stock/search`

Search for product stock across all branches.

#### GET `/api/branch-api/products/pricing/updates`

Get recent pricing updates for products.

#### PUT `/api/branch-api/products/:productId/stock`

Update stock level for a specific product in this branch.

#### GET `/api/branch-api/products/inventory/low-stock`

Get products with low stock levels in this branch.

### 4. Inventory API (`/api/branch-api/inventory`)

#### GET `/api/branch-api/inventory`

Get current inventory status for this branch.

#### GET `/api/branch-api/inventory/:productId`

Get detailed inventory information for a specific product.

#### POST `/api/branch-api/inventory/movements`

Record stock movements for inventory tracking.

#### POST `/api/branch-api/inventory/movements/bulk`

Record multiple stock movements at once.

#### POST `/api/branch-api/inventory/:productId/adjust`

Perform stock adjustment with reason tracking.

#### GET `/api/branch-api/inventory/movements`

Get stock movement history.

### 5. Sync API (`/api/branch-api/sync`)

#### POST `/api/branch-api/sync/health`

Report branch health status to chain-core.

#### GET `/api/branch-api/sync/status`

Get branch sync status and recent sync logs.

#### GET `/api/branch-api/sync/logs/:syncId`

Get detailed information about a specific sync operation.

#### POST `/api/branch-api/sync/request`

Request data sync from chain-core.

#### GET `/api/branch-api/sync/updates/:dataType`

Get incremental updates for specific data types.

#### POST `/api/branch-api/sync/ping`

Simple ping endpoint for connectivity testing.

## Response Format

All responses follow this format:

```typescript
{
  success: boolean,
  data?: any,
  error?: string,
  code?: string
}
```

## Error Handling

- `401` - Authentication required or invalid API key
- `403` - Insufficient permissions
- `404` - Resource not found
- `409` - Conflict (e.g., duplicate transaction)
- `400` - Bad request / validation error
- `500` - Internal server error

## Usage Examples

### Submitting a Transaction

```javascript
const response = await fetch("/api/branch-api/transactions", {
  method: "POST",
  headers: {
    Authorization: "Bearer your-branch-api-key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    transaction_number: "TXN-2025-001",
    employee_id: "EMP001",
    transaction_date: "2025-01-24T10:30:00Z",
    subtotal: 95.0,
    tax_amount: 5.0,
    total_amount: 100.0,
    items: [
      {
        product_name: "Product A",
        quantity: 2,
        unit_price: 47.5,
        total_price: 95.0,
      },
    ],
    payments: [
      {
        method: "cash",
        amount: 100.0,
        currency: "USD",
        status: "completed",
      },
    ],
    status: "completed",
  }),
});
```

### Checking Product Stock Across Branches

```javascript
const response = await fetch(
  "/api/branch-api/products/stock/search?barcode=123456789",
  {
    headers: {
      Authorization: "Bearer your-branch-api-key",
    },
  }
);
```

### Reporting Health Status

```javascript
const response = await fetch("/api/branch-api/sync/health", {
  method: "POST",
  headers: {
    Authorization: "Bearer your-branch-api-key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    server_info: {
      version: "1.0.0",
      uptime: 3600000,
      memory_usage: { used: 512, total: 1024 },
    },
    database_status: {
      connected: true,
      last_query_time: 50,
    },
  }),
});
```

## Integration Notes

1. **Authentication**: Each branch server has a unique API key stored in the `branch_servers` table.

2. **Transaction Sync**: Transactions are automatically synced to chain-core when submitted through the API.

3. **Inventory Updates**: Stock levels are updated in real-time when transactions are processed.

4. **Error Handling**: Failed operations return detailed error information to help with debugging.

5. **Rate Limiting**: Consider implementing rate limiting for production deployments.

6. **Monitoring**: Use the health and sync endpoints to monitor branch connectivity and data synchronization.
