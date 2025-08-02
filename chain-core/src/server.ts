import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';

// Import managers and services
import { DatabaseManager } from './database/manager';
import { OneCIntegration } from './integrations/OneCIntegration';
import { RedisManager } from './services/redis';
import { SyncScheduler } from './services/SyncScheduler';
import { WebSocketManager } from './services/websocket';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';

// Import API routes
import oneCRoutes from './api/1c';
import oneCIntegrationRoutes from './api/1c-integration';
import authRoutes from './api/auth';
import branchesRoutes from './api/branches';
import dashboardRoutes from './api/dashboard';
import employeesRoutes from './api/employees';
import inventoryRoutes from './api/inventory';
import productsRoutes from './api/products';
import reportsRoutes from './api/reports';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001; // Chain server runs on port 3001
const NODE_ENV = process.env.NODE_ENV || 'development';

class ChainServer {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private wsServer: WebSocketServer;
  private wsManager: WebSocketManager;
  private oneCIntegration: OneCIntegration;
  private syncScheduler: SyncScheduler;
  private redisManager: RedisManager;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wsServer = new WebSocketServer({ 
      server: this.httpServer,
      path: process.env.WS_PATH || '/ws'
    });
    this.wsManager = WebSocketManager.getInstance(this.httpServer);
    this.oneCIntegration = OneCIntegration.getInstance();
    this.syncScheduler = SyncScheduler.getInstance();
    this.redisManager = RedisManager.getInstance();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration for chain managers and branches
    this.app.use(cors({
      origin: NODE_ENV === 'development' 
        ? ['http://localhost:5174', 'http://localhost:3000', 'http://localhost:5173']
        : process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb' }));
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
        environment: NODE_ENV,
        services: {
          database: 'connected',
          redis: 'connected',
          websocket: 'running',
          oneC: this.oneCIntegration.getStatus()
        }
      });
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/branches', branchesRoutes);
    this.app.use('/api/employees', employeesRoutes);
    this.app.use('/api/products', productsRoutes);
    this.app.use('/api/inventory', inventoryRoutes);
    this.app.use('/api/reports', reportsRoutes);
    this.app.use('/api/1c', oneCRoutes);
    this.app.use('/api/1c-integration', oneCIntegrationRoutes); // New comprehensive 1C API
    this.app.use('/api/dashboard', dashboardRoutes);

    // Serve static files (uploads, exports, etc.)
    this.app.use('/static', express.static('uploads'));
    this.app.use('/exports', express.static('exports'));

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
        message: 'RockPoint Chain Core Server',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          api: '/api',
          websocket: process.env.WS_PATH || '/ws'
        }
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

      // Initialize 1C integration
      console.log('🔌 Initializing 1C integration...');
      await this.oneCIntegration.initialize();
      console.log('✅ 1C integration initialized');

      // Start HTTP server
      this.httpServer.listen(PORT, () => {
        console.log(`🚀 Chain Core Server running on port ${PORT}`);
        console.log(`🌐 Environment: ${NODE_ENV}`);
        console.log(`🔗 WebSocket server running on same port at ${process.env.WS_PATH || '/ws'}`);
      });

      // Initialize WebSocket manager
      this.wsManager.initialize();
      console.log('✅ WebSocket server initialized');

      // Start sync scheduler
      this.syncScheduler.start();
      console.log('✅ Sync scheduler started');

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n🛑 Graceful shutdown initiated (${signal})`);

    try {
      // Stop sync scheduler
      this.syncScheduler.stop();
      console.log('✅ Sync scheduler stopped');

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

      // Close 1C integration
      await this.oneCIntegration.close();
      console.log('✅ 1C integration closed');

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
const server = new ChainServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default server;
