import { Application } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ success: false, message });
    }
  });
};

export const setupMiddleware = (app: Application) => {
  // General rate limiting
  app.use('/api', createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests from this IP, please try again later.'
  ));

  // Stricter rate limiting for license validation
  app.use('/api/validate-license', createRateLimiter(
    60 * 1000, // 1 minute
    10, // limit each IP to 10 requests per minute
    'Too many license validation attempts, please try again later.'
  ));

  // Even stricter for admin login
  app.use('/api/auth/login', createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 requests per 15 minutes
    'Too many login attempts, please try again later.'
  ));

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    next();
  });
};
