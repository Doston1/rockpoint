# RockPoint Chain Core

Main office server for RockPoint chain management system. This server manages multiple branches, integrates with 1C accounting system, and provides centralized control for the entire retail chain.

## Features

- **Branch Management**: Monitor and manage multiple retail branches
- **1C Integration**: Full API integration with 1C accounting system
- **Employee Management**: Chain-wide employee management and time tracking
- **Inventory Control**: Centralized inventory management across all branches
- **Reporting & Analytics**: Comprehensive reporting and business intelligence
- **Real-time Sync**: WebSocket-based real-time synchronization with branches
- **User Management**: Role-based access control for main office staff

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL 14+
- **Cache**: Redis
- **Real-time**: WebSocket
- **Integration**: 1C API (REST/SOAP)
- **Authentication**: JWT + bcrypt

## Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/verify` - Verify token

### Branch Management

- `GET /api/branches` - Get all branches
- `POST /api/branches` - Create branch
- `PUT /api/branches/:id` - Update branch
- `DELETE /api/branches/:id` - Delete branch

### Employee Management

- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `GET /api/employees/time-logs` - Get time logs

### Products & Inventory

- `GET /api/products` - Get all products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/branch/:branchId` - Get inventory for specific branch
- `PUT /api/inventory/branch/:branchId/product/:productId` - Update inventory for specific branch and product
- `GET /api/inventory/stock-levels` - Get stock levels

### Promotions

- `GET /api/promotions` - Get all promotions
- `GET /api/promotions/branch/:branchId` - Get promotions for specific branch
- `POST /api/promotions/branch/:branchId` - Create promotion for specific branch
- `PUT /api/promotions/:id` - Update promotion
- `DELETE /api/promotions/:id` - Delete promotion

### 1C Integration

- `POST /api/1c/sync/products` - Manual sync products from 1C
- `POST /api/1c/sync/employees` - Manual sync employees from 1C
- `GET /api/1c/status` - Get 1C connection status
- **Note**: All 1C synchronization is manual/API-driven, no automatic background sync

### Reports

- `GET /api/reports/sales` - Sales reports
- `GET /api/reports/inventory` - Inventory reports
- `GET /api/reports/employees` - Employee reports

## Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=24h

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rockpoint_chain
DB_USER=postgres
DB_PASSWORD=password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 1C Integration
1C_API_URL=http://your-1c-server/api
1C_USERNAME=1c-user
1C_PASSWORD=1c-password
1C_SYNC_INTERVAL=300000

# WebSocket Configuration
WS_PATH=/ws
WS_PORT=3002
```

## License

MIT
