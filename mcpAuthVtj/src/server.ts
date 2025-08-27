// src/server.ts - Express Hauptserver
import 'dotenv/config'; // ← GANZ OBEN!
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { corsMiddleware, helmetMiddleware, loggingMiddleware } from "./middleware/security";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import betterAuthRoutes from "./routes/betterAuthRoutes"; // 🆕 OAuth Routes
import toolRoutes from "./routes/toolRoutes"; // 🆕 MCP-style Tool Routes (Legacy)
import mcpRoutes from "./routes/mcpRoutes"; // 🆕 Real MCP Protocol Routes
import simpleMcpRoutes from "./routes/simpleMcpRoutes"; // 🆕 Simplified MCP Routes
import { handleOAuthDiscovery } from "./handlers/oauthHandler"; // 🆕 OAuth Discovery
import { cleanupMCPTransports } from "./mcp/mcpServer"; // 🆕 MCP Cleanup

console.log('🔍 Server starting with environment:');
console.log('MYSQL_DATABASE:', process.env.MYSQL_DATABASE || 'NOT SET');
console.log('OAUTH_DATABASE:', process.env.OAUTH_DATABASE || 'NOT SET');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
app.use(loggingMiddleware);

// Static files for test web app
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use("/api/auth", authRoutes);                    // Dein eigenes Auth System
app.use("/api/better-auth", betterAuthRoutes);       // 🆕 Better Auth OAuth
app.use("/api/tools", toolRoutes);                   // 🆕 MCP-style Tool Routes (Legacy)
app.use("/api/mcp", mcpRoutes);                      // 🆕 Real MCP Protocol Routes
app.use("/api/mcp-simple", simpleMcpRoutes);          // 🆕 Simplified MCP Routes
app.use("/.well-known/oauth-authorization-server", handleOAuthDiscovery); // 🆕 OAuth Discovery

// Health Check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    auth: "custom-service + better-auth-oauth",
    database: "mysql",
    message: "MCP Financial Server is running",
    oauth: {
      discovery: "/.well-known/oauth-authorization-server",
      authorize: "/api/better-auth/oauth/authorize", 
      token: "/api/better-auth/oauth/token"
    }
  });
});

// Test Endpoint
app.get("/", (req, res) => {
  res.json({
    message: "MCP Financial Server",
    version: "1.0.0",
    features: {
      customAuth: "✅ Registration, Login, Session Management",
      oauth: "✅ OAuth 2.1 for MCP Clients",
      financial: "✅ Account Balance, KYC, Currency",
      mcpProtocol: "✅ Real MCP HTTP Transport"
    },
    endpoints: {
      health: "/health",
      // Custom Auth
      login: "/api/auth/login",
      register: "/api/auth/register", 
      me: "/api/auth/me",
      logout: "/api/auth/logout",
      // OAuth für MCP
      oauthDiscovery: "/.well-known/oauth-authorization-server",
      oauthAuthorize: "/api/better-auth/oauth/authorize",
      oauthToken: "/api/better-auth/oauth/token",
      // Real MCP Protocol
      mcpDiscovery: "/api/mcp",
      mcpJsonRpc: "POST /api/mcp",
      mcpSSE: "GET /api/mcp",
      mcpTerminate: "DELETE /api/mcp",
      // Legacy Tools (backward compatibility)
      legacyTools: "/api/tools"
    }
  });
});

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start HTTP server with MCP-style endpoints
app.listen(PORT, () => {
  console.log(`🚀 Financial Server running on http://localhost:${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔐 Custom Auth: http://localhost:${PORT}/api/auth/*`);
  console.log(`🎫 OAuth für MCP: http://localhost:${PORT}/api/better-auth/oauth/*`);
  console.log(`🔍 OAuth Discovery: http://localhost:${PORT}/.well-known/oauth-authorization-server`);
  console.log(`🛠️  Legacy Tools: http://localhost:${PORT}/api/tools/*`);
  console.log(`🔌 Real MCP Protocol: http://localhost:${PORT}/api/mcp`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await cleanupMCPTransports();
  console.log('✅ Server shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down server...');
  await cleanupMCPTransports();
  console.log('✅ Server shutdown complete');
  process.exit(0);
});

export default app;