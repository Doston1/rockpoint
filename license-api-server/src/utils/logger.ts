import os from 'os';
import path from 'path';
import winston from 'winston';

// Determine log directory based on environment
const getLogDirectory = (): string => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Use system temp directory or environment variable
    return process.env.LOG_DIR || path.join(os.tmpdir(), 'rockpoint-logs');
  } else {
    // Development: Use project logs directory
    return path.join(process.cwd(), 'logs');
  }
};

const LOG_DIR = getLogDirectory();

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

const transports: winston.transport[] = [
  // Console transport (always present)
  new winston.transports.Console({
    format: consoleFormat
  })
];

// Add file transports only in development or when LOG_DIR is explicitly set
if (process.env.NODE_ENV !== 'production' || process.env.LOG_DIR) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'rockpoint-license-server',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports
});

// Log configuration on startup
logger.info('Logger initialized', {
  logLevel: logger.level,
  logDirectory: LOG_DIR,
  nodeEnv: process.env.NODE_ENV,
  fileLogging: process.env.NODE_ENV !== 'production' || !!process.env.LOG_DIR
});
