# 🚀 Vercel Deployment Guide - RockPoint License System

## Overview

**✅ Can Deploy to Vercel:**

- `license-control-panel` (React Admin Dashboard)
- `customer-portal` (Static HTML)

**❌ Cannot Deploy to Vercel:**

- `license-api-server` (Node.js API - needs persistent backend)

## 📋 Deployment Strategy

### Option 1: Hybrid Deployment (Recommended)

```
┌─ Vercel (Frontend) ─────────────┐    ┌─ Railway/Render (Backend) ─┐
│ • license-control-panel         │────│ • license-api-server        │
│ • customer-portal               │    │ • MongoDB Database          │
└─────────────────────────────────┘    └─────────────────────────────┘
```

## 🛠️ Step-by-Step Deployment

### 1. Deploy React Control Panel to Vercel

#### Prerequisites

- GitHub repository with your code
- Vercel account

#### Steps:

1. **Push to GitHub** (if not already done)

```bash
cd license-control-panel
git add .
git commit -m "Add license control panel"
git push origin main
```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Select `license-control-panel` folder
   - Configure environment variables:

```env
VITE_API_BASE_URL=https://your-api-server.railway.app
```

3. **Vercel Configuration** (already created as `vercel.json`)

```json
{
  "name": "rockpoint-license-dashboard",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### 2. Deploy Customer Portal to Vercel

#### Option A: Separate Vercel Project

1. Create new Vercel project
2. Import `customer-portal` folder
3. Deploy as static site

#### Option B: Subdomain of Control Panel

1. Copy `customer-portal/index.html` to `license-control-panel/public/portal.html`
2. Access via: `https://your-dashboard.vercel.app/portal.html`

### 3. Deploy API Server (Backend)

#### ⚠️ **Important: Vercel CANNOT host the API server**

**Why?**

- Vercel is for serverless functions (max 15-second execution)
- License API needs persistent MongoDB connections
- Requires background processes and file system access

#### **Recommended Backend Platforms:**

##### Option A: Railway.app (Easiest)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and deploy
cd license-api-server
railway login
railway init
railway up
```

**Environment Variables for Railway:**

```env
MONGODB_URI=mongodb://mongo:27017/rockpoint_licenses
NODE_ENV=production
PORT=3002
JWT_SECRET=your-super-secret-key-here
LOG_LEVEL=info
```

##### Option B: Render.com

1. Connect GitHub repository
2. Select `license-api-server` folder
3. Configure as "Web Service"
4. Add environment variables

##### Option C: DigitalOcean App Platform

1. Create new app from GitHub
2. Select Node.js service
3. Configure build/run commands

## 🔧 Configuration for Production

### Update API URLs in React App

The React app is already configured to use environment variables:

**Local Development:**

```env
# .env.local
VITE_API_BASE_URL=http://localhost:3002
```

**Production (Vercel Environment Variables):**

```env
VITE_API_BASE_URL=https://your-backend.railway.app
```

### Update Customer Portal API URL

Edit `customer-portal/index.html` and update the API endpoint:

```javascript
// Change this line:
const API_BASE_URL = "http://localhost:3002";

// To your production API:
const API_BASE_URL = "https://your-backend.railway.app";
```

## 📱 Final URLs Structure

After deployment:

```
┌─ Frontend (Vercel) ─────────────────────────────────┐
│ • Admin Dashboard: https://license-admin.vercel.app │
│ • Customer Portal: https://license-portal.vercel.app│
└─────────────────────────────────────────────────────┘
┌─ Backend (Railway) ─────────────────────────────────┐
│ • API Server: https://license-api.railway.app       │
│ • Database: Internal MongoDB                        │
└─────────────────────────────────────────────────────┘
```

## 🚨 Pre-Deployment Checklist

### Frontend (Vercel Ready ✅)

- [x] React app builds successfully
- [x] Environment variables configured
- [x] `vercel.json` configuration files created
- [x] API endpoints use dynamic URLs
- [x] No hardcoded localhost URLs

### Backend (Needs External Platform)

- [ ] Choose backend platform (Railway/Render/DigitalOcean)
- [ ] Set up MongoDB database
- [ ] Configure environment variables
- [ ] Update CORS settings for production domains
- [ ] Set up SSL/HTTPS

## 💡 Alternative: All-in-One Platforms

If you want everything on one platform:

### Vercel Alternatives for Full-Stack:

1. **Netlify** - Can host both frontend and serverless functions
2. **Railway** - Can host both React app and Node.js API
3. **Render** - Full-stack hosting with free tier
4. **Heroku** - Classic full-stack platform

### Quick Railway Full-Stack Deployment:

```bash
# Deploy entire project to Railway
cd RockPoint
railway init
railway up

# Railway will auto-detect and deploy:
# - license-api-server as Node.js service
# - license-control-panel as React static site
# - Provision MongoDB automatically
```

## 🎯 Recommended Approach

**For simplicity and cost-effectiveness:**

1. **API Server** → Railway.app (Free tier available)
2. **React Dashboard** → Vercel (Free tier, excellent performance)
3. **Customer Portal** → Vercel (Same deployment)
4. **Database** → Railway MongoDB or MongoDB Atlas

This gives you professional-grade hosting with minimal cost and maximum performance! 🚀
