import mongoose, { Document, Schema } from 'mongoose';

export interface ISoftwareRelease extends Document {
  _id: mongoose.Types.ObjectId;
  appType: 'chain-manager' | 'pos-manager' | 'branch-core' | 'chain-core';
  version: string;
  platform: 'windows' | 'mac' | 'linux';
  downloadUrl: string;
  fileSize: number;
  checksum: string;
  releaseNotes: string;
  isStable: boolean;
  isLatest: boolean;
  requiredLicenseFeatures: string[];
  createdAt: Date;
  createdBy: string;
}

const softwareReleaseSchema = new Schema<ISoftwareRelease>({
  appType: {
    type: String,
    required: true,
    enum: ['chain-manager', 'pos-manager', 'branch-core', 'chain-core']
  },
  version: {
    type: String,
    required: true,
    trim: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['windows', 'mac', 'linux']
  },
  downloadUrl: {
    type: String,
    required: true,
    trim: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  checksum: {
    type: String,
    required: true,
    trim: true
  },
  releaseNotes: {
    type: String,
    required: true,
    trim: true
  },
  isStable: {
    type: Boolean,
    default: true
  },
  isLatest: {
    type: Boolean,
    default: false
  },
  requiredLicenseFeatures: [{
    type: String
  }],
  createdBy: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
softwareReleaseSchema.index({ appType: 1, platform: 1, version: -1 });
softwareReleaseSchema.index({ isLatest: 1 });

export const SoftwareRelease = mongoose.model<ISoftwareRelease>('SoftwareRelease', softwareReleaseSchema);
