import mongoose, { Document, Schema } from 'mongoose';

export interface IUsageLog extends Document {
  _id: mongoose.Types.ObjectId;
  licenseKey: string;
  appType: 'chain-manager' | 'pos-manager' | 'branch-core' | 'chain-core';
  action: 'activated' | 'deactivated' | 'heartbeat' | 'download' | 'error';
  machineId: string;
  computerName?: string;
  ipAddress?: string;
  userAgent?: string;
  version?: string;
  timestamp: Date;
  additionalData?: any;
}

const usageLogSchema = new Schema<IUsageLog>({
  licenseKey: {
    type: String,
    required: true,
    uppercase: true
  },
  appType: {
    type: String,
    required: true,
    enum: ['chain-manager', 'pos-manager', 'branch-core', 'chain-core']
  },
  action: {
    type: String,
    required: true,
    enum: ['activated', 'deactivated', 'heartbeat', 'download', 'error']
  },
  machineId: {
    type: String,
    required: true
  },
  computerName: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  version: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  additionalData: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: false // We're using our own timestamp
});

// Indexes for better performance
usageLogSchema.index({ licenseKey: 1, timestamp: -1 });
usageLogSchema.index({ appType: 1, timestamp: -1 });
usageLogSchema.index({ action: 1, timestamp: -1 });
usageLogSchema.index({ machineId: 1 });

export const UsageLog = mongoose.model<IUsageLog>('UsageLog', usageLogSchema);
