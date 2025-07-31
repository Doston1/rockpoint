# RockPoint POS Frontend

This is the frontend application for the RockPoint Point of Sale system built with React, TypeScript, and Material-UI.

## Features

- **Authentication System**: JWT-based authentication with role-based access control
- **Real-time Communication**: WebSocket integration for live updates
- **Product Management**: Search products, scan barcodes, manage inventory
- **Transaction Processing**: Complete checkout process with multiple payment methods
- **Dashboard**: Manager dashboard with system overview
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Setup and Installation

### Prerequisites

- Node.js 18+ and npm
- Backend server running at `http://localhost:3000`

### Installation

1. Navigate to the pos-manager directory:

   ```bash
   cd pos-manager
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. The application will be available at `http://localhost:5173`

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
VITE_APP_NAME=RockPoint POS
VITE_APP_VERSION=1.0.0
VITE_DEBUG=true
```

## Default Login Credentials

- **Admin**: `admin` / `admin1234`
- **Cashier**: `cashier` / `1111`

## Architecture

### Services

- **API Service** (`src/services/api.ts`): Handles all HTTP requests to the backend
- **WebSocket Service** (`src/services/websocket.ts`): Manages real-time communication

### Hooks

- **useAuth** (`src/hooks/useAuth.tsx`): Authentication state management
- **useProducts** (`src/hooks/useProducts.ts`): Product data management
- **useTransactions** (`src/hooks/useTransactions.ts`): Transaction processing
- **useWebSocket** (`src/hooks/useWebSocket.ts`): WebSocket communication

### Components

- **NavigationBar**: Common navigation with user info and connection status
- **ProtectedRoute**: Route protection based on authentication and roles

### Pages

- **LoginPage**: User authentication
- **DashboardPage**: Manager overview (admin/manager only)
- **CheckoutPage**: Point of sale interface

## API Integration

The frontend communicates with the backend using:

### HTTP Requests

- Authentication: `/api/auth/*`
- Products: `/api/products/*`
- Transactions: `/api/transactions/*`
- Employees: `/api/employees/*`
- Reports: `/api/reports/*`

### WebSocket Messages

- Price requests and responses
- Inventory updates
- Terminal status
- Transaction synchronization

## Features by Role

### Admin/Manager

- Access to dashboard
- View all transactions
- Manage employees
- Generate reports
- Access to POS system

### Cashier/Supervisor

- Access to POS system
- Process transactions
- Search products
- Handle payments
