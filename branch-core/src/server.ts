import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import { WebSocketServer } from 'ws';

// Change these imports to relative paths (remove @/)
import { DatabaseManager } from './database/manager';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { RedisManager } from './services/redis';
import { WebSocketManager } from './services/websocket';

// Import API routes
import adminRoutes from './api/admin';
import authRoutes from './api/auth';
import chainCoreRoutes from './api/chain-core';
import clickPassRoutes from './api/click-pass/click-pass';
import employeesRoutes from './api/employees';
import networkRoutes from './api/network';
import paymeQRRoutes from './api/payme-qr/payme-qr';
import paymentMethodsRoutes from './api/payment-methods';
import productsRoutes from './api/products';
import reportsRoutes from './api/reports';
import syncRoutes from './api/sync';
import transactionsRoutes from './api/transactions';
import fastpayRoutes from './api/uzum-bank/fastpay';

// Import authentication middleware
import { authenticateApiKey } from './middleware/auth';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000; // Branch server runs on port 3000
const NODE_ENV = process.env.NODE_ENV || 'development';

class BranchServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private wsServer: WebSocketServer;
  private wsManager: WebSocketManager;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wsServer = new WebSocketServer({ 
      server: this.httpServer,
      path: process.env.WS_PATH || '/ws'
    });
    this.wsManager = new WebSocketManager(this.wsServer);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration for POS terminals
    this.app.use(cors({
      origin: NODE_ENV === 'development' 
        ? ['http://localhost:5173', 'http://localhost:3000']
        : process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    this.app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
    this.app.use(requestLogger);

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        branchId: process.env.BRANCH_ID,
        environment: NODE_ENV
      });
    });
  }

  private setupRoutes(): void {
    // API health check endpoint (protected - requires API key authentication)
    this.app.get('/api/health', authenticateApiKey, (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        branchId: process.env.BRANCH_ID,
        environment: NODE_ENV,
        service: 'branch-core',
        authenticated: true,
        api_key_name: req.apiKey?.name
      });
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/chain-core', chainCoreRoutes);
    this.app.use('/api/products', productsRoutes);
    this.app.use('/api/transactions', transactionsRoutes);
    this.app.use('/api/employees', employeesRoutes);
    this.app.use('/api/reports', reportsRoutes);
    this.app.use('/api/sync', syncRoutes);
    this.app.use('/api/network', networkRoutes);
    this.app.use('/api/payment-methods', paymentMethodsRoutes);
    this.app.use('/api/payments/fastpay', fastpayRoutes);
    this.app.use('/api/payments/click-pass', clickPassRoutes);
    this.app.use('/api/payments/payme-qr', paymeQRRoutes);

    // Serve static files (receipts, images, etc.)
    this.app.use('/static', express.static('uploads'));
    this.app.use('/uploads', express.static('uploads')); // Direct access to uploaded images

    // 404 handler for API routes
    this.app.use('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `API endpoint ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Root route
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'RockPoint Branch Core Server',
        version: process.env.npm_package_version || '1.0.0',
        branchId: process.env.BRANCH_ID,
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(errorHandler);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('SIGTERM received');
      this.gracefulShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received');
      this.gracefulShutdown('SIGINT');
    });
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      console.log('🔌 Connecting to database...');
      await DatabaseManager.initialize();
      console.log('✅ Database connected');

      // Initialize Redis connection
      console.log('🔌 Connecting to Redis...');
      await RedisManager.initialize();
      console.log('✅ Redis connected');

      // Start HTTP server
      this.httpServer.listen(PORT, () => {
        console.log(`🚀 Branch Core Server running on port ${PORT}`);
        console.log(`🌐 Environment: ${NODE_ENV}`);
        console.log(`🏪 Branch ID: ${process.env.BRANCH_ID}`);
        console.log(`🔗 WebSocket server running on same port at ${process.env.WS_PATH || '/ws'}`);
      });

      // Initialize WebSocket manager
      this.wsManager.initialize();
      console.log('✅ WebSocket server initialized');

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n🛑 Graceful shutdown initiated (${signal})`);

    try {
      // Close WebSocket connections
      this.wsManager.closeAll();
      console.log('✅ WebSocket connections closed');

      // Close HTTP server
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          console.log('✅ HTTP server closed');
          resolve();
        });
      });

      // Close database connection
      await DatabaseManager.close();
      console.log('✅ Database connection closed');

      // Close Redis connection
      await RedisManager.close();
      console.log('✅ Redis connection closed');

      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new BranchServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default server;
