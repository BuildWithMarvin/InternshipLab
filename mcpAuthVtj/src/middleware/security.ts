// src/middleware/errorHandler.ts
// src/middleware/security.ts
import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";

// CORS Konfiguration
export const corsMiddleware = cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});

// Helmet Sicherheits-Headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
});

// Request Logging Middleware
export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const { method, path, ip } = req;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  console.log(`📝 ${timestamp} - ${method} ${path} - IP: ${ip} - UA: ${userAgent.substring(0, 50)}...`);
  
  next();
};