# Branch POS System (Offline-First React + Electron)

This project is a **Point of Sale (POS)** system for managing business branches like **supermarkets, gyms, and children's play centers**.

## 🧠 Overview

Each branch will have:

- A **local server** (Node.js + PostgreSQL) for business logic and data
- Multiple **POS terminals** running this frontend UI
- Optional future integration with **Electron** to package the app into a desktop `.exe`

The system works **offline-first** and communicates with the local branch server over the LAN.

## ⚙️ Tech Stack

| Layer              | Tech                         |
| ------------------ | ---------------------------- |
| UI / POS           | React + TypeScript + Vite    |
| Future Desktop App | Electron (added later)       |
| Backend            | Node.js (Express or FastAPI) |
| Database           | PostgreSQL (per branch)      |
| Sync               | WebSocket + REST (local LAN) |
| Authentication     | Local user roles + PIN codes |

## 🎯 Features (Phase 1)

- Scan products (via barcode or search)
- Real-time price lookup from server
- Add to cart / checkout
- Payment by cash, card, or membership
- Employee clock-in / clock-out
- Role-based access (cashier, manager, admin)
- Works fully offline on local branch server

## 🧱 Project Structure (Web App Phase)

pos-manager/
├── public/
├── src/
│ ├── components/ # Reusable UI components
│ ├── pages/ # POS screens (Checkout, Login, etc.)
│ ├── services/ # API handlers (REST/WebSocket)
│ ├── hooks/ # Custom React hooks
│ ├── utils/ # Utilities (formatting, math, etc.)
│ └── App.tsx
├── electron.ts # Electron entry point (added later)
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md

## 🚀 How to Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Electron wrapper (after Electron is added)
npm run electron
```

## Future Plans:

Electron packaging for offline .exe install
Multi-branch cloud dashboard (via sync)
Local printer & cash drawer support (via Electron IPC)
Support for PayMe / Click / UzCard integrations (Uzbekistan)
Reporting dashboard for branch managers
