// Main HTTP Server Implementation

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMCPRouter } from './mcp/index.js';
import { createWebApiRouter } from './web/index.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Server Configuration
 */
export interface ServerConfig {
  port: number;
  corsOrigins: string[];
  environment: string;
  serverUrl: string;
}

/**
 * Creates and configures the Express application
 */
export function createApp(): Express {
  const app = express();

  // ==================== MIDDLEWARE SETUP ====================

  /**
   * CORS Configuration
   * Allow cross-origin requests from configured origins
   */
  const corsOptions = {
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // 24 hours
  };

  app.use(cors(corsOptions));

  /**
   * JSON Body Parser
   * Parse JSON request bodies with size limit
   */
  app.use(express.json({ limit: '10mb' }));

  /**
   * URL-Encoded Body Parser
   * Parse URL-encoded form data
   */
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  /**
   * Request Logging Middleware
   * Log all incoming requests
   */
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
  });

  // ==================== STATIC FILE SERVING ====================

  /**
   * Serve static files from public directory
   * CSS, JS, images, etc.
   */
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath, {
    maxAge: '1h', // Cache static files for 1 hour
    etag: true
  }));

  console.log(`[Server] Static files serving from: ${publicPath}`);

  // ==================== API ROUTES ====================

  /**
   * Web API Routes (/api/*)
   * Login, token validation, status
   */
  const webApiRouter = createWebApiRouter();
  app.use('/api', webApiRouter);
  console.log('[Server] Web API routes registered at /api');

  /**
   * MCP Protocol Routes (/mcp/*)
   * MCP server endpoints
   */
  const mcpRouter = createMCPRouter();
  app.use('/mcp', mcpRouter);
  console.log('[Server] MCP routes registered at /mcp');

  // ==================== HTML ROUTES ====================

  /**
   * GET / - Login page
   */
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  /**
   * GET /success - Success page with token display
   */
  app.get('/success.html', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'success.html'));
  });

  /**
   * GET /success - Alternative success route
   */
  app.get('/success', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'success.html'));
  });

  // ==================== HEALTH CHECK ====================

  /**
   * GET /health - Server health check
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  });

  // ==================== ERROR HANDLING ====================

  /**
   * 404 Handler - Route not found
   */
  app.use((req: Request, res: Response) => {
    console.log(`[Server] 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
      success: false,
      error: 'not_found',
      message: `Route not found: ${req.method} ${req.path}`,
      availableRoutes: [
        'GET /',
        'GET /success',
        'POST /api/login',
        'POST /api/validate-token',
        'GET /api/status',
        'GET /mcp',
        'POST /mcp',
        'POST /mcp/initialize',
        'POST /mcp/tools/list',
        'POST /mcp/tools/call',
        'GET /mcp/capabilities'
      ]
    });
  });

  /**
   * Global Error Handler
   * Catches all unhandled errors
   */
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    console.error(`[Server] Request: ${req.method} ${req.path}`);
    console.error('[Server] Stack:', err.stack);

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'An unexpected error occurred',
      ...(isDevelopment && {
        details: err.message,
        stack: err.stack
      })
    });
  });

  return app;
}

/**
 * Gets server configuration from environment variables
 */
export function getServerConfig(): ServerConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
  const environment = process.env.NODE_ENV || 'development';
  const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;

  return {
    port,
    corsOrigins,
    environment,
    serverUrl
  };
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'ENCRYPTION_SECRET',
    'VTJ_API_BASE_URL'
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}\n` +
      'Please create a .env file based on .env.example'
    );
  }

  // Validate ENCRYPTION_SECRET length
  const encryptionSecret = process.env.ENCRYPTION_SECRET;
  if (encryptionSecret && encryptionSecret.length < 32) {
    throw new Error(
      'ENCRYPTION_SECRET must be at least 32 characters long for AES-256-GCM encryption'
    );
  }

  console.log('[Server] Environment variables validated successfully');
}

/**
 * Prints server startup information
 */
export function printStartupInfo(config: ServerConfig): void {
  console.log('\n' + '='.repeat(60));
  console.log('  VTJ MCP Authentication Server');
  console.log('='.repeat(60));
  console.log(`  Environment:    ${config.environment}`);
  console.log(`  Port:           ${config.port}`);
  console.log(`  Server URL:     ${config.serverUrl}`);
  console.log(`  VTJ API:        ${process.env.VTJ_API_BASE_URL}`);
  console.log('='.repeat(60));
  console.log('\n  Available Endpoints:');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  Web Interface:');
  console.log(`    GET  ${config.serverUrl}/                  - Login page`);
  console.log(`    GET  ${config.serverUrl}/success           - Token display`);
  console.log('');
  console.log('  Web API:');
  console.log(`    POST ${config.serverUrl}/api/login         - User login`);
  console.log(`    POST ${config.serverUrl}/api/validate-token - Token validation`);
  console.log(`    GET  ${config.serverUrl}/api/status        - Server status`);
  console.log('');
  console.log('  MCP Protocol (Claude Desktop + VS Code Copilot):');
  console.log(`    GET  ${config.serverUrl}/mcp               - Server info (VS Code)`);
  console.log(`    POST ${config.serverUrl}/mcp               - Main MCP endpoint`);
  console.log(`    POST ${config.serverUrl}/mcp/initialize    - Initialize client`);
  console.log(`    POST ${config.serverUrl}/mcp/tools/list    - List tools`);
  console.log(`    POST ${config.serverUrl}/mcp/tools/call    - Execute tool`);
  console.log(`    GET  ${config.serverUrl}/mcp/capabilities  - Server capabilities`);
  console.log('  ─────────────────────────────────────────────────────');
  console.log('\n' + '='.repeat(60) + '\n');
}
