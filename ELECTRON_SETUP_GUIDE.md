# 🖥️ Electron Desktop Applications Setup Guide

This guide will help you set up and run both **POS Manager** and **Chain Manager** as desktop applications using Electron.

## 📋 Prerequisites

- **Node.js** (v22.12.0 or higher)
- **npm** (v10.9.0 or higher)
- **Windows PowerShell** or **Command Prompt**

## 🏗️ Project Structure Overview

```
RockPoint/
├── pos-manager/          # 💳 POS Desktop App (Cashier Interface)
│   ├── electron.ts       # Electron main process
│   ├── src/             # React frontend source
│   └── package.json     # Dependencies and scripts
├── chain-manager/       # 🏢 Chain Management Desktop App
│   ├── electron.ts      # Electron main process
│   ├── src/             # React frontend source
│   └── package.json     # Dependencies and scripts
├── branch-core/         # 🏪 Branch Backend Server
└── chain-core/          # 🏢 Main Office Backend Server
```

## 🚀 Quick Start - Development Mode

### 1. Install Dependencies

**For POS Manager:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\pos-manager"
npm install
```

**For Chain Manager:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\chain-manager"
npm install
```

### 2. Run Desktop Applications in Development

**Option A: Start POS Manager Desktop App**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\pos-manager"
npm run electron:dev
```

This will:

- Start Vite dev server on `http://localhost:5173`
- Compile the Electron main process
- Launch the desktop application

**Option B: Start Chain Manager Desktop App**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\chain-manager"
npm run electron:dev
```

This will:

- Start Vite dev server on `http://localhost:5174`
- Compile the Electron main process
- Launch the desktop application

### 3. Manual Development Setup (Alternative)

If you prefer to run components separately:

**Terminal 1 - Start POS Manager Web Server:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\pos-manager"
npm run dev
```

**Terminal 2 - Start POS Manager Electron App:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\pos-manager"
npm run electron
```

**Terminal 3 - Start Chain Manager Web Server:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\chain-manager"
npm run dev
```

**Terminal 4 - Start Chain Manager Electron App:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\chain-manager"
npm run electron
```

## 🔧 Available Scripts

### POS Manager Scripts

| Script                   | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `npm run dev`            | Start Vite development server only                       |
| `npm run electron`       | Build and run Electron app (production-like)             |
| `npm run electron:dev`   | **Recommended**: Start both Vite server and Electron app |
| `npm run build`          | Build for production (web + electron main process)       |
| `npm run electron:build` | Build and package desktop installer                      |
| `npm run dist`           | Create distributable installer                           |

### Chain Manager Scripts

| Script                   | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `npm run dev`            | Start Vite development server only                       |
| `npm run electron`       | Build and run Electron app (production-like)             |
| `npm run electron:dev`   | **Recommended**: Start both Vite server and Electron app |
| `npm run build`          | Build for production (web + electron main process)       |
| `npm run electron:build` | Build and package desktop installer                      |
| `npm run dist`           | Create distributable installer                           |

## 🏭 Production Build & Distribution

### 1. Build Desktop Installers

**For POS Manager:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\pos-manager"
npm run dist
```

**For Chain Manager:**

```powershell
cd "c:\Users\ASUS\Desktop\RockPoint\chain-manager"
npm run dist
```

This creates installers in the `dist-electron` folder:

- **Windows**: `.exe` installer (NSIS)
- **macOS**: `.dmg` installer
- **Linux**: `.AppImage` installer

### 2. Install & Run Production Apps

1. Navigate to `dist-electron` folder
2. Run the installer for your platform
3. The desktop app will be installed system-wide

## 🏢 Complete System Architecture

### Development Workflow

```
1. Backend Servers (APIs):
   ├── chain-core (Port 3000) - Main Office Backend
   └── branch-core (Port 3001) - Branch Backend

2. Frontend Applications:
   ├── chain-manager (Port 5174) - Management Desktop App
   └── pos-manager (Port 5173) - POS Desktop App
```

### Running Full System

**Step 1: Start Backend Servers**

```powershell
# Terminal 1 - Chain Core Backend
cd "c:\Users\ASUS\Desktop\RockPoint\chain-core"
npm run dev

# Terminal 2 - Branch Core Backend
cd "c:\Users\ASUS\Desktop\RockPoint\branch-core"
npm run dev
```

**Step 2: Start Desktop Applications**

```powershell
# Terminal 3 - Chain Manager Desktop
cd "c:\Users\ASUS\Desktop\RockPoint\chain-manager"
npm run electron:dev

# Terminal 4 - POS Manager Desktop
cd "c:\Users\ASUS\Desktop\RockPoint\pos-manager"
npm run electron:dev
```

## 🔍 Troubleshooting

### Common Issues

**Issue: "Port already in use"**

```
Solution: Check if another instance is running:
- POS Manager uses port 5173
- Chain Manager uses port 5174
- Kill existing processes or use different ports
```

**Issue: "Electron app opens blank screen"**

```
Solution:
1. Ensure Vite dev server is running first
2. Check console for JavaScript errors
3. Try: npm run build:electron && npm run electron
```

**Issue: "Module not found" errors**

```
Solution:
1. Delete node_modules: rm -rf node_modules
2. Delete package-lock.json
3. Run: npm install
```

### Development Tips

1. **Hot Reload**: Changes to React components will hot-reload in the Electron app
2. **DevTools**: Press `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (Mac) to open DevTools
3. **App Restart**: Changes to `electron.ts` require restarting the Electron app
4. **Debugging**: Use `console.log()` in React code, visible in DevTools

## 🎯 App-Specific Features

### POS Manager Desktop App

- **Full-Screen Mode**: F11 key for cashier-focused interface
- **Touch-Optimized**: Material-UI components optimized for touch screens
- **Offline Support**: Works without internet connection
- **Receipt Printing**: Integration with receipt printers
- **Barcode Scanning**: USB barcode scanner support

### Chain Manager Desktop App

- **Multi-Window Support**: Can open multiple management windows
- **Real-Time Updates**: WebSocket integration for live data
- **Advanced Charts**: Business intelligence dashboards
- **Export Features**: Report generation and data export
- **Admin Panel**: Complete chain management interface

## 🔐 Security Features

- **Context Isolation**: Secure isolation between main and renderer processes
- **Node Integration Disabled**: Web content cannot access Node.js APIs
- **External Link Protection**: External URLs open in default browser
- **Content Security Policy**: Prevents XSS attacks
- **Secure Defaults**: Production-ready security configurations

## 📦 Distribution Strategy

### For Branch Locations (POS Manager)

1. Create installer: `npm run dist`
2. Copy installer to USB drive or network share
3. Install on each POS terminal
4. Configure branch-core backend URL in settings

### For Main Office (Chain Manager)

1. Create installer: `npm run dist`
2. Install on management workstations
3. Configure chain-core backend URL in settings
4. Set up user permissions and access control

---

## 🎉 Success!

You now have both desktop applications configured and ready to run. The POS Manager serves as the cashier interface for branch locations, while the Chain Manager provides comprehensive management tools for the main office.

Both apps are built with modern web technologies but packaged as native desktop applications for better performance, security, and user experience.
