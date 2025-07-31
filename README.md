# RockPoint - Branch Management Platform

A comprehensive platform for managing business branches including **supermarkets, gyms, and children's play centers**. This system provides complete POS functionality with offline-first capabilities and centralized management.

## 🧠 Overview

RockPoint is designed as a distributed system where each business branch operates independently with its own local infrastructure while maintaining synchronization with a central cloud service for enterprise-wide management.

### Architecture

- **Branch-level**: Each location runs a local Node.js server with PostgreSQL database
- **POS Terminals**: Multiple React-based point-of-sale interfaces per branch
- **Cloud Sync**: Daily synchronization with central management platform
- **Offline-First**: Full functionality without internet connectivity

## 🏗️ Project Structure

```
rockpoint/
├── README.md                    # Project overview and setup
├── .gitattributes              # Git file handling configuration
├── .gitignore                  # Git ignore patterns
├── pos-manager/                # Frontend POS application (React + TypeScript)
│   ├── src/                    # React source code
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Main application pages
│   │   │   ├── CheckoutPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── theme/              # Material-UI theme configuration
│   │   └── App.tsx             # Main application component
│   ├── electron.ts             # Electron desktop wrapper
│   ├── vite.config.ts          # Vite build configuration
│   ├── package.json            # Frontend dependencies
│   └── README.md               # Frontend setup instructions
└── branch-core/                # Backend server (Node.js + Express + PostgreSQL)
    ├── src/                    # TypeScript source code
    │   ├── api/                # REST API endpoints
    │   │   ├── auth.ts         # Authentication & JWT
    │   │   ├── products.ts     # Product management
    │   │   ├── transactions.ts # Transaction processing
    │   │   ├── employees.ts    # Employee management
    │   │   ├── reports.ts      # Sales & inventory reports
    │   │   └── sync.ts         # Cloud synchronization
    │   ├── database/           # Database layer
    │   │   ├── manager.ts      # PostgreSQL connection pool
    │   │   ├── schema.sql      # Complete database schema
    │   │   ├── migrate.ts      # Migration runner
    │   │   ├── seed.ts         # Sample data seeding
    │   │   └── reset.ts        # Database reset utility
    │   ├── middleware/         # Express middleware
    │   │   ├── errorHandler.ts # Global error handling
    │   │   └── logger.ts       # Request/response logging
    │   ├── services/           # Business logic services
    │   │   ├── redis.ts        # Redis cache & sessions
    │   │   └── websocket.ts    # Real-time WebSocket server
    │   ├── types/              # TypeScript type definitions
    │   │   └── index.ts        # All application types
    │   └── server.ts           # Main server entry point
    ├── .env.example            # Environment configuration template
    ├── package.json            # Backend dependencies
    ├── tsconfig.json           # TypeScript configuration
    ├── SETUP.md                # Detailed setup instructions
    └── README.md               # Backend documentation
```

## 🛠️ Tech Stack

### Frontend (pos-manager)

| Component    | Technology             |
| ------------ | ---------------------- |
| UI Framework | React 19 + TypeScript  |
| Build Tool   | Vite                   |
| UI Library   | Material-UI (MUI)      |
| Routing      | React Router           |
| Desktop App  | Electron (future)      |
| Styling      | Emotion + Tailwind CSS |

### Backend (branch-core) - ✅ **IMPLEMENTED**

| Component       | Technology           |
| --------------- | -------------------- |
| Runtime         | Node.js + TypeScript |
| Framework       | Express.js           |
| Database        | PostgreSQL           |
| Connection Pool | node-pg (PostgreSQL) |
| Real-time       | WebSocket (ws)       |
| Authentication  | JWT + bcrypt         |
| Caching         | Redis                |
| Validation      | Zod schemas          |
| Error Handling  | Custom middleware    |

### Infrastructure

| Component        | Technology         |
| ---------------- | ------------------ |
| Containerization | Docker             |
| Process Manager  | PM2                |
| Reverse Proxy    | Nginx              |
| Cloud Platform   | AWS / DigitalOcean |

## 🎯 Features

### ✅ Implemented (pos-manager)

- ✅ Material-UI based responsive interface
- ✅ Multi-page routing (Login, Dashboard, Checkout)
- ✅ TypeScript for type safety
- ✅ Electron integration ready
- ✅ Modern React 19 with hooks
- ✅ Vite for fast development and building
- ✅ Tailwind CSS integration

### ✅ Implemented (branch-core)

- ✅ **Complete REST API** with all endpoints
- ✅ **JWT Authentication** with bcrypt password hashing
- ✅ **PostgreSQL Database** with connection pooling
- ✅ **WebSocket Server** for real-time POS communication
- ✅ **Product Management** - search, barcode lookup, inventory
- ✅ **Transaction Processing** - create, payment, void operations
- ✅ **Employee Management** - authentication, time tracking
- ✅ **Sales Reporting** - daily, period, top-selling products
- ✅ **Inventory Reports** - stock status, low stock alerts
- ✅ **Redis Caching** - sessions and performance optimization
- ✅ **Database Migrations** - automated schema management
- ✅ **Sample Data Seeding** - test accounts and products
- ✅ **Error Handling** - comprehensive error middleware
- ✅ **Request Logging** - structured logging with timestamps
- ✅ **Type Safety** - complete TypeScript type definitions
- ✅ **Cloud Sync Framework** - ready for cloud integration

### 🔄 In Progress

- 🔄 Frontend-Backend Integration
- 🔄 Barcode scanning components
- 🔄 Receipt printing functionality
- 🔄 Real-time inventory updates via WebSocket

### Future Enhancements

- 📋 Multi-branch dashboard
- 📋 Cloud-based reporting
- 📋 Mobile manager app
- 📋 Customer loyalty programs
- 📋 Integration with local payment systems (PayMe, Click, UzCard)
- 📋 Hardware integration (cash drawers, receipt printers)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (optional but recommended)
- Git

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/Doston1/rockpoint.git
   cd rockpoint
   ```

2. **Set up Branch Core (Backend) First**

   ```bash
   cd branch-core
   npm install

   # Copy environment file and configure
   cp .env.example .env
   # Edit .env with your database credentials

   # Create PostgreSQL database
   createdb rockpoint_branch

   # Run database migrations
   npm run db:migrate

   # Seed with sample data (optional)
   npm run db:seed

   # Start development server
   npm run dev
   ```

   The server will be available at `http://localhost:3000`

3. **Set up POS Manager (Frontend)**

   ```bash
   cd ../pos-manager
   npm install
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

### 🔑 Test Login Credentials

After running `npm run db:seed`, you can use these test accounts:

- **Admin**: `EMP001` / PIN: `1234`
- **Manager**: `EMP002` / PIN: `5678`
- **Cashier**: `EMP003` / PIN: `9999`
- **Cashier**: `EMP004` / PIN: `9999`

### Development Workflow

```bash
# Start backend development server
cd branch-core && npm run dev

# Start frontend development server
cd pos-manager && npm run dev

# Reset database (if needed)
cd branch-core && npm run db:reset

# Run TypeScript compilation check
cd branch-core && npm run build
```

### API Endpoints

The backend provides comprehensive REST API endpoints:

- **Authentication**: `/api/auth/*` - Login, logout, token refresh
- **Products**: `/api/products/*` - Product management and search
- **Transactions**: `/api/transactions/*` - Sales processing and history
- **Employees**: `/api/employees/*` - Staff management
- **Reports**: `/api/reports/*` - Sales analytics and reporting
- **Sync**: `/api/sync/*` - Data synchronization with central system

WebSocket server available at `ws://localhost:3001` for real-time updates.
cd branch-core && npm run dev

# Run Electron desktop app

cd pos-manager && npm run electron

# Build for production

cd pos-manager && npm run build

````

## 🏪 Business Use Cases

### Supermarkets

- Product scanning and inventory tracking
- Customer checkout with multiple payment options
- Employee shift management
- Daily sales reporting

### Gyms

- Membership management
- Access control and check-ins
- Personal trainer scheduling
- Equipment maintenance tracking

### Children's Play Centers

- Entry ticket sales
- Birthday party bookings
- Food & beverage orders
- Safety and capacity monitoring

## 🔧 Configuration

### Environment Variables (branch-core)

Create a `.env` file in the `branch-core` directory:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/rockpoint_branch
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rockpoint_branch
DB_USER=your_username
DB_PASSWORD=your_password

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
PORT=3000
WEBSOCKET_PORT=3001
NODE_ENV=development

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# Branch Configuration
BRANCH_ID=BRANCH001
BRANCH_NAME=Main Branch
TIMEZONE=Asia/Tashkent
````

# API Settings

PORT=3000
JWT_SECRET=your-secret-key

# Cloud Sync

CLOUD_API_URL=https://api.rockpoint-cloud.com
SYNC_INTERVAL=24h
BRANCH_ID=branch-001

````

### Local Network Setup

Each POS terminal should be configured to connect to the branch server:

```env
# pos-manager/.env.local
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
VITE_BRANCH_ID=BRANCH001
````

For production deployment on local network:

```env
# pos-manager/.env.production
VITE_API_BASE_URL=http://192.168.1.100:3000
VITE_WS_URL=ws://192.168.1.100:3001
VITE_BRANCH_ID=BRANCH001
```

### Database Schema

The PostgreSQL database includes the following main tables:

- `employees` - Staff management with role-based access
- `products` - Product catalog with pricing and inventory
- `transactions` - Sales records with detailed line items
- `transaction_items` - Individual items within transactions
- `reports` - Generated sales and inventory reports
- `sync_logs` - Cloud synchronization tracking

Run migrations to set up the schema:

```bash
cd branch-core
npm run db:migrate
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Write unit tests for business logic
- Use conventional commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions and support:

- Create an issue in this repository
- Contact the development team

## 📋 Roadmap

### Phase 1: Foundation (Current)

- [x] Frontend POS interface setup
- [x] Basic routing and UI components
- [ ] Backend server architecture
- [ ] Database schema design

### Phase 2: Core Features

- [ ] Product management system
- [ ] Basic POS functionality
- [ ] User authentication
- [ ] Local data persistence

### Phase 3: Advanced Features

- [ ] Real-time synchronization
- [ ] Advanced reporting
- [ ] Hardware integration
- [ ] Mobile applications

### Phase 4: Enterprise

- [ ] Multi-tenant cloud platform
- [ ] Advanced analytics
- [ ] API marketplace
- [ ] Third-party integrations

---

**Built with ❤️ for modern retail and service businesses**
