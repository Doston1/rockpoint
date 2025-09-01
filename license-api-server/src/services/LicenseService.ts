import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { Customer, ILicense, License, UsageLog } from '../models';
import { logger } from '../utils/logger';

export interface LicenseData {
  customerId: string;
  customerName: string;
  maxBranches: number;
  maxPOSTerminals: number;
  features: string[];
  expiryDate: Date;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  license?: ILicense;
  sessionToken?: string;
  permissions?: string[];
}

export interface UsageStats {
  chainManagers: number;
  branches: number;
  posTerminals: number;
  lastActiveDevices: any[];
}

export class LicenseService {
  private secret: string;

  constructor() {
    this.secret = process.env.LICENSE_SECRET || 'your-license-encryption-key-change-in-production';
  }

  async generateLicense(customerData: LicenseData): Promise<{ licenseKey: string; license: ILicense }> {
    try {
      // Create license key
      const licenseKey = this.createLicenseKey(customerData);
      
      // Create license document
      const license = new License({
        licenseKey,
        customerId: customerData.customerId,
        features: customerData.features,
        maxBranches: customerData.maxBranches,
        maxPOSTerminals: customerData.maxPOSTerminals,
        expiryDate: customerData.expiryDate,
        isActive: true,
        version: '1.0.0'
      });

      await license.save();
      
      logger.info(`License generated for customer ${customerData.customerName}: ${licenseKey}`);
      
      return { licenseKey, license };
    } catch (error) {
      logger.error('Error generating license:', error);
      throw error;
    }
  }

  private createLicenseKey(data: LicenseData): string {
    // Create a unique identifier
    const identifier = `${data.customerId}-${Date.now()}-${Math.random()}`;
    const hash = createHash('sha256').update(identifier).digest('hex');
    
    // Format as license key: XXXX-XXXX-XXXX-XXXX
    const key = hash.substring(0, 16).toUpperCase();
    return `${key.substring(0,4)}-${key.substring(4,8)}-${key.substring(8,12)}-${key.substring(12,16)}`;
  }

  async validateLicense(
    licenseKey: string, 
    appType?: string, 
    machineId?: string
  ): Promise<ValidationResult> {
    try {
      // Get license from database
      const license = await License.findOne({ licenseKey }).populate('customerId');
      
      if (!license) {
        return { valid: false, reason: 'License not found' };
      }

      if (!license.isActive) {
        return { valid: false, reason: 'License is deactivated' };
      }

      // Check expiry
      if (new Date() > license.expiryDate) {
        return { valid: false, reason: 'License expired' };
      }

      // Check usage limits if appType is provided
      if (appType && machineId) {
        const usage = await this.getCurrentUsage(licenseKey);
        
        if (appType === 'chain-manager' && usage.chainManagers >= 1) {
          return { valid: false, reason: 'Chain manager already active' };
        }

        if (appType === 'branch-core' && usage.branches >= license.maxBranches) {
          return { valid: false, reason: 'Maximum branches exceeded' };
        }

        if (appType === 'pos-manager' && usage.posTerminals >= license.maxPOSTerminals) {
          return { valid: false, reason: 'Maximum POS terminals exceeded' };
        }
      }

      // Update last validated timestamp
      license.lastValidated = new Date();
      await license.save();

      // Generate session token if machine ID is provided
      let sessionToken;
      if (machineId) {
        sessionToken = this.generateSessionToken(license, machineId);
      }

      return {
        valid: true,
        license,
        sessionToken,
        permissions: license.features
      };

    } catch (error) {
      logger.error('License validation error:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  private generateSessionToken(license: ILicense, machineId: string): string {
    return jwt.sign({
      licenseKey: license.licenseKey,
      customerId: license.customerId,
      machineId,
      permissions: license.features,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }, this.secret);
  }

  async trackUsage(
    licenseKey: string, 
    appType: string, 
    action: string,
    machineId: string,
    additionalData?: any
  ): Promise<void> {
    try {
      const usageLog = new UsageLog({
        licenseKey,
        appType,
        action,
        machineId,
        additionalData: {
          ...additionalData,
          timestamp: new Date()
        }
      });

      await usageLog.save();
    } catch (error) {
      logger.error('Error tracking usage:', error);
    }
  }

  async getCurrentUsage(licenseKey: string): Promise<UsageStats> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Get active devices from last 24 hours
      const recentActivity = await UsageLog.aggregate([
        {
          $match: {
            licenseKey,
            timestamp: { $gte: last24Hours },
            action: { $in: ['activated', 'heartbeat'] }
          }
        },
        {
          $group: {
            _id: {
              appType: '$appType',
              machineId: '$machineId'
            },
            lastActivity: { $max: '$timestamp' },
            computerName: { $last: '$computerName' }
          }
        }
      ]);

      // Count by app type
      const stats: UsageStats = {
        chainManagers: 0,
        branches: 0,
        posTerminals: 0,
        lastActiveDevices: recentActivity
      };

      recentActivity.forEach(device => {
        switch (device._id.appType) {
          case 'chain-manager':
            stats.chainManagers++;
            break;
          case 'branch-core':
            stats.branches++;
            break;
          case 'pos-manager':
            stats.posTerminals++;
            break;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      return {
        chainManagers: 0,
        branches: 0,
        posTerminals: 0,
        lastActiveDevices: []
      };
    }
  }

  async deactivateLicense(licenseKey: string, reason?: string): Promise<boolean> {
    try {
      const license = await License.findOne({ licenseKey });
      if (!license) {
        return false;
      }

      license.isActive = false;
      if (reason) {
        license.notes = `Deactivated: ${reason}`;
      }
      await license.save();

      logger.info(`License deactivated: ${licenseKey} - ${reason || 'No reason provided'}`);
      return true;
    } catch (error) {
      logger.error('Error deactivating license:', error);
      return false;
    }
  }

  async extendLicense(licenseKey: string, newExpiryDate: Date): Promise<boolean> {
    try {
      const license = await License.findOne({ licenseKey });
      if (!license) {
        return false;
      }

      license.expiryDate = newExpiryDate;
      await license.save();

      logger.info(`License extended: ${licenseKey} - New expiry: ${newExpiryDate}`);
      return true;
    } catch (error) {
      logger.error('Error extending license:', error);
      return false;
    }
  }
}
