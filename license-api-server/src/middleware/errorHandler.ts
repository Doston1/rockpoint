import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Default error
  let error = {
    success: false,
    message: 'Internal Server Error'
  };

  // Validation error
  if (err.name === 'ValidationError') {
    error.message = Object.values(err.errors).map((val: any) => val.message).join(', ');
  }

  // Duplicate key error
  if (err.code === 11000) {
    error.message = 'Duplicate field value entered';
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
  }

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json(error);
};
