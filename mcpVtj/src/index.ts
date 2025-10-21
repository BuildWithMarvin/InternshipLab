// Application Entry Point for VTJ MCP Server

import dotenv from 'dotenv';
import http from 'http';
import {
  createApp,
  getServerConfig,
  validateEnvironment,
  printStartupInfo
} from './server.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Global server instance for graceful shutdown
 */
let server: http.Server | null = null;

/**
 * Starts the HTTP server
 */
async function startServer(): Promise<void> {
  try {
    console.log('[Startup] Initializing VTJ MCP Server...');

    // Validate environment variables
    console.log('[Startup] Validating environment configuration...');
    validateEnvironment();

    // Get server configuration
    const config = getServerConfig();

    // Create Express application
    console.log('[Startup] Creating Express application...');
    const app = createApp();

    // Create HTTP server
    console.log('[Startup] Creating HTTP server...');
    server = http.createServer(app);

    // Start listening
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        return reject(new Error('Server instance not created'));
      }

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${config.port} is already in use`));
        } else if (error.code === 'EACCES') {
          reject(new Error(`Permission denied to bind to port ${config.port}`));
        } else {
          reject(error);
        }
      });

      server.listen(config.port, () => {
        console.log('[Startup] Server started successfully');
        printStartupInfo(config);
        resolve();
      });
    });

    // Setup graceful shutdown handlers
    setupGracefulShutdown();

  } catch (error) {
    console.error('[Startup] Failed to start server:', error);

    if (error instanceof Error) {
      console.error('[Startup] Error message:', error.message);
      if (error.stack) {
        console.error('[Startup] Stack trace:', error.stack);
      }
    }

    process.exit(1);
  }
}

/**
 * Gracefully shuts down the server
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Shutdown] Received ${signal} signal`);
  console.log('[Shutdown] Starting graceful shutdown...');

  // Prevent multiple shutdown calls
  if (!server) {
    console.log('[Shutdown] Server already stopped');
    process.exit(0);
    return;
  }

  const shutdownTimeout = setTimeout(() => {
    console.error('[Shutdown] Forced shutdown after timeout');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        return resolve();
      }

      server.close((err) => {
        if (err) {
          console.error('[Shutdown] Error closing server:', err);
          reject(err);
        } else {
          console.log('[Shutdown] Server closed successfully');
          resolve();
        }
      });
    });

    // Clear shutdown timeout
    clearTimeout(shutdownTimeout);

    console.log('[Shutdown] Cleanup completed');
    console.log('[Shutdown] Goodbye! 👋\n');

    process.exit(0);
  } catch (error) {
    console.error('[Shutdown] Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Sets up signal handlers for graceful shutdown
 */
function setupGracefulShutdown(): void {
  // Handle SIGTERM (Kubernetes, Docker, etc.)
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('[Error] Uncaught Exception:', error);
    console.error('[Error] Stack:', error.stack);

    // Try to shutdown gracefully
    shutdown('UNCAUGHT_EXCEPTION').catch(() => {
      process.exit(1);
    });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('[Error] Unhandled Promise Rejection:', reason);
    console.error('[Error] Promise:', promise);

    // Try to shutdown gracefully
    shutdown('UNHANDLED_REJECTION').catch(() => {
      process.exit(1);
    });
  });

  console.log('[Server] Graceful shutdown handlers registered');
}

/**
 * Main function - Entry point
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         VTJ MCP Authentication Server v1.0.0               ║');
  console.log('║         HTTP-based Model Context Protocol Server          ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  await startServer();
}

// Start the application
main().catch((error) => {
  console.error('[Fatal] Application startup failed:', error);
  process.exit(1);
});
