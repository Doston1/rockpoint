import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateAdmin } from '../middleware/auth';
import { Customer, License, UsageLog } from '../models';
import { LicenseService } from '../services/LicenseService';
import { logger } from '../utils/logger';

const router = Router();
const licenseService = new LicenseService();

// Admin login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // For now, use environment variables for admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@rockpoint.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
    
    if (email !== adminEmail || password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      { expiresIn: '24h' }
    );
    
    logger.info(`Admin login successful: ${email}`);
    
    res.json({
      success: true,
      token,
      user: { email, role: 'admin' }
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get dashboard statistics
router.get('/dashboard-stats', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const [
      totalCustomers,
      totalLicenses,
      activeLicenses,
      recentActivity
    ] = await Promise.all([
      Customer.countDocuments({ isActive: true }),
      License.countDocuments(),
      License.countDocuments({ isActive: true, expiryDate: { $gt: new Date() } }),
      UsageLog.find()
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('licenseKey')
    ]);
    
    res.json({
      success: true,
      stats: {
        totalCustomers,
        totalLicenses,
        activeLicenses,
        expiredLicenses: totalLicenses - activeLicenses,
        recentActivity
      }
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all customers
router.get('/customers', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const customers = await Customer.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Customer.countDocuments({ isActive: true });
    
    res.json({
      success: true,
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new customer
router.post('/customers', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const customerData = req.body;
    
    const customer = new Customer(customerData);
    await customer.save();
    
    logger.info(`New customer created: ${customer.name} (${customer.email})`);
    
    res.status(201).json({
      success: true,
      customer
    });
  } catch (error) {
    logger.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new license
router.post('/licenses', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      maxBranches,
      maxPOSTerminals,
      features,
      expiryDate
    } = req.body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    const { licenseKey, license } = await licenseService.generateLicense({
      customerId,
      customerName: customer.name,
      maxBranches,
      maxPOSTerminals,
      features,
      expiryDate: new Date(expiryDate)
    });
    
    res.status(201).json({
      success: true,
      licenseKey,
      license
    });
  } catch (error) {
    logger.error('Create license error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all licenses
router.get('/licenses', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const licenses = await License.find()
      .populate('customerId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await License.countDocuments();
    
    res.json({
      success: true,
      licenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get licenses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Deactivate license
router.patch('/licenses/:licenseKey/deactivate', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { licenseKey } = req.params;
    const { reason } = req.body;
    
    const success = await licenseService.deactivateLicense(licenseKey, reason);
    
    if (success) {
      res.json({
        success: true,
        message: 'License deactivated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }
  } catch (error) {
    logger.error('Deactivate license error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get usage statistics
router.get('/usage-stats', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const usage = await UsageLog.aggregate([
      {
        $match: {
          timestamp: { $gte: last30Days }
        }
      },
      {
        $group: {
          _id: {
            licenseKey: '$licenseKey',
            appType: '$appType'
          },
          lastActive: { $max: '$timestamp' },
          totalActivations: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.appType',
          count: { $sum: 1 },
          instances: {
            $push: {
              licenseKey: '$_id.licenseKey',
              lastActive: '$lastActive',
              activations: '$totalActivations'
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      usage
    });
  } catch (error) {
    logger.error('Usage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
