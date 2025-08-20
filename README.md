# RockPoint - Enterprise Retail Chain Management System

A comprehensive distributed retail chain management platform designed for **supermarkets, pharmacies, gyms, and children's play centers**. The system provides complete Point-of-Sale (POS) functionality with real-time synchronization, 1C integration, and centralized management across multiple branches.

## 🏢 System Architecture Overview

RockPoint is designed as a secure, distributed system with a clear separation between main office operations and branch operations. The system ensures data integrity, real-time synchronization, and seamless integration with 1C Enterprise Resource Planning (ERP) system.

### High-Level Architecture

```
1C System (ERP)
       ↓ (API Integration)
   Chain-Core (Main Office Backend)  ←(Secure API Communication)→ Chain-Manager (Main Office Frontend)
       ↓ (Network Management & Sync)
Multiple Branch Networks:
   Branch-Core (Branch Backend) ←→ POS-Manager (Branch Frontend)
```

### Core Components

- **Main Office Side**:

  - `chain-core`: Central backend server with 1C integration
  - `chain-manager`: Web-based management interface for chain operations

- **Branch Side**:
  - `branch-core`: Local branch server with offline capabilities
  - `pos-manager`: Point-of-sale interface for cashiers and managers

### Key Features

- **🔐 Multi-layered Security**: API key authentication between all components
- **🔄 Real-time Synchronization**: WebSocket-based data sync across all branches
- **🏪 Offline-First**: Complete POS functionality without internet connectivity
- **📊 1C Integration**: Seamless integration with 1C accounting system
- **🌐 Multi-language Support**: Uzbek, Russian, and English interfaces
- **📱 Cross-platform**: Desktop and web-based applications

## 🔐 Security & Data Flow Architecture

### Security Model

The RockPoint system implements a **three-tier security architecture** with distinct authentication mechanisms:

#### 1. 1C ↔ Chain-Core Security

- **API Key Authentication**: 1C system uses dedicated API keys (`rp_1C_DEFAULT_KEY_*`)
- **Rate Limiting**: 100-200 requests per minute depending on endpoint type
- **HTTPS Encryption**: All communication encrypted in transit
- **Data Validation**: Comprehensive input validation and sanitization

#### 2. Chain-Core ↔ Branch-Core Security

- **Bidirectional API Keys**:
  - **Inbound**: Branches authenticate to chain-core using branch-specific API keys
  - **Outbound**: Chain-core authenticates to branches using outbound API keys
- **JWT Tokens**: Secure token-based authentication for admin operations
- **IP Restrictions**: Optional IP-based access control
- **Connection Health Monitoring**: Real-time monitoring of all branch connections

#### 3. Branch-Core ↔ POS-Manager Security

- **JWT Authentication**: Role-based access control (admin, manager, cashier, supervisor)
- **Session Management**: Secure session handling with Redis
- **WebSocket Security**: Authenticated real-time communication
- **Local Network Isolation**: Branch operations isolated within local network

### Data Flow Architecture

```
Data Flow Direction: 1C → Chain-Core → Branch-Core → POS-Manager

1. Master Data Sync (1C → Chain-Core):
   ├── Products & Pricing
   ├── Employee Records
   ├── Inventory Adjustments
   └── Accounting Rules

2. Chain Management (Chain-Core → Branch-Core):
   ├── Product Synchronization
   ├── Price Updates
   ├── Employee Management
   ├── Inventory Transfers
   └── Promotional Campaigns

3. Branch Operations (Branch-Core → POS-Manager):
   ├── Real-time Product Lookup
   ├── Transaction Processing
   ├── Inventory Updates
   └── Employee Authentication

4. Reporting Flow (POS-Manager → Branch-Core → Chain-Core → 1C):
   ├── Sales Transactions
   ├── Inventory Consumption
   ├── Employee Time Logs
   └── Daily Reports
```

### Communication Protocols

#### API Endpoints & Authentication

1. **1C Integration API** (`/api/1c/*`):

   ```http
   Authorization: Bearer rp_1C_DEFAULT_KEY_REPLACE_IN_PRODUCTION
   ```

2. **Branch Communication API** (`/api/chain-core/*`):

   ```http
   Authorization: ApiKey rp_branch_specific_api_key
   ```

3. **Internal POS API** (`/api/*`):
   ```http
   Authorization: Bearer jwt_token_here
   ```

#### Real-time Communication

- **WebSocket Connections**: Authenticated WebSocket channels for real-time updates
- **Event Broadcasting**: System-wide event propagation for inventory and price changes
- **Connection Resilience**: Automatic reconnection and offline queue management

## 🏗️ Project Structure & Component Responsibilities

### High-Level Project Structure

```
rockpoint/
├── README.md                           # This comprehensive documentation
├── chain-core/                         # 🏢 Main Office Backend Server
│   ├── src/
│   │   ├── api/                        # REST API endpoints
│   │   │   ├── 1c.ts                   # 1C ERP integration endpoints
│   │   │   ├── branches.ts             # Branch management API
│   │   │   ├── employees.ts            # Chain-wide employee management
│   │   │   ├── inventory.ts            # Central inventory control
│   │   │   ├── products.ts             # Product catalog management
│   │   │   ├── promotions.ts           # Promotional campaign management
│   │   │   ├── reports.ts              # Business intelligence & analytics
│   │   │   └── sync.ts                 # Branch synchronization API
│   │   ├── integrations/
│   │   │   └── OneCIntegration.ts      # 1C system integration service
│   │   ├── services/
│   │   │   ├── branchApi.ts            # Outbound API to branches
│   │   │   ├── SyncScheduler.ts        # Automated sync scheduling
│   │   │   ├── redis.ts                # Cache and session management
│   │   │   └── websocket.ts            # Real-time communication
│   │   └── database/                   # Chain-level database management
│   └── API_DOCUMENTATION_1C.md        # 1C integration documentation
├── chain-manager/                      # 🖥️ Main Office Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/                 # Shared UI components
│   │   │   ├── customers/              # Customer management components
│   │   │   └── inventory/              # Inventory management UI
│   │   ├── hooks/                      # Custom React hooks for data management
│   │   ├── pages/                      # Main application pages
│   │   ├── services/                   # API services and utilities
│   │   └── locales/                    # Multi-language support
├── branch-core/                        # 🏪 Branch Backend Server
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth.ts                 # Local authentication
│   │   │   ├── chain-core.ts           # Chain-core integration API
│   │   │   ├── products.ts             # Local product management
│   │   │   ├── transactions.ts         # POS transaction processing
│   │   │   ├── employees.ts            # Branch employee management
│   │   │   ├── reports.ts              # Branch-level reporting
│   │   │   └── sync.ts                 # Chain synchronization
│   │   ├── database/                   # Branch database management
│   │   ├── services/
│   │   │   ├── redis.ts                # Local caching
│   │   │   └── websocket.ts            # POS communication
│   │   └── middleware/
│   │       ├── auth.ts                 # JWT authentication
│   │       └── errorHandler.ts         # Error handling
│   └── API_DOCUMENTATION_CHAIN_CORE.md # Chain integration documentation
└── pos-manager/                        # 💳 Point of Sale Frontend
    ├── src/
    │   ├── components/                  # POS UI components
    │   ├── pages/
    │   │   ├── CheckoutPage.tsx         # Main POS interface
    │   │   ├── DashboardPage.tsx        # Manager dashboard
    │   │   └── LoginPage.tsx            # Employee authentication
    │   ├── services/                    # API communication services
    │   ├── hooks/                       # POS-specific React hooks
    │   └── theme/                       # Material-UI theming
    └── electron.ts                      # Desktop application wrapper
```

## 📋 Detailed Component Breakdown

### 🏢 Chain-Core (Main Office Backend)

**Purpose**: Central command center for the entire retail chain

**Core Responsibilities**:

- **1C Integration**: Bidirectional data sync with 1C ERP system
- **Branch Orchestration**: Manages all branch servers and synchronization
- **Master Data Management**: Centralized product catalog, pricing, and employee records
- **Business Intelligence**: Chain-wide reporting and analytics
- **Network Monitoring**: Health monitoring of all branch connections

**Key Features**:

- RESTful API with rate limiting and security
- Real-time WebSocket communication with branches
- Automated sync scheduling with configurable intervals
- Comprehensive audit logging and error tracking
- Multi-branch inventory management and transfers

**Technology Stack**:

- **Runtime**: Node.js + TypeScript + Express.js
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for sessions and performance
- **Integration**: HTTP/SOAP APIs for 1C communication
- **Real-time**: WebSocket server for branch communication

### 🖥️ Chain-Manager (Main Office Frontend)

**Purpose**: Web-based management interface for chain operations

**Core Responsibilities**:

- **Dashboard & Analytics**: Real-time KPI monitoring and business intelligence
- **Branch Management**: Monitor branch performance and manage configurations
- **Employee Administration**: Chain-wide HR management and scheduling
- **Inventory Control**: Central inventory management and transfer coordination
- **Promotional Campaigns**: Create and manage sales promotions across branches
- **Reporting**: Generate comprehensive reports for management and accounting

**Key Features**:

- Modern React-based responsive interface
- Real-time data visualization with charts and graphs
- Multi-language support (English, Russian, Uzbek)
- Role-based access control for different management levels
- Export functionality for reports and data analysis

**Technology Stack**:

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Material-UI (MUI) v6 with custom theming
- **State Management**: React Context + Custom hooks
- **Charts**: Recharts + MUI X Charts for data visualization
- **HTTP Client**: Axios with request/response interceptors
- **Internationalization**: i18next for multi-language support

### 🏪 Branch-Core (Branch Backend Server)

**Purpose**: Local branch server providing offline-capable POS operations

**Core Responsibilities**:

- **Local POS API**: Serves multiple POS terminals in the branch
- **Chain Synchronization**: Receives updates from and reports to chain-core
- **Transaction Processing**: Handles all sales transactions and payments
- **Local Inventory**: Maintains real-time inventory levels for the branch
- **Employee Management**: Local authentication and time tracking
- **Offline Operations**: Full functionality during network outages

**Key Features**:

- Complete REST API for POS operations
- Real-time WebSocket communication with POS terminals
- Automatic synchronization with chain-core when online
- Local data persistence with PostgreSQL
- Comprehensive transaction logging and audit trails

**Technology Stack**:

- **Runtime**: Node.js + TypeScript + Express.js
- **Database**: PostgreSQL for transactional data
- **Cache**: Redis for session management and performance
- **Real-time**: WebSocket server for POS communication
- **Authentication**: JWT tokens with bcrypt password hashing

### 💳 POS-Manager (Point of Sale Frontend)

**Purpose**: Touch-friendly interface for cashiers and store managers

**Core Responsibilities**:

- **Checkout Interface**: Fast, intuitive product scanning and payment processing
- **Product Search**: Barcode scanning and text-based product lookup
- **Transaction Management**: Sales processing, voids, and refunds
- **Employee Authentication**: Role-based login system
- **Local Dashboard**: Branch-level sales monitoring and reports
- **Customer Interface**: Customer-facing display capabilities

**Key Features**:

- Touch-optimized Material-UI interface
- Barcode scanner integration
- Multiple payment method support
- Real-time inventory updates
- Receipt printing capabilities
- Offline transaction queuing

**Technology Stack**:

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: Material-UI optimized for touch interfaces
- **Desktop App**: Electron for native desktop deployment
- **Real-time**: WebSocket client for live updates
- **State Management**: React Context + Custom hooks for POS operations

## � Service Integration & Data Flow

### How Different Services Work Together

#### 1. 1C ↔ Chain-Core Integration

**Data Flow**: 1C ERP System → Chain-Core → All Branches

```typescript
// Example: Product sync from 1C to all branches
1C System sends product data → Chain-Core validates and stores →
Chain-Core distributes to all Branch-Core systems →
Branch-Core updates local databases → POS-Manager receives real-time updates
```

**Key Integration Points**:

- **Product Management**: 1C pushes product catalog updates to chain-core
- **Pricing**: Centralized price management from 1C across all branches
- **Inventory**: Stock level adjustments propagated from 1C to specific branches
- **Employee Data**: HR information synchronized from 1C to respective branches
- **Financial Reporting**: Transaction data exported from chain-core to 1C

#### 2. Chain-Core ↔ Branch-Core Communication

**Bidirectional API Communication** with security and health monitoring:

```typescript
// Outbound: Chain-Core → Branch-Core
POST https://branch-server:3000/api/chain-core/products/sync
Authorization: ApiKey rp_branch_001_outbound_key

// Inbound: Branch-Core → Chain-Core
POST https://chain-core:3001/api/sync/transactions
Authorization: Bearer rp_branch_001_inbound_key
```

**Synchronization Types**:

- **Real-time**: Price changes, promotional updates, urgent inventory adjustments
- **Scheduled**: Daily product sync, employee updates, configuration changes
- **On-demand**: Manual sync triggers, health checks, status reports

#### 3. Branch-Core ↔ POS-Manager Real-time Communication

**WebSocket-based real-time updates** for seamless POS operations:

```typescript
// WebSocket Events
- product_price_update: Real-time price changes
- inventory_level_change: Stock level updates
- transaction_complete: Sales transaction completion
- employee_login: Staff authentication events
- system_alert: Important system notifications
```

**API Endpoints for POS Operations**:

- **Authentication**: JWT-based employee login with role verification
- **Product Lookup**: Barcode scanning and product search
- **Transaction Processing**: Sales, returns, and payment handling
- **Inventory Updates**: Real-time stock level management

### Data Synchronization Strategies

#### 1. Master Data Synchronization (1C → Chain-Core → Branches)

```mermaid
graph TD
    A[1C ERP System] -->|Product Updates| B[Chain-Core]
    B -->|Validate & Store| C[Chain Database]
    B -->|Distribute| D[Branch-Core 1]
    B -->|Distribute| E[Branch-Core 2]
    B -->|Distribute| F[Branch-Core N]
    D -->|Local Update| G[POS-Manager 1]
    E -->|Local Update| H[POS-Manager 2]
    F -->|Local Update| I[POS-Manager N]
```

#### 2. Transaction Reporting (Branches → Chain-Core → 1C)

```mermaid
graph TD
    A[POS-Manager] -->|Sales Transaction| B[Branch-Core]
    B -->|Local Storage| C[Branch Database]
    B -->|Report to Chain| D[Chain-Core]
    D -->|Aggregate & Store| E[Chain Database]
    D -->|Export to ERP| F[1C System]
```

#### 3. Inventory Management Flow

```mermaid
graph TD
    A[1C Inventory Adjustment] -->|API Call| B[Chain-Core]
    B -->|Validate| C{Target Branch?}
    C -->|Specific Branch| D[Target Branch-Core]
    C -->|All Branches| E[All Branch-Core Systems]
    D -->|Update Local Stock| F[Branch Database]
    E -->|Update Local Stock| G[Multiple Branch Databases]
    F -->|Real-time Update| H[POS-Manager]
    G -->|Real-time Update| I[Multiple POS-Managers]
```

### Security & Authentication Flow

#### Multi-tier Authentication System

```typescript
// 1. 1C → Chain-Core Authentication
POST /api/1c/products
Authorization: Bearer rp_1C_DEFAULT_KEY_REPLACE_IN_PRODUCTION

// 2. Chain-Core → Branch-Core Authentication
POST /api/chain-core/products/sync
Authorization: ApiKey rp_branch_001_outbound_key

// 3. POS-Manager → Branch-Core Authentication
POST /api/auth/login
{
  "employee_id": "EMP001",
  "pin": "1234"
}
Response: { "token": "jwt_token_here", "role": "cashier" }

// 4. Subsequent POS API calls
GET /api/products/search?barcode=123456
Authorization: Bearer jwt_token_here
```

### Error Handling & Resilience

#### Network Resilience Strategies

1. **Offline Queue Management**:

   - POS operations continue during network outages
   - Transactions queued and synchronized when connection restored

2. **Health Monitoring**:

   - Continuous monitoring of all branch connections
   - Automatic retry mechanisms for failed sync operations
   - Alert system for prolonged disconnections

3. **Data Consistency**:
   - Database transactions ensure data integrity
   - Conflict resolution for simultaneous updates
   - Audit logging for all critical operations

#### Monitoring & Alerting

```typescript
// Connection Health Monitoring
interface ConnectionHealth {
  source_type: 'chain_core' | 'branch_core';
  target_id: string;
  connection_status: 'online' | 'offline' | 'error';
  response_time_ms: number;
  last_successful_sync: Date;
  error_message?: string;
}

// Real-time Alerts
- Branch disconnection > 5 minutes
- Sync failure > 3 attempts
- API authentication failures
- Database connection issues
- Inventory discrepancies
```

## 🛠️ Technology Stack

### 🏢 Chain-Core (Main Office Backend)

| Component       | Technology               | Purpose                          |
| --------------- | ------------------------ | -------------------------------- |
| Runtime         | Node.js 18+ + TypeScript | Server-side JavaScript execution |
| Framework       | Express.js               | RESTful API development          |
| Database        | PostgreSQL 14+           | Relational data storage          |
| Cache           | Redis 6+                 | Session management & performance |
| Integration     | HTTP/SOAP APIs           | 1C system communication          |
| Real-time       | WebSocket (ws)           | Branch communication             |
| Authentication  | JWT + API Keys           | Multi-tier security              |
| Validation      | Zod schemas              | Type-safe data validation        |
| Process Manager | PM2                      | Production process management    |

### 🖥️ Chain-Manager (Main Office Frontend)

| Component            | Technology                   | Purpose                     |
| -------------------- | ---------------------------- | --------------------------- |
| Framework            | React 18 + TypeScript + Vite | Modern frontend development |
| UI Library           | Material-UI (MUI) v6         | Design system & components  |
| State Management     | React Context + Hooks        | Application state           |
| Routing              | React Router v7              | Navigation management       |
| Charts               | Recharts + MUI X Charts      | Data visualization          |
| Data Grid            | MUI X Data Grid              | Table components            |
| HTTP Client          | Axios                        | API communication           |
| Internationalization | i18next                      | Multi-language support      |
| Date Handling        | Day.js                       | Date/time utilities         |

### 🏪 Branch-Core (Branch Backend Server)

| Component      | Technology               | Purpose                        |
| -------------- | ------------------------ | ------------------------------ |
| Runtime        | Node.js 18+ + TypeScript | Local server execution         |
| Framework      | Express.js               | RESTful API for POS            |
| Database       | PostgreSQL 14+           | Local transaction storage      |
| Cache          | Redis 6+                 | Local sessions & performance   |
| Real-time      | WebSocket (ws)           | POS terminal communication     |
| Authentication | JWT + bcrypt             | Employee authentication        |
| Validation     | Zod schemas              | Request validation             |
| Error Handling | Custom middleware        | Comprehensive error management |

### 💳 POS-Manager (Point of Sale Frontend)

| Component        | Technology                   | Purpose                     |
| ---------------- | ---------------------------- | --------------------------- |
| Framework        | React 19 + TypeScript + Vite | Fast POS interface          |
| UI Library       | Material-UI (MUI)            | Touch-optimized components  |
| Desktop App      | Electron                     | Native desktop deployment   |
| State Management | React Context + Hooks        | POS state management        |
| Real-time        | WebSocket client             | Live inventory updates      |
| Styling          | Emotion + Tailwind CSS       | Custom styling              |
| Build Tool       | Vite                         | Fast development & building |

### 🔧 Infrastructure & DevOps

| Component        | Technology              | Purpose                  |
| ---------------- | ----------------------- | ------------------------ |
| Containerization | Docker                  | Application packaging    |
| Reverse Proxy    | Nginx                   | Load balancing & SSL     |
| Cloud Platform   | AWS / DigitalOcean      | Hosting infrastructure   |
| Version Control  | Git                     | Source code management   |
| CI/CD            | GitHub Actions          | Automated deployment     |
| Monitoring       | Custom logging + alerts | System health monitoring |

## 🎯 Features & Implementation Status

### ✅ Fully Implemented Features

#### Chain-Core (Main Office Backend)

- ✅ **Complete 1C Integration API** with comprehensive endpoints
- ✅ **Branch Management System** with health monitoring
- ✅ **Real-time Synchronization** via WebSocket
- ✅ **Multi-branch Inventory Management**
- ✅ **Employee Management** across all branches
- ✅ **Promotional Campaign Management**
- ✅ **Business Intelligence & Reporting**
- ✅ **API Key Authentication** (inbound/outbound)
- ✅ **Rate Limiting & Security**

#### Chain-Manager (Main Office Frontend)

- ✅ **Modern React-based Dashboard**
- ✅ **Branch Performance Monitoring**
- ✅ **Employee Management Interface**
- ✅ **Inventory Control System**
- ✅ **Multi-language Support** (EN/RU/UZ)
- ✅ **Real-time Data Visualization**
- ✅ **Role-based Access Control**

#### Branch-Core (Branch Backend Server)

- ✅ **Complete POS API** with all endpoints
- ✅ **Chain-Core Integration API**
- ✅ **JWT Authentication System**
- ✅ **Transaction Processing Engine**
- ✅ **Local Inventory Management**
- ✅ **Employee Time Tracking**
- ✅ **WebSocket Real-time Communication**
- ✅ **Offline Operation Capabilities**
- ✅ **PostgreSQL Database Management**
- ✅ **Redis Caching & Sessions**

#### POS-Manager (Point of Sale Frontend)

- ✅ **Touch-optimized Interface**
- ✅ **Employee Authentication**
- ✅ **Product Search & Barcode Scanning**
- ✅ **Transaction Processing**
- ✅ **Real-time Inventory Updates**
- ✅ **Multi-page Application** (Login, Dashboard, Checkout)
- ✅ **Electron Desktop Integration**

### 🔄 In Active Development

- 🔄 **Frontend-Backend Integration** (POS-Manager ↔ Branch-Core)
- 🔄 **Hardware Integration** (barcode scanners, receipt printers)
- � **Advanced Reporting Features**
- � **Mobile Manager Applications**

### 📋 Planned Features

- 📋 **Customer Loyalty Programs**
- 📋 **Advanced Analytics & ML**
- 📋 **Multi-tenant Cloud Platform**
- 📋 **Payment Gateway Integration** (PayMe, Click, UzCard)
- 📋 **Automated Reordering System**
- 📋 **Advanced Promotional Rules Engine**

## 🚀 Getting Started

### System Requirements

- **Node.js**: 18+ LTS version
- **PostgreSQL**: 14+ (separate instances for chain-core and each branch-core)
- **Redis**: 6+ (for caching and session management)
- **Git**: Latest version for source control

### Development Environment Setup

#### 1. Clone and Setup Repository

```bash
git clone https://github.com/Doston1/zentra.git
cd RockPoint
```

#### 2. Setup Chain-Core (Main Office Backend) - First Priority

```bash
cd chain-core

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration:
# - PostgreSQL connection for chain database
# - Redis connection details
# - 1C API configuration
# - JWT secrets and API keys

# Create PostgreSQL database
createdb rockpoint_chain

# Run database migrations
npm run db:migrate

# Seed with sample data
npm run db:seed

# Start development server
npm run dev
```

**Chain-Core will be available at:** `http://localhost:3001`

#### 3. Setup Chain-Manager (Main Office Frontend)

```bash
cd ../chain-manager

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Configure API endpoints:
# VITE_API_BASE_URL=http://localhost:3001/api
# VITE_WS_URL=ws://localhost:3001/ws

# Start development server
npm run dev
```

**Chain-Manager will be available at:** `http://localhost:5174`

#### 4. Setup Branch-Core (Branch Backend Server)

```bash
cd ../branch-core

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration:
# - PostgreSQL connection for branch database (different from chain database)
# - Redis connection details
# - Chain-core API endpoint and authentication
# - Branch-specific configuration

# Create PostgreSQL database for branch
createdb rockpoint_branch_001

# Run database migrations
npm run db:migrate

# Seed with sample data
npm run db:seed

# Start development server
npm run dev
```

**Branch-Core will be available at:** `http://localhost:3000`

#### 5. Setup POS-Manager (Point of Sale Frontend)

```bash
cd ../pos-manager

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Configure branch API endpoints:
# VITE_API_URL=http://localhost:3000/api
# VITE_WS_URL=ws://localhost:3000/ws

# Start development server
npm run dev
```

**POS-Manager will be available at:** `http://localhost:5173`

### 🔑 Default Login Credentials

#### Chain-Manager (Main Office)

After running `npm run db:seed` in chain-core:

- **Super Admin**: `admin@rockpoint.com` / `admin123`
- **Chain Manager**: `manager@rockpoint.com` / `manager123`

#### POS-Manager (Branch)

After running `npm run db:seed` in branch-core:

- **Branch Manager**: `EMP001` / PIN: `1234`
- **Cashier**: `EMP002` / PIN: `5678`
- **Supervisor**: `EMP003` / PIN: `9999`

### Production Deployment

#### 1. Environment Configuration

**Chain-Core Production (.env)**:

```env
# Server Configuration
PORT=3001
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=24h

# Database Configuration
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=rockpoint_chain_prod
DB_USER=rockpoint_user
DB_PASSWORD=your-secure-password

# Redis Configuration
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# 1C Integration
1C_API_URL=http://your-1c-server/api
1C_USERNAME=1c-integration-user
1C_PASSWORD=1c-secure-password
1C_SYNC_INTERVAL=300000

# Security
API_RATE_LIMIT=100
BCRYPT_ROUNDS=12
```

**Branch-Core Production (.env)**:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
JWT_SECRET=your-branch-jwt-secret
JWT_EXPIRES_IN=8h

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rockpoint_branch_001_prod
DB_USER=branch_user
DB_PASSWORD=branch-secure-password

# Chain-Core Integration
CHAIN_CORE_URL=https://your-chain-core-server.com/api
CHAIN_CORE_API_KEY=rp_branch_001_inbound_key
CHAIN_CORE_OUTBOUND_API_KEY=rp_branch_001_outbound_key

# Branch Configuration
BRANCH_ID=BRANCH_001
BRANCH_NAME=Main Store Location
```

#### 2. Build for Production

```bash
# Build Chain-Manager
cd chain-manager
npm run build
# Deploy dist/ folder to web server

# Build POS-Manager
cd ../pos-manager
npm run build
# Deploy dist/ folder or create Electron package

# Prepare Backend Services
cd ../chain-core
npm run build
# Use PM2 for process management

cd ../branch-core
npm run build
# Deploy to branch servers with PM2
```

#### 3. Process Management with PM2

```bash
# Chain-Core (Main Office)
pm2 start ecosystem.config.js --only chain-core

# Branch-Core (Each Branch)
pm2 start ecosystem.config.js --only branch-core
```

### Development Workflow

#### Starting Development Environment

```bash
# Terminal 1: Chain-Core
cd chain-core && npm run dev

# Terminal 2: Chain-Manager
cd chain-manager && npm run dev

# Terminal 3: Branch-Core
cd branch-core && npm run dev

# Terminal 4: POS-Manager
cd pos-manager && npm run dev
```

#### Development Tools

```bash
# Database operations
npm run db:migrate    # Run migrations
npm run db:seed       # Seed sample data
npm run db:reset      # Reset database completely

# Code quality
npm run lint          # ESLint checking
npm run type-check    # TypeScript compilation check
npm run test          # Run unit tests

# Build operations
npm run build         # Production build
npm run preview       # Preview production build
```

### Network Configuration

#### Local Development Network

- **Chain-Core**: `http://localhost:3001`
- **Chain-Manager**: `http://localhost:5174`
- **Branch-Core**: `http://localhost:3000`
- **POS-Manager**: `http://localhost:5173`

#### Production Network Example

- **Chain-Core**: `https://chain.rockpoint.com`
- **Chain-Manager**: `https://manager.rockpoint.com`
- **Branch-Core**: `http://192.168.1.100:3000` (Local network)
- **POS-Manager**: `http://192.168.1.100:5173` (Local network)

### API Documentation

- **1C Integration API**: `/chain-core/API_DOCUMENTATION_1C.md`
- **Branch Integration API**: `/branch-core/API_DOCUMENTATION_CHAIN_CORE.md`
- **Outbound API Configuration**: `/chain-core/src/services/OUTBOUND_API_KEY_GUIDE.md``

## 🏪 Business Use Cases & Applications

### Retail Chain Types Supported

#### 🛒 Supermarkets & Grocery Stores

- **Product Management**: Extensive catalog with barcodes, pricing, and inventory
- **Multi-location Inventory**: Real-time stock tracking across all branches
- **Promotional Campaigns**: Chain-wide sales and discount management
- **Perishable Goods**: Expiration date tracking and automated alerts
- **Supplier Integration**: Purchase order management and receiving
- **Customer Analytics**: Shopping pattern analysis and loyalty programs

#### 💊 Pharmacies & Medical Stores

- **Prescription Management**: Controlled substance tracking and compliance
- **Drug Inventory**: Batch number and expiration date management
- **Insurance Integration**: Insurance claim processing and verification
- **Patient Records**: Secure customer medication history
- **Regulatory Compliance**: Automated reporting for health authorities
- **Special Storage**: Temperature-controlled inventory management

#### 🏋️ Gyms & Fitness Centers

- **Membership Management**: Member registration and subscription tracking
- **Access Control**: Entry/exit logging with membership verification
- **Personal Trainer Scheduling**: Appointment booking and trainer management
- **Equipment Maintenance**: Asset tracking and maintenance schedules
- **Class Management**: Group fitness class scheduling and capacity management
- **Payment Processing**: Membership fees and additional service billing

#### 🎮 Children's Play Centers & Entertainment

- **Entry Ticket Sales**: Time-based entry management with capacity control
- **Birthday Party Bookings**: Event scheduling and package management
- **Food & Beverage Orders**: Café integration with table service
- **Safety Monitoring**: Capacity tracking and emergency procedures
- **Parent Communication**: SMS notifications and pickup alerts
- **Equipment Safety**: Play equipment inspection and maintenance tracking

### Industry-Specific Features

#### Multi-branch Operations

- **Centralized Control**: Single dashboard for all locations
- **Branch Performance**: Individual branch analytics and comparison
- **Staff Management**: Cross-branch employee scheduling and transfers
- **Inventory Transfers**: Inter-branch stock movement and balancing
- **Standardized Processes**: Consistent operations across all locations

#### Financial Management

- **1C Integration**: Seamless integration with 1C accounting system
- **Real-time Reporting**: Live financial data and analytics
- **Tax Compliance**: Automated tax calculation and reporting
- **Audit Trail**: Complete transaction history and audit logging
- **Multi-currency Support**: Local and foreign currency handling

#### Customer Experience

- **Fast Checkout**: Optimized POS interface for quick transactions
- **Multiple Payment Methods**: Cash, card, mobile payments (PayMe, Click, UzCard)
- **Receipt Management**: Digital and printed receipt options
- **Customer Loyalty**: Points accumulation and reward redemption
- **Queue Management**: Efficient checkout process and waiting time reduction

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
```

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

## 🤝 Contributing & Development

### Contributing Guidelines

1. **Fork the repository** and create your feature branch:

   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Follow coding standards**:

   - Use TypeScript for all new code
   - Follow ESLint configuration
   - Write comprehensive unit tests
   - Use conventional commit messages
   - Document new APIs and features

3. **Test your changes**:

   ```bash
   # Run tests for all components
   npm run test

   # Type checking
   npm run type-check

   # Linting
   npm run lint
   ```

4. **Submit your changes**:

   ```bash
   git commit -m 'feat: add amazing feature'
   git push origin feature/amazing-feature
   ```

5. **Open a Pull Request** with:
   - Clear description of changes
   - Screenshots for UI changes
   - Test results and coverage
   - Documentation updates

### Code Quality Standards

- **TypeScript**: All new code must be written in TypeScript with proper type definitions
- **API Documentation**: Update relevant API documentation for any endpoint changes
- **Security**: Follow security best practices for authentication and data handling
- **Performance**: Consider performance implications for POS operations
- **Accessibility**: Ensure UI components are accessible and touch-friendly

### Development Workflow

```bash
# 1. Start all services in development mode
npm run dev:all

# 2. Run specific service
npm run dev:chain-core
npm run dev:chain-manager
npm run dev:branch-core
npm run dev:pos-manager

# 3. Database operations
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:reset        # Reset database

# 4. Testing
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests

# 5. Production build
npm run build:all       # Build all components
```

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-party Dependencies

- **Material-UI**: MIT License
- **React**: MIT License
- **Node.js & Express**: MIT License
- **PostgreSQL**: PostgreSQL License
- **Redis**: BSD License

## 🆘 Support & Troubleshooting

### Getting Help

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Community support and questions
- **Documentation**: Comprehensive guides in `/docs` folder
- **API Reference**: Available in each component's README

### Common Issues

#### 1. Connection Issues

```bash
# Test chain-core to 1C connection
curl http://localhost:3001/api/1c/status

# Test branch-core to chain-core connection
curl http://localhost:3000/api/chain-core/health

# Check network connectivity
npm run test:network
```

#### 2. Database Issues

```bash
# Reset database if migrations fail
npm run db:reset

# Check database connection
npm run db:check

# View migration status
npm run db:status
```

#### 3. Authentication Issues

```bash
# Verify API keys configuration
npm run config:verify

# Test authentication endpoints
npm run test:auth
```

### Performance Monitoring

- **Application Metrics**: Built-in performance monitoring
- **Database Monitoring**: Query performance and connection pooling
- **Network Health**: Real-time branch connectivity monitoring
- **Error Tracking**: Comprehensive error logging and alerting

## 📋 Development Roadmap

### ✅ Phase 1: Foundation (Completed)

- [x] **Core Architecture**: Distributed system design
- [x] **Security Framework**: Multi-tier authentication system
- [x] **Database Design**: Scalable schema for chain operations
- [x] **API Development**: Complete REST APIs for all components
- [x] **Real-time Communication**: WebSocket implementation
- [x] **1C Integration**: Full ERP system integration

### 🔄 Phase 2: Integration & Testing (Current)

- [x] **Frontend-Backend Integration**: Connecting all components
- [x] **Security Hardening**: API key management and encryption
- [x] **Performance Optimization**: Caching and query optimization
- [x] **Comprehensive Testing**: Unit, integration, and E2E tests
- [x] **Documentation**: Complete API and user documentation

### 📋 Phase 3: Advanced Features (Q1 2025)

- [ ] **Mobile Applications**: iOS and Android management apps
- [ ] **Hardware Integration**: Barcode scanners, receipt printers, cash drawers
- [ ] **Payment Gateway Integration**: PayMe, Click, UzCard support
- [ ] **Advanced Analytics**: Machine learning for inventory optimization
- [ ] **Customer Loyalty**: Points system and customer engagement
- [ ] **Multi-tenant Cloud**: SaaS platform for multiple chains

### 📋 Phase 4: Enterprise & Scale (Q2 2025)

- [ ] **Microservices Architecture**: Break down monolithic components
- [ ] **Kubernetes Deployment**: Container orchestration
- [ ] **Advanced Reporting**: Business intelligence and data warehousing
- [ ] **API Marketplace**: Third-party integrations and plugins
- [ ] **AI/ML Features**: Demand forecasting and automated reordering
- [ ] **International Expansion**: Multi-currency and localization

### Future Enhancements

#### Business Intelligence

- Real-time dashboards with predictive analytics
- Custom report builder with drag-and-drop interface
- Data export to popular BI tools (Power BI, Tableau)
- Mobile executive dashboards

#### Operational Excellence

- Automated inventory management with AI
- Predictive maintenance for POS hardware
- Employee performance analytics
- Customer behavior analysis

#### Integration Ecosystem

- Accounting software integrations (QuickBooks, SAP)
- E-commerce platform synchronization
- Supplier portal and EDI integration
- Government reporting automation

---

## 🏆 Acknowledgments

**Built with ❤️ for modern retail and service businesses**

### Special Thanks

- **1C Community**: For comprehensive ERP integration support
- **React & Node.js Communities**: For excellent frameworks and libraries
- **Material-UI Team**: For beautiful and accessible UI components
- **PostgreSQL & Redis Teams**: For robust and reliable data management
- **Contributors**: All developers who have contributed to this project

### Technology Partners

- **Microsoft Azure**: Cloud infrastructure support
- **DigitalOcean**: Development and staging environments
- **GitHub**: Source code management and CI/CD
- **Vercel**: Frontend deployment and hosting

---

**RockPoint** - _Empowering Retail Excellence Through Technology_

_Version 1.0 | Last Updated: August 20, 2025_
