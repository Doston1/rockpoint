import { Application } from 'express';
import adminRoutes from './admin';
import licenseRoutes from './license';

export const setupRoutes = (app: Application) => {
  // API routes
  app.use('/api', licenseRoutes);
  app.use('/api/admin', adminRoutes);
  
  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });
};
