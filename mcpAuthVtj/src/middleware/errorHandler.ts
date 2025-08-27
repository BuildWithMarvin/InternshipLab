import { Request, Response, NextFunction } from "express";

export interface ApiError {
  error: string;
  message?: string;
  code?: string;
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("🚨 Server Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  const response: ApiError = {
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  };

  res.status(err.status || 500).json(response);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const response: ApiError = {
    error: "Route not found",
    message: `${req.method} ${req.path} not found`
  };
  
  console.log(`❌ 404 - ${req.method} ${req.path} - IP: ${req.ip}`);
  res.status(404).json(response);
};