# Branch Core Server

The backend server for Zentra branch management system. Built with Node.js, TypeScript, Express, WebSocket, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Git

### Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment Setup**

   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit the .env file with your database credentials
   nano .env
   ```

3. **Database Setup**

   ```bash
   # Create database (if not exists)
   createdb zentra_branch

   # Run migrations
   npm run db:migrate
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000` with WebSocket support on the same port at `/ws`.

## 🛠️ Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database (drop and recreate)

## 🏗️ Project Structure

```
src/
├── api/                    # REST API routes
│   ├── auth.ts            # Authentication endpoints
│   ├── products.ts        # Product management
│   ├── transactions.ts    # Transaction processing
│   ├── employees.ts       # Employee management
│   ├── reports.ts         # Reporting endpoints
│   └── sync.ts            # Cloud synchronization
├── database/              # Database layer
│   ├── manager.ts         # Database connection manager
│   ├── schema.sql         # Database schema
│   └── migrate.ts         # Migration runner
├── middleware/            # Express middleware
│   ├── errorHandler.ts    # Global error handling
│   └── logger.ts          # Request/response logging
├── services/              # Business logic services
│   ├── redis.ts           # Redis cache manager
│   └── websocket.ts       # WebSocket server
├── types/                 # TypeScript type definitions
└── server.ts              # Main server entry point
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/login` - Employee login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/verify` - Verify token
- `POST /api/auth/change-pin` - Change employee PIN

### Products

- `GET /api/products/search` - Search products
- `GET /api/products/barcode/:barcode` - Get product by barcode
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/categories` - List categories
- `GET /api/products/low-stock` - Low stock products

### Transactions

- `POST /api/transactions` - Create new transaction
- `POST /api/transactions/:id/payment` - Process payment
- `GET /api/transactions/:id` - Get transaction details
- `POST /api/transactions/:id/void` - Void transaction

### Employees

- `GET /api/employees` - List employees
- `POST /api/employees/:id/clock-in` - Clock in employee
- `POST /api/employees/:id/clock-out` - Clock out employee

### Reports

- `GET /api/reports/sales/daily` - Daily sales report
- `GET /api/reports/sales/period` - Period sales report
- `GET /api/reports/products/top-selling` - Top selling products
- `GET /api/reports/inventory/status` - Inventory status

### Sync

- `GET /api/sync/status` - Sync status
- `POST /api/sync/manual` - Manual sync trigger

## 🔄 WebSocket Events

### Client to Server

- `register_terminal` - Register POS terminal
- `user_login` - User authentication
- `transaction_update` - Transaction status update
- `price_request` - Product price lookup
- `inventory_update` - Inventory change
- `ping` - Heartbeat

### Server to Client

- `connection_ack` - Connection acknowledgment
- `price_response` - Product price response
- `inventory_changed` - Inventory update broadcast
- `transaction_update` - Transaction status broadcast
- `pong` - Heartbeat response

## 💾 Database Schema

### Core Tables

- `employees` - Staff members and authentication
- `products` - Product catalog and inventory
- `transactions` - Sales transactions
- `transaction_items` - Transaction line items
- `payments` - Payment records
- `customers` - Customer information (optional)
- `stock_movements` - Inventory change log
- `employee_time_logs` - Time tracking
- `sync_logs` - Cloud synchronization history

## 🔧 Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
WS_PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/zentra_branch
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zentra_branch
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Branch Info
BRANCH_ID=branch-001
BRANCH_NAME=Main Store
BRANCH_TYPE=supermarket

# Cloud Sync
CLOUD_API_URL=https://api.zentra-cloud.com
SYNC_INTERVAL=24h
SYNC_ENABLED=true
```

## 🏪 Business Logic

### Transaction Flow

1. Employee logs in at POS terminal
2. Products are scanned/searched and added to cart
3. Transaction is created with pending status
4. Payment is processed
5. Transaction status changes to completed
6. Inventory is automatically updated
7. Receipt data is available for printing

### Inventory Management

- Real-time stock updates
- Low stock alerts
- Automatic reorder points
- Stock movement logging
- Barcode scanning support

### Employee Management

- Role-based access control (admin, manager, cashier)
- Time clock functionality
- PIN-based authentication
- Session management via Redis

### Offline Operation

- Local PostgreSQL database for full offline capability
- Redis caching for performance
- Periodic cloud synchronization
- Conflict resolution for data sync

## 🔒 Security Features

- JWT-based authentication
- Bcrypt password hashing
- Role-based authorization
- Request rate limiting
- Input validation with Zod
- SQL injection prevention
- CORS protection

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## 📊 Monitoring & Logging

- Structured logging with different levels
- Request/response logging
- Database query logging
- WebSocket connection tracking
- Error tracking and reporting
- Performance metrics

## 🚀 Deployment

### Development

```bash
npm run dev
```

### Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker (Future)

```bash
docker build -t zentra-branch-core .
docker run -p 3000:3000 zentra-branch-core
```

## 🔄 Cloud Synchronization

The system periodically synchronizes with the central cloud service:

- **Full Sync**: Complete data synchronization
- **Incremental Sync**: Only changed records
- **Transaction Sync**: Sales data only
- **Conflict Resolution**: Automatic conflict handling
- **Retry Logic**: Failed sync retry mechanism

## 📞 Support

For technical support or questions:

1. Check the logs in development mode
2. Verify database connections
3. Check Redis connectivity
4. Review environment configuration
5. Contact the development team

## 🔮 Future Enhancements

- Hardware integration (barcode scanners, receipt printers)
- Payment gateway integrations
- Advanced reporting and analytics
- Mobile app support
- Multi-language support
- Advanced inventory forecasting

---

**Part of the Zentra Branch Management Platform**
