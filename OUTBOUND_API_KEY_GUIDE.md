# Outbound API Key Configuration Guide

This guide explains how to configure and use outbound API keys for chain-core to communicate with branch servers.

## Overview

The RockPoint system now supports bidirectional API authentication:

1. **Inbound Authentication**: Branches authenticate to chain-core using their API keys
2. **Outbound Authentication**: Chain-core authenticates to branches using outbound API keys

## Configuration Steps

### 1. Configure Branch Server with Outbound API Key

1. Open Network Management in chain-manager
2. Go to "Branch Servers" tab
3. Edit an existing branch server or add a new one
4. Fill in the **"Chain-Core Outbound API Key"** field
5. This is the API key that chain-core will use when making requests to this branch

### 2. Configure Branch-Core to Accept Outbound API Keys

Each branch-core server needs to be configured to accept and validate the outbound API keys from chain-core.

**In branch-core, update the API key validation to accept chain-core keys:**

```typescript
// In branch-core middleware/auth.ts
export const authenticateChainCoreApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extract API key from request
  const apiKey = extractApiKeyFromRequest(req);

  // Validate against configured chain-core API key
  if (apiKey === process.env.CHAIN_CORE_API_KEY) {
    req.apiKey = {
      id: "chain-core",
      name: "Chain Core System",
      permissions: ["*"], // Full permissions for chain-core
    };
    next();
  } else {
    return res.status(401).json({
      success: false,
      error: "Invalid chain-core API key",
    });
  }
};
```

### 3. Environment Variables for Branch-Core

Add to each branch-core's `.env` file:

```env
# API key that chain-core will use to authenticate to this branch
CHAIN_CORE_API_KEY=rp_your_outbound_api_key_here
```

## Usage Examples

### 1. Test All Branch Connections

Use the "Test All Connections" button in the Network Management page to verify that:

- All branches are reachable
- Outbound API keys are properly configured
- Authentication is working

### 2. Sync Products to Branches

```bash
POST /api/sync/products
{
  "branch_ids": ["branch-1", "branch-2"], // Optional: specific branches
  "products": [
    {
      "sku": "PROD001",
      "barcode": "1234567890",
      "name": "Product Name",
      "price": 29.99,
      "cost": 15.00,
      "category_key": "electronics",
      "is_active": true
    }
  ]
}
```

### 3. Sync Employees to Branches

```bash
POST /api/sync/employees
{
  "employees": [
    {
      "employee_id": "EMP001",
      "name": "John Doe",
      "role": "cashier",
      "status": "active"
    }
  ]
}
```

### 4. Update Inventory Across Branches

```bash
POST /api/sync/inventory
{
  "updates": [
    {
      "barcode": "1234567890",
      "quantity_adjustment": 50,
      "adjustment_type": "add",
      "reason": "New stock received"
    }
  ]
}
```

## Security Considerations

1. **Unique Keys per Branch**: Each branch should have its own unique outbound API key
2. **Key Rotation**: Regularly rotate outbound API keys for security
3. **Environment Variables**: Store API keys in environment variables, not in code
4. **HTTPS**: Use HTTPS in production for encrypted communication
5. **IP Restrictions**: Consider restricting API access by IP address

## Monitoring

### Connection Health Logs

The system logs all connection attempts in the `connection_health_logs` table:

```sql
SELECT
  source_type,
  target_id as branch_id,
  connection_status,
  response_time_ms,
  error_message,
  checked_at
FROM connection_health_logs
WHERE source_type = 'chain_core'
ORDER BY checked_at DESC;
```

### API Usage Tracking

Track outbound API usage to monitor:

- Request frequency
- Success/failure rates
- Response times
- Authentication failures

## Troubleshooting

### Common Issues

1. **Authentication Failed (401)**

   - Check if outbound API key is correctly configured in Network Management
   - Verify the API key matches the one configured in branch-core environment

2. **Connection Timeout**

   - Verify network connectivity between chain-core and branch
   - Check if branch server is running and accessible
   - Ensure correct IP address and port configuration

3. **Branch Offline**
   - Use "Test Connection" button to diagnose issues
   - Check branch server status in Network Management
   - Verify branch-core service is running

### Debug API Calls

Enable debug logging in chain-core:

```env
# In chain-core .env
LOG_LEVEL=debug
DEBUG_API_CALLS=true
```

This will log all outbound API requests and responses for troubleshooting.

## API Reference

### Outbound API Service Methods

```typescript
// Test connection to a branch
BranchApiService.testConnection(branchId: string): Promise<BranchApiResponse>

// Sync data to a branch
BranchApiService.syncToBranch(branchId: string, syncType: string, data: any): Promise<BranchApiResponse>

// Get branch status
BranchApiService.getBranchStatus(branchId: string): Promise<BranchApiResponse>

// Make custom request
BranchApiService.makeRequest(request: BranchApiRequest): Promise<BranchApiResponse>
```

### Response Format

```typescript
interface BranchApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  status: number;
  branchId: string;
}
```
