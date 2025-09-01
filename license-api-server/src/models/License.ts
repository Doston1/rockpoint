import mongoose, { Document, Schema } from 'mongoose';

export interface ILicense extends Document {
  _id: mongoose.Types.ObjectId;
  licenseKey: string;
  customerId: mongoose.Types.ObjectId;
  features: string[];
  maxBranches: number;
  maxPOSTerminals: number;
  expiryDate: Date;
  isActive: boolean;
  generatedAt: Date;
  lastValidated?: Date;
  version: string;
  notes?: string;
}

const licenseSchema = new Schema<ILicense>({
  licenseKey: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  features: [{
    type: String,
    enum: ['inventory', 'analytics', 'reporting', 'multi-branch', 'advanced-pos', 'api-access', 'cloud-sync']
  }],
  maxBranches: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  maxPOSTerminals: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  expiryDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  lastValidated: {
    type: Date
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
licenseSchema.index({ licenseKey: 1 });
licenseSchema.index({ customerId: 1 });
licenseSchema.index({ expiryDate: 1 });
licenseSchema.index({ isActive: 1 });

export const License = mongoose.model<ILicense>('License', licenseSchema);
