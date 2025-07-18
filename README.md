# Zentra - Branch Management Platform

A comprehensive platform for managing business branches including **supermarkets, gyms, and children's play centers**. This system provides complete POS functionality with offline-first capabilities and centralized management.

## 🧠 Overview

Zentra is designed as a distributed system where each business branch operates independently with its own local infrastructure while maintaining synchronization with a central cloud service for enterprise-wide management.

### Architecture

- **Branch-level**: Each location runs a local Node.js server with PostgreSQL database
- **POS Terminals**: Multiple React-based point-of-sale interfaces per branch
- **Cloud Sync**: Daily synchronization with central management platform
- **Offline-First**: Full functionality without internet connectivity

## 🏗️ Project Structure

```
Zentra/
├── README.md                    # This file
├── pos-manager/                 # Frontend POS application
│   ├── src/                     # React + TypeScript source
│   ├── electron.ts              # Electron desktop wrapper
│   ├── package.json
│   └── README.md
└── branch-core/                 # Backend server (planned)
    ├── src/                     # Node.js + TypeScript source
    ├── database/                # PostgreSQL schemas & migrations
    ├── services/                # Business logic services
    ├── api/                     # REST API endpoints
    └── sync/                    # Cloud synchronization logic
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

### Backend (branch-core) - _Planned_

| Component      | Technology           |
| -------------- | -------------------- |
| Runtime        | Node.js + TypeScript |
| Framework      | Express.js           |
| Database       | PostgreSQL           |
| ORM            | Prisma / TypeORM     |
| Real-time      | WebSocket            |
| Authentication | JWT + PIN codes      |
| Task Queue     | Bull Queue           |

### Infrastructure

| Component        | Technology         |
| ---------------- | ------------------ |
| Containerization | Docker             |
| Process Manager  | PM2                |
| Reverse Proxy    | Nginx              |
| Cloud Platform   | AWS / DigitalOcean |

## 🎯 Features

### Current (pos-manager)

- ✅ Material-UI based responsive interface
- ✅ Multi-page routing (Login, Dashboard, Checkout)
- ✅ TypeScript for type safety
- ✅ Electron integration ready

### Planned (branch-core)

- 🔄 Product inventory management
- 🔄 Real-time price lookup and updates
- 🔄 Multi-payment method support (cash, card, digital wallets)
- 🔄 Employee management and time tracking
- 🔄 Role-based access control
- 🔄 Sales reporting and analytics
- 🔄 Barcode scanning integration
- 🔄 Receipt printing
- 🔄 Daily cloud synchronization

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
- PostgreSQL 14+ (for branch-core)
- Git

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Zentra
   ```

2. **Set up POS Manager (Frontend)**

   ```bash
   cd pos-manager
   npm install
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

3. **Set up Branch Core (Backend)**

   ```bash
   cd branch-core
   npm install

   # Copy environment file and configure
   cp .env.example .env
   # Edit .env with your database credentials

   # Run database migrations
   npm run db:migrate

   # Start development server
   npm run dev
   ```

### Development Workflow

```bash
# Start frontend development server
cd pos-manager && npm run dev

# Start backend development server (when available)
cd branch-core && npm run dev

# Run Electron desktop app
cd pos-manager && npm run electron

# Build for production
cd pos-manager && npm run build
```

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

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/branch_db
REDIS_URL=redis://localhost:6379

# API Settings
PORT=3000
JWT_SECRET=your-secret-key

# Cloud Sync
CLOUD_API_URL=https://api.zentra-cloud.com
SYNC_INTERVAL=24h
BRANCH_ID=branch-001
```

### Local Network Setup

Each branch should configure the POS terminals to connect to the local server:

```env
# pos-manager/.env
VITE_API_BASE_URL=http://192.168.1.100:3000
VITE_BRANCH_ID=branch-001
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
