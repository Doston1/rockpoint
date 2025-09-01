import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  company: string;
  phone?: string;
  address?: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  notes?: string;
}

const customerSchema = new Schema<ICustomer>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
