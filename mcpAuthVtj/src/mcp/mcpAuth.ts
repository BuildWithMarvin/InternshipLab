// src/mcp/mcpAuth.ts - MCP Authentication Middleware using Better Auth
import type { Request, Response, NextFunction } from "express";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { AuthService } from "../services/authService";

// Extended AuthInfo interface for our MCP implementation
interface MCPAuthInfo extends AuthInfo {
  user?: {
    id: string;
    email: string;
    username: string;
  };
  metadata?: {
    accountBalance: number;
    currency: string;
    kycStatus: string;
    authenticatedAt: string;
  };
}

// Extend Express Request to include auth info for MCP
declare global {
  namespace Express {
    interface Request {
      auth?: MCPAuthInfo;
    }
  }
}

/**
 * MCP Authentication Middleware
 * 
 * This middleware:
 * 1. Extracts authentication from various sources (session token, Better Auth session)
 * 2. Validates the authentication using Better Auth
 * 3. Attaches auth info to the request for MCP tools to use
 */
export async function mcpAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Try to get authentication from multiple sources
    let sessionToken: string | undefined;
    
    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }
    
    // 2. Check MCP-specific headers
    const mcpAuthHeader = req.headers['mcp-auth-token'] as string;
    if (mcpAuthHeader) {
      sessionToken = mcpAuthHeader;
    }
    
    // 3. Check session cookie (Better Auth integration)
    const cookieToken = req.cookies?.['better-auth.session'];
    if (cookieToken) {
      sessionToken = cookieToken;
    }
    
    // 4. Check query parameter (for SSE connections)
    const queryToken = req.query.token as string;
    if (queryToken) {
      sessionToken = queryToken;
    }

    if (!sessionToken) {
      // For MCP, we don't immediately reject - some operations might be public
      // Instead, we just don't attach auth info
      console.log('🔓 No authentication token found for MCP request');
      return next();
    }

    // Validate the session token with Better Auth
    console.log('🔍 Validating session token for MCP request');
    const sessionData = await AuthService.validateSession(sessionToken);
    
    if (sessionData && sessionData.realUser) {
      // Attach auth info to request for MCP tools
      req.auth = {
        token: sessionToken,
        clientId: 'better-auth-mcp-client', // Default client ID for Better Auth integration
        scopes: ['mcp:tools'], // Basic scope for MCP tools
        user: {
          id: sessionData.realUser.user_id.toString(),
          email: sessionData.realUser.email,
          username: sessionData.realUser.username,
        },
        metadata: {
          accountBalance: sessionData.realUser.account_balance,
          currency: sessionData.realUser.currency,
          kycStatus: sessionData.realUser.kyc_status,
          authenticatedAt: new Date().toISOString(),
        }
      };
      
      console.log(`✅ MCP request authenticated for user: ${sessionData.realUser.email}`);
    } else {
      console.log('❌ Invalid session token for MCP request');
      // Don't attach auth info, but don't block the request
      // MCP tools can decide if they require authentication
    }

    next();
  } catch (error) {
    console.error('❌ Error in MCP auth middleware:', error);
    // Don't block the request on auth errors - let MCP tools handle it
    next();
  }
}

/**
 * Helper function to check if a request is authenticated for MCP
 */
export function isMCPAuthenticated(req: Request): boolean {
  return !!(req.auth && req.auth.token && req.auth.user);
}

/**
 * Helper function to get the authenticated user from MCP request
 */
export function getMCPUser(req: Request): MCPAuthInfo['user'] | null {
  return req.auth?.user || null;
}

/**
 * Helper function to require authentication for specific MCP endpoints
 */
export function requireMCPAuth(req: Request, res: Response, next: NextFunction) {
  if (!isMCPAuthenticated(req)) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Authentication required for this MCP operation',
        data: {
          authEndpoint: '/api/auth/login',
          message: 'Please authenticate using /api/auth/login to get a session token'
        }
      },
      id: null,
    });
  }
  
  next();
}

/**
 * Middleware to add CORS headers for MCP requests
 */
export function mcpCorsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow cross-origin requests for MCP
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Auth-Token, Last-Event-Id');
  res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
}