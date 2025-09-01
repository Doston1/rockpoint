# RockPoint System - Port Configuration

## Current Port Allocation

| Service                   | Port | Status      | Purpose                      |
| ------------------------- | ---- | ----------- | ---------------------------- |
| **branch-core**           | 3000 | ✅ Existing | Your existing service        |
| **chain-core**            | 3001 | ✅ Existing | Your existing service        |
| **license-api-server**    | 3002 | ✅ New      | License management API       |
| **license-control-panel** | 3003 | ✅ New      | Admin dashboard (dev server) |
| **pos-manager**           | 5173 | ✅ Existing | Your existing Vite app       |
| **chain-manager**         | 5174 | ✅ Existing | Your existing Vite app       |

## Service URLs

### Development

- **Branch Core**: http://localhost:3000
- **Chain Core**: http://localhost:3001
- **License API**: http://localhost:3002
- **License Dashboard**: http://localhost:3003
- **POS Manager**: http://localhost:5173
- **Chain Manager**: http://localhost:5174

### API Endpoints (License Server)

- **Admin Panel**: http://localhost:3002/api/admin/\*
- **License Operations**: http://localhost:3002/api/license/\*
- **Health Check**: http://localhost:3002/health

## Starting Services

### License API Server

```bash
cd license-api-server
npm start
# Runs on port 3002
```

### License Control Panel (Development)

```bash
cd license-control-panel
npm run dev
# Runs on port 3003
```

### Customer Portal

- Static HTML file: `customer-portal/index.html`
- Can be served by any web server
- Or opened directly in browser

## Production Deployment

### Build Commands

```bash
# API Server
cd license-api-server && npm run build

# Control Panel
cd license-control-panel && npm run build
```

### Production Ports

- Configure via environment variables
- API Server: `PORT=3002` (or your choice)
- Control Panel: Build static files, serve via nginx/apache
- Customer Portal: Serve static HTML file

## No Port Conflicts! ✅

All new license management services use ports that don't conflict with your existing applications.
