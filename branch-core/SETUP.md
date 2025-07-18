# 🚀 Branch Core Server - Quick Start Guide

## ✅ Problems Fixed

The following issues have been resolved:

1. **ES Module Import Issues** - Fixed TypeScript module configuration to use CommonJS
2. **Logger Type Errors** - Fixed Response.end method override type issues
3. **JWT Type Issues** - Added proper type annotations for JWT signing
4. **Missing Files** - Created missing database seed, reset, and type definition files
5. **Compilation Errors** - All TypeScript compilation errors resolved

## 📋 Prerequisites

Make sure you have installed:

- **Node.js 18+**
- **PostgreSQL 14+**
- **Redis 6+** (optional but recommended)

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd branch-core
npm install
```

### 2. Environment Configuration

```bash
# Copy environment file
cp .env.example .env

# Edit with your database credentials
# Update the following in .env:
# - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# - JWT_SECRET (use a strong secret key)
# - REDIS_URL (if using Redis)
# - BRANCH_ID and BRANCH_NAME
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb zentra_branch

# Run database migrations
npm run db:migrate

# Seed with sample data (optional)
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on: `http://localhost:3000`
WebSocket endpoint: `ws://localhost:3000/ws`

## 🔑 Test Login Credentials

After running `npm run db:seed`, you can use these test accounts:

- **Admin**: `EMP001` / PIN: `1234`
- **Manager**: `EMP002` / PIN: `5678`
- **Cashier**: `EMP003` / PIN: `9999`
- **Cashier**: `EMP004` / PIN: `9999`

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/login` - Employee login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/verify` - Verify token

### Products

- `GET /api/products/search?query=...` - Search products
- `GET /api/products/barcode/:barcode` - Get by barcode
- `GET /api/products/:id` - Get product details
- `POST /api/products/:id/update-stock` - Update inventory

### Transactions

- `POST /api/transactions` - Create transaction
- `POST /api/transactions/:id/payment` - Process payment
- `GET /api/transactions/:id` - Get transaction details

### Reports

- `GET /api/reports/sales/daily` - Daily sales report
- `GET /api/reports/products/top-selling` - Top selling products
- `GET /api/reports/inventory/status` - Inventory status

### Employees

- `GET /api/employees` - List employees
- `POST /api/employees/:id/clock-in` - Clock in
- `POST /api/employees/:id/clock-out` - Clock out

## 🔧 Development Commands

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Database operations
npm run db:migrate    # Create tables
npm run db:seed      # Add sample data
npm run db:reset     # Reset database (use with --confirm)
```

## 🐛 Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database exists: `createdb zentra_branch`

### Redis Connection Issues

- Redis is optional for basic functionality
- Comment out Redis calls if not using Redis
- Install Redis: `redis-server`

### Port Already in Use

- Change `PORT=3000` to another port in `.env`
- Kill existing processes: `taskkill /f /im node.exe`

## 🎯 Next Steps

1. **Connect POS Frontend**: Update `pos-manager` to connect to `http://localhost:3000`
2. **Test WebSocket**: Connect a POS terminal via WebSocket at `/ws`
3. **Configure Environment**: Set up production environment variables
4. **Add Business Logic**: Customize for your specific business type (supermarket/gym/play center)

## 📞 Support

- Check the main README.md for detailed documentation
- Review error logs in the terminal
- Ensure all environment variables are properly set

---

**🎉 Your Zentra Branch Core Server is now ready to use!**
