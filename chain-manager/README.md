# RockPoint Chain Manager

Main office frontend application for managing the RockPoint retail chain. This application provides comprehensive management tools for overseeing multiple branches, employees, inventory, and business operations.

## Features

- **Dashboard**: Real-time overview of all chain operations
- **Branch Management**: Monitor and manage multiple retail branches
- **Employee Management**: Chain-wide employee management and scheduling
- **Inventory Control**: Centralized inventory management across all branches
- **Sales Analytics**: Comprehensive sales reporting and analytics
- **1C Integration**: Real-time synchronization with 1C accounting system
- **User Management**: Role-based access control for main office staff
- **Reports & Analytics**: Advanced reporting and business intelligence

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Material-UI (MUI) v6
- **State Management**: React Context + Hooks
- **Routing**: React Router v7
- **Charts**: Recharts + MUI X Charts
- **Data Grid**: MUI X Data Grid
- **HTTP Client**: Axios
- **Internationalization**: i18next
- **Date Handling**: Day.js

## Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your API configuration
   ```

3. **Start development server**:

   ```bash
   npm run dev
   ```

4. **Open in browser**:
   ```
   http://localhost:5174
   ```

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── common/        # Common components (Layout, Loading, etc.)
│   ├── forms/         # Form components
│   └── charts/        # Chart components
├── pages/             # Main page components
│   ├── Dashboard/     # Dashboard page
│   ├── Branches/      # Branch management
│   ├── Employees/     # Employee management
│   ├── Inventory/     # Inventory management
│   ├── Reports/       # Reports and analytics
│   └── Settings/      # System settings
├── hooks/             # Custom React hooks
├── services/          # API services and utilities
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── locales/           # Internationalization files
└── theme/             # MUI theme configuration
```

## Main Pages

### Dashboard

- Real-time KPI overview
- Branch performance metrics
- Sales analytics
- Inventory alerts
- Recent activities

### Branch Management

- Branch listing and details
- Branch performance monitoring
- Employee assignments
- Inventory levels per branch
- Branch configuration

### Employee Management

- Employee directory
- Time tracking and attendance
- Role and permission management
- Performance metrics
- Payroll integration

### Inventory Management

- Product catalog management
- Stock levels across branches
- Low stock alerts
- Transfer management
- Price management

### Reports & Analytics

- Sales reports
- Inventory reports
- Employee performance reports
- Financial analytics
- Custom report builder

## API Integration

The application connects to the Chain Core API for all data operations:

- **Base URL**: `http://localhost:3001/api`
- **Authentication**: JWT Bearer tokens
- **WebSocket**: Real-time updates via WebSocket connection

## Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws

# Application Configuration
VITE_APP_NAME=RockPoint Chain Manager
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_1C_INTEGRATION=true
VITE_ENABLE_ADVANCED_REPORTS=true
```

## Build and Deployment

1. **Build for production**:

   ```bash
   npm run build
   ```

2. **Preview production build**:

   ```bash
   npm run preview
   ```

3. **Deploy**: Upload `dist/` folder to your web server

## Development Guidelines

- Use TypeScript for all new code
- Follow Material-UI design system
- Implement responsive design
- Add error handling for all API calls
- Write unit tests for utilities and hooks
- Use semantic commit messages

## License

MIT
