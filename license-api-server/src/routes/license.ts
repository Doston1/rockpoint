import { Request, Response, Router } from 'express';
import { LicenseService } from '../services/LicenseService';
import { logger } from '../utils/logger';

const router = Router();
const licenseService = new LicenseService();

// Validate license for downloads
router.post('/validate-license', async (req: Request, res: Response) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        message: 'License key is required'
      });
    }

    const validation = await licenseService.validateLicense(licenseKey);
    
    if (validation.valid) {
      res.json({
        success: true,
        valid: true,
        permissions: validation.permissions
      });
    } else {
      res.status(403).json({
        success: false,
        valid: false,
        reason: validation.reason
      });
    }
  } catch (error) {
    logger.error('License validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Activate license for app startup
router.post('/activate-license', async (req: Request, res: Response) => {
  try {
    const { licenseKey, appType, machineId, computerName } = req.body;
    
    if (!licenseKey || !appType || !machineId) {
      return res.status(400).json({
        success: false,
        message: 'License key, app type, and machine ID are required'
      });
    }

    const validation = await licenseService.validateLicense(licenseKey, appType, machineId);
    
    if (validation.valid) {
      // Track activation
      await licenseService.trackUsage(licenseKey, appType, 'activated', machineId, {
        computerName,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        sessionToken: validation.sessionToken,
        permissions: validation.permissions
      });
    } else {
      res.status(403).json({
        success: false,
        reason: validation.reason
      });
    }
  } catch (error) {
    logger.error('License activation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Heartbeat for active licenses
router.post('/license-heartbeat', async (req: Request, res: Response) => {
  try {
    const { sessionToken, machineId, appType } = req.body;
    
    if (!sessionToken || !machineId) {
      return res.status(400).json({
        success: false,
        message: 'Session token and machine ID are required'
      });
    }

    // Here you would verify the session token and extract license info
    // For now, we'll assume it's valid and track the heartbeat
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
