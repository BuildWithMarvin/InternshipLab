// src/routes/mcpRoutes.ts - MCP Routes for Express Integration
import { Router } from "express";
import { mcpAuthMiddleware, mcpCorsMiddleware } from "../mcp/mcpAuth";
import { handleMCPPost, handleMCPGet, handleMCPDelete } from "../mcp/mcpServer";
import type { Request, Response } from "express";

const router = Router();

// Apply CORS middleware for all MCP routes
router.use(mcpCorsMiddleware);

// Apply authentication middleware for all MCP routes
router.use(mcpAuthMiddleware);

// MCP Discovery endpoint - provides information about this MCP server
router.get("/", (req: Request, res: Response) => {
  res.json({
    name: "financial-mcp-server",
    version: "1.0.0",
    description: "Financial MCP Server with Better Auth integration",
    protocol: {
      version: "2024-12-19",
      transport: "http",
      capabilities: {
        tools: true,
        logging: true,
        resumability: true,
        authentication: true
      }
    },
    endpoints: {
      mcp: "/api/mcp",
      auth: "/api/auth/login",
      documentation: "https://github.com/your-org/mcp-financial-server"
    },
    authentication: {
      type: "bearer",
      description: "Use session token from /api/auth/login",
      headers: ["Authorization: Bearer <token>", "Mcp-Auth-Token: <token>"],
      cookies: ["better-auth.session"],
      queryParam: "token"
    },
    tools: [
      {
        name: "get_account_balance",
        description: "Get your current account balance and financial information",
        requires_auth: true
      },
      {
        name: "update_account_balance", 
        description: "Update your account balance",
        requires_auth: true,
        parameters: ["amount"]
      },
      {
        name: "get_kyc_status",
        description: "Get your KYC verification status", 
        requires_auth: true
      },
      {
        name: "update_kyc_status",
        description: "Update your KYC verification status",
        requires_auth: true,
        parameters: ["status"]
      },
      {
        name: "list_users",
        description: "List all financial users with pagination",
        requires_auth: true,
        parameters: ["page?", "limit?"]
      }
    ],
    examples: {
      authentication: {
        "step1": "POST /api/auth/login with email and password",
        "step2": "Use returned sessionToken in MCP requests",
        "formats": [
          "Authorization: Bearer <sessionToken>",
          "Mcp-Auth-Token: <sessionToken>",
          "Cookie: better-auth.session=<sessionToken>",
          "?token=<sessionToken>"
        ]
      },
      initialization: {
        method: "POST",
        url: "/api/mcp",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer <your-session-token>"
        },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-12-19",
            capabilities: {
              tools: {}
            },
            clientInfo: {
              name: "your-client",
              version: "1.0.0"
            }
          }
        }
      },
      toolCall: {
        method: "POST", 
        url: "/api/mcp",
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": "<session-id-from-init>",
          "Authorization": "Bearer <your-session-token>"
        },
        body: {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "get_account_balance",
            arguments: {}
          }
        }
      }
    }
  });
});

// MCP POST endpoint - handles JSON-RPC requests and initialization
router.post("/", async (req: Request, res: Response) => {
  try {
    // Body should already be parsed by express.json() middleware
    const body = req.body;
    
    if (!body || typeof body !== 'object') {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error: Invalid JSON or empty body',
        },
        id: null,
      });
    }

    // Handle the MCP request
    await handleMCPPost(req as any, res as any, body);
  } catch (error) {
    console.error('❌ Error in MCP POST route:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// MCP GET endpoint - handles SSE streams for real-time communication
router.get("/", async (req: Request, res: Response) => {
  try {
    await handleMCPGet(req as any, res as any);
  } catch (error) {
    console.error('❌ Error in MCP GET route:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
});

// MCP DELETE endpoint - handles session termination
router.delete("/", async (req: Request, res: Response) => {
  try {
    await handleMCPDelete(req as any, res as any);
  } catch (error) {
    console.error('❌ Error in MCP DELETE route:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
});

// Health check specifically for MCP functionality
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    mcp: {
      protocol: "2024-12-19",
      transport: "http",
      features: ["tools", "logging", "resumability", "authentication"],
      authIntegration: "better-auth",
      sessionManagement: "stateful"
    },
    endpoints: {
      discovery: "/api/mcp",
      jsonrpc: "POST /api/mcp",
      sse: "GET /api/mcp",
      termination: "DELETE /api/mcp"
    }
  });
});

export default router;