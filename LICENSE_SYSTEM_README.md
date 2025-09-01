# 🚀 RockPoint License Management System

## 📁 Project Structure

```
RockPoint/
├── license-api-server/          # Backend API for license management
├── license-control-panel/       # Your admin control panel (React app)
├── customer-portal/            # Customer download portal (Static HTML)
├── chain-manager/              # Main office management app
├── pos-manager/               # POS terminal app
├── chain-core/               # Main office backend
└── branch-core/              # Branch backend
```

## 🎯 What I've Built For You

### 1. **License API Server** (`license-api-server/`)

**Your backend brain that controls everything:**

- MongoDB database for customers, licenses, and usage tracking
- JWT authentication for admin access
- License generation and validation
- Real-time usage monitoring
- Rate limiting and security
- RESTful API endpoints

**Key Features:**

- Generate unique license keys for customers
- Validate licenses in real-time
- Track software usage (activations, heartbeats)
- Deactivate licenses remotely
- Monitor suspicious activity
- Export usage statistics

### 2. **License Control Panel** (`license-control-panel/`)

**Your master control dashboard:**

- React-based web application
- Material-UI components for professional look
- Real-time statistics and monitoring
- Customer and license management
- Usage analytics and reports

**What You Can Do:**

- 👥 Add new customers
- 🔑 Generate new licenses
- 📊 View real-time usage statistics
- ⚠️ Monitor suspicious activity
- 🚫 Deactivate problematic licenses
- 📈 Track revenue and growth

### 3. **Customer Portal** (`customer-portal/`)

**Customer-facing download page:**

- Clean, professional interface
- License key validation
- Automatic download links
- Usage tracking
- Platform detection (Windows/Mac/Linux)

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
# License API Server
cd license-api-server
npm install

# License Control Panel
cd ../license-control-panel
npm install

# Customer Portal (optional - it's just HTML)
cd ../customer-portal
npm install
```

### 2. Environment Setup

**Copy and configure environment file:**

```bash
cd license-api-server
cp .env.example .env
```

**Edit `.env` file with your settings:**

```env
# Database (Use MongoDB Atlas for cloud)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rockpoint_licenses

# JWT Secret (Generate a strong secret)
JWT_SECRET=your-super-secret-jwt-key-here

# License Secret (Generate a strong secret)
LICENSE_SECRET=your-license-encryption-key-here

# Admin Credentials
ADMIN_EMAIL=your-email@domain.com
ADMIN_PASSWORD=your-secure-password

# AWS for file storage (optional)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_BUCKET_NAME=rockpoint-releases
```

### 3. Database Setup

**Option A: Local MongoDB**

```bash
# Install MongoDB locally
# Start MongoDB service
mongod
```

**Option B: MongoDB Atlas (Recommended)**

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create free cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### 4. Start the System

```bash
# Terminal 1: Start License API Server
cd license-api-server
npm run dev

# Terminal 2: Start License Control Panel
cd license-control-panel
npm run dev

# Terminal 3: Start Customer Portal (optional)
cd customer-portal
npm run dev
```

## 🌐 How to Use

### For You (Admin):

1. **Access Control Panel:** http://localhost:3000
2. **Login with:** Email and password from `.env` file
3. **Add Customers:** Create customer profiles
4. **Generate Licenses:** Set limits and features
5. **Monitor Usage:** See real-time statistics
6. **Manage Licenses:** Deactivate or extend as needed

### For Your Customers:

1. **Visit:** Your customer portal (you'll deploy this)
2. **Enter License Key:** The key you generated for them
3. **Download Software:** Automatic platform detection
4. **Install & Use:** Software validates with your server

## 🔐 Security Features

### License Protection:

- Unique license keys per customer
- Machine fingerprinting (prevents copying)
- Usage limits (max branches, POS terminals)
- Expiry dates
- Remote deactivation capability

### API Security:

- Rate limiting (prevents spam/attacks)
- JWT authentication for admin access
- Input validation and sanitization
- CORS protection
- Request logging and monitoring

### Monitoring:

- Real-time usage tracking
- Suspicious activity detection
- License violation alerts
- Usage analytics and reporting

## 📊 Monitoring & Analytics

### Dashboard Shows:

- **License Statistics:** Total, active, expired licenses
- **Usage Metrics:** Active installations by type
- **Revenue Tracking:** Monthly license sales
- **Security Alerts:** Suspicious license usage
- **Customer Activity:** Last seen, activation counts

### Alerts For:

- Multiple activations from same license
- Installations exceeding license limits
- Expired license usage attempts
- Unusual geographic activity

## 🚀 Deployment Strategy

### Development (Local):

1. Run all services locally
2. Use local MongoDB or MongoDB Atlas
3. Test license generation and validation

### Production:

1. **Deploy API Server:** Heroku, AWS, or VPS
2. **Deploy Control Panel:** Netlify, Vercel, or your hosting
3. **Deploy Customer Portal:** Any web hosting
4. **Database:** MongoDB Atlas (cloud)
5. **File Storage:** AWS S3 for installers

### Environment Setup:

```bash
# Production environment variables
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=production-secret
CORS_ORIGIN=https://your-control-panel.com
```

## 🔄 Integration with Your Apps

### In Your Chain-Manager/POS-Manager Apps:

```javascript
// On app startup, validate license
const response = await fetch("https://your-api.com/api/activate-license", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    licenseKey: "XXXX-XXXX-XXXX-XXXX",
    appType: "chain-manager",
    machineId: getMachineId(),
    computerName: getComputerName(),
  }),
});

if (response.data.success) {
  // License valid, start app
  startApplication(response.data.permissions);
} else {
  // Show license error
  showLicenseError(response.data.reason);
}
```

## 📈 Business Benefits

### For You:

- **Complete Control:** Monitor all installations globally
- **Revenue Protection:** Prevent piracy and unauthorized use
- **Customer Insights:** Understand usage patterns
- **Remote Management:** No need to visit customers
- **Scalable Business:** Handle thousands of customers remotely

### For Customers:

- **Easy Downloads:** Simple license key entry
- **Automatic Updates:** Push updates remotely
- **Professional Experience:** Polished download portal
- **Quick Support:** You can diagnose issues remotely

## 🔧 Customization

### Branding:

- Update colors, logos, and text in React components
- Customize email templates for notifications
- White-label the customer portal

### Features:

- Add more license types (trial, premium, enterprise)
- Implement A/B testing for features
- Add customer communication tools
- Integrate payment processing

### Analytics:

- Add Google Analytics tracking
- Implement custom metrics
- Create detailed revenue reports
- Add customer feedback collection

## 🆘 Troubleshooting

### Common Issues:

**License validation fails:**

- Check internet connection
- Verify API server is running
- Check MongoDB connection
- Review server logs

**Control panel won't load:**

- Check if API server is running on port 3002
- Verify proxy configuration in vite.config.ts
- Check browser console for errors

**Database connection issues:**

- Verify MongoDB URI in .env
- Check MongoDB Atlas network access
- Ensure database user has correct permissions

## 📞 Support

This system gives you:

- **Global Control:** Monitor worldwide from your computer
- **Revenue Protection:** Prevent unauthorized copying
- **Customer Management:** Handle all customers remotely
- **Business Intelligence:** Understand your market
- **Professional Image:** Polished customer experience

You now have a complete commercial software licensing system that you can manage from Country X while serving customers in Country Y!

## 🎯 Next Steps

1. **Setup Database:** Create MongoDB Atlas account
2. **Configure Environment:** Update .env with your settings
3. **Test Locally:** Generate first license and test validation
4. **Deploy to Production:** Choose hosting providers
5. **Integrate with Apps:** Add license validation to your software
6. **Launch Customer Portal:** Give customers download access

Your software business is now enterprise-ready! 🚀
