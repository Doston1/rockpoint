import { NextFunction, Request, Response } from 'express';

interface AppError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode < 500 ? 'fail' : 'error';
  error.isOperational = true;
  return error;
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: AppError = { ...err };
  error.message = err.message;

  // Log error
  console.error('❌ Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = createError(message, 404);
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = createError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = createError(message, 400);
  }

  // PostgreSQL errors
  if (err.name === 'PostgresError' || (err as any).code) {
    switch ((err as any).code) {
      case '23505': // Unique violation
        error = createError('Duplicate entry', 409);
        break;
      case '23503': // Foreign key violation
        error = createError('Referenced record not found', 400);
        break;
      case '23502': // Not null violation
        error = createError('Required field missing', 400);
        break;
      case '42P01': // Undefined table
        error = createError('Database table not found', 500);
        break;
      default:
        error = createError('Database error', 500);
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = createError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = createError('Token expired', 401);
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const message = (err as any).errors
      .map((e: any) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    error = createError(`Validation error: ${message}`, 400);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
