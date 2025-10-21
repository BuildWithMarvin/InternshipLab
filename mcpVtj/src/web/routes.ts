// Web API Routes for VTJ Authentication Server

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { login as vtjLogin } from '../api/vtjClient.js';
import { encryptToken, createTokenPayload } from '../auth/tokenManager.js';
import { validateToken as validateTokenData } from '../auth/sessionStore.js';
import {
  validateLoginRequest,
  validateToken,
  sanitizeErrorMessage
} from './validation.js';

/**
 * Server URL for login links
 */
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

/**
 * API Response Types
 */
interface SuccessResponse {
  success: true;
  token?: string;
  message: string;
  data?: any;
}

interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  help?: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

/**
 * Rate Limiter for Login Attempts
 * Max 5 attempts per minute per IP
 */
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per windowMs
  message: {
    success: false,
    error: 'rate_limit_exceeded',
    message: 'Too many login attempts. Please try again later.',
    help: 'Maximum 5 login attempts per minute allowed.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    console.log(`[API] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'rate_limit_exceeded',
      message: 'Too many login attempts. Please try again later.',
      help: 'Maximum 5 login attempts per minute allowed.'
    });
  }
});

/**
 * Rate Limiter for Token Validation
 * Max 20 attempts per minute per IP
 */
const validateTokenRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per windowMs
  message: {
    success: false,
    error: 'rate_limit_exceeded',
    message: 'Too many validation requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Creates Express router for Web API endpoints
 */
export function createWebApiRouter(): Router {
  const router = Router();

  /**
   * POST /api/login
   * Authenticates user with VTJ credentials and returns encrypted token
   */
  router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
    console.log(`[API] Login request from IP: ${req.ip}`);

    try {
      // Validate request body
      const validation = validateLoginRequest(req.body);

      if (!validation.valid) {
        console.log(`[API] Login validation failed: ${validation.error}`);
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'validation_error',
          message: validation.error || 'Invalid request data'
        };
        return res.status(400).json(errorResponse);
      }

      const { username, password } = validation.data!;

      // Attempt VTJ login
      try {
        console.log(`[API] Attempting VTJ login for user: ${username}`);
        const loginResponse = await vtjLogin(username, password);

        console.log(`[API] VTJ login successful for user: ${username}`);

        // Create token payload
        const tokenPayload = createTokenPayload(
          loginResponse.sessionId,
          loginResponse.depotId
        );

        // Encrypt token
        const encryptedToken = encryptToken(tokenPayload);

        console.log(`[API] Token generated for user: ${username}`);

        // Success response
        const successResponse: SuccessResponse = {
          success: true,
          token: encryptedToken,
          message: 'Login successful'
        };

        return res.status(200).json(successResponse);
      } catch (loginError) {
        // Handle VTJ API errors
        console.error(`[API] VTJ login failed for user ${username}:`, loginError);

        const errorMessage = loginError instanceof Error ? loginError.message : 'Login failed';

        // Check for specific error types
        let error = 'authentication_failed';
        let message = 'Invalid username or password';
        let statusCode = 401;

        if (errorMessage.includes('No response from server')) {
          error = 'service_unavailable';
          message = 'VTJ service is currently unavailable. Please try again later.';
          statusCode = 503;
        } else if (errorMessage.includes('timeout')) {
          error = 'timeout';
          message = 'Login request timed out. Please try again.';
          statusCode = 504;
        } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          error = 'invalid_credentials';
          message = 'Invalid username or password';
          statusCode = 401;
        }

        const errorResponse: ErrorResponse = {
          success: false,
          error,
          message
        };

        return res.status(statusCode).json(errorResponse);
      }
    } catch (error) {
      // Handle unexpected errors
      console.error('[API] Unexpected error in login handler:', error);

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'internal_error',
        message: 'An unexpected error occurred. Please try again later.'
      };

      return res.status(500).json(errorResponse);
    }
  });

  /**
   * POST /api/validate-token
   * Validates an encrypted token
   */
  router.post('/validate-token', validateTokenRateLimiter, async (req: Request, res: Response) => {
    console.log(`[API] Token validation request from IP: ${req.ip}`);

    try {
      // Validate token input
      const validation = validateToken(req.body.token);

      if (!validation.valid) {
        console.log(`[API] Token validation failed: ${validation.error}`);
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'invalid_token',
          message: validation.error || 'Invalid token format',
          help: `Get a new token at ${SERVER_URL}`
        };
        return res.status(400).json(errorResponse);
      }

      const token = validation.sanitized!;

      // Validate token
      try {
        const isValid = validateTokenData(token);

        if (isValid) {
          console.log('[API] Token is valid');
          const successResponse: SuccessResponse = {
            success: true,
            message: 'Token is valid',
            data: {
              valid: true
            }
          };
          return res.status(200).json(successResponse);
        } else {
          console.log('[API] Token is invalid or expired');
          const errorResponse: ErrorResponse = {
            success: false,
            error: 'invalid_token',
            message: 'Token is invalid or has expired',
            help: `Get a new token at ${SERVER_URL}`
          };
          return res.status(401).json(errorResponse);
        }
      } catch (validationError) {
        console.error('[API] Token validation error:', validationError);

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'validation_error',
          message: sanitizeErrorMessage(validationError),
          help: `Get a new token at ${SERVER_URL}`
        };

        return res.status(401).json(errorResponse);
      }
    } catch (error) {
      // Handle unexpected errors
      console.error('[API] Unexpected error in validate-token handler:', error);

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'internal_error',
        message: 'An unexpected error occurred. Please try again later.'
      };

      return res.status(500).json(errorResponse);
    }
  });

  /**
   * GET /api/status
   * Health check endpoint for server status
   */
  router.get('/status', (_req: Request, res: Response) => {
    const successResponse: SuccessResponse = {
      success: true,
      message: 'Server is running',
      data: {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      }
    };

    return res.status(200).json(successResponse);
  });

  /**
   * GET /api/info
   * Returns API information and endpoints
   */
  router.get('/info', (_req: Request, res: Response) => {
    const successResponse: SuccessResponse = {
      success: true,
      message: 'API information',
      data: {
        name: 'VTJ Authentication API',
        version: '1.0.0',
        endpoints: {
          login: {
            method: 'POST',
            path: '/api/login',
            description: 'Authenticate with VTJ credentials',
            rateLimit: '5 requests per minute',
            body: {
              username: 'string (required)',
              password: 'string (required)'
            }
          },
          validateToken: {
            method: 'POST',
            path: '/api/validate-token',
            description: 'Validate an encrypted token',
            rateLimit: '20 requests per minute',
            body: {
              token: 'string (required)'
            }
          },
          status: {
            method: 'GET',
            path: '/api/status',
            description: 'Server health check'
          },
          info: {
            method: 'GET',
            path: '/api/info',
            description: 'API information and documentation'
          }
        }
      }
    };

    return res.status(200).json(successResponse);
  });

  return router;
}

/**
 * Export types for use in other modules
 */
export type { SuccessResponse, ErrorResponse, ApiResponse };
