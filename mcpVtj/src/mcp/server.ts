// MCP Server Implementation for HTTP Transport

import { Request, Response, Router } from 'express';
import {
  MCP_PROTOCOL_VERSION,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPErrorCode,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPToolsListRequest,
  MCPToolsListResponse,
  MCPToolsCallRequest,
  MCPToolsCallResponse
} from './protocol.js';
import { getAvailableTools, executeTool } from './tools.js';

/**
 * Server Information
 */
const SERVER_INFO = {
  name: 'vtj-auth-server',
  version: '1.0.0',
  description: 'VTJ API Authentication and Data Access'
};

/**
 * Server Capabilities
 */
const SERVER_CAPABILITIES = {
  tools: {
    listChanged: false
  }
};

/**
 * MCP Server Class
 */
export class MCPServer {
  constructor() {
    // Server initialization
  }

  /**
   * Creates a standard MCP response
   */
  private createResponse(id: string | number | undefined, result: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  /**
   * Creates a standard MCP error response
   */
  private createErrorResponse(
    id: string | number | undefined,
    code: MCPErrorCode,
    message: string,
    data?: any
  ): MCPResponse {
    const error: MCPError = {
      code,
      message,
      data
    };

    return {
      jsonrpc: '2.0',
      id,
      error
    };
  }

  /**
   * Validates MCP request format
   */
  private validateRequest(request: any): boolean {
    if (!request || typeof request !== 'object') {
      return false;
    }

    if (request.jsonrpc !== '2.0') {
      return false;
    }

    if (typeof request.method !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Handles MCP Initialize request
   */
  async handleInitialize(request: MCPInitializeRequest, _token?: string): Promise<MCPInitializeResponse> {
    console.log(`[MCP Server] Client initialized: ${request.params.clientInfo.name} v${request.params.clientInfo.version}`);

    return this.createResponse(request.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: SERVER_CAPABILITIES,
      serverInfo: SERVER_INFO
    }) as MCPInitializeResponse;
  }

  /**
   * Handles MCP Tools List request
   */
  async handleToolsList(request: MCPToolsListRequest): Promise<MCPToolsListResponse> {
    const tools = getAvailableTools();

    console.log(`[MCP Server] Tools list requested (${tools.length} tools available)`);

    return this.createResponse(request.id, {
      tools
    }) as MCPToolsListResponse;
  }

  /**
   * Handles MCP Tools Call request
   */
  async handleToolsCall(request: MCPToolsCallRequest, token?: string): Promise<MCPToolsCallResponse> {
    const { name, arguments: args } = request.params;

    console.log(`[MCP Server] Tool called: ${name}`);

    try {
      // Prepare tool arguments
      const toolArgs = args || {};

      // Inject token from Authorization header if not already in arguments (VS Code support)
      // Claude Desktop sends token in arguments, VS Code sends it in Authorization header
      if (token && !toolArgs.token) {
        toolArgs.token = token;
        console.log('[MCP Server] Token auto-injected from Authorization header');
      }

      // Execute tool
      const result = await executeTool(name, toolArgs);

      // Check if result is an error
      const isError = 'error' in result;

      // Format result as MCP content
      const content = [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }
      ];

      return this.createResponse(request.id, {
        content,
        isError
      }) as MCPToolsCallResponse;
    } catch (error) {
      // Tool execution error
      console.error(`[MCP Server] Tool execution error:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const content = [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: 'tool_execution_failed',
            message: `Failed to execute tool '${name}': ${errorMessage}`
          }, null, 2)
        }
      ];

      return this.createResponse(request.id, {
        content,
        isError: true
      }) as MCPToolsCallResponse;
    }
  }

  /**
   * Handles MCP request routing
   */
  async handleRequest(request: MCPRequest, token?: string): Promise<MCPResponse> {
    // Validate request format
    if (!this.validateRequest(request)) {
      return this.createErrorResponse(
        request.id,
        MCPErrorCode.INVALID_REQUEST,
        'Invalid MCP request format'
      );
    }

    try {
      // Route to appropriate handler
      switch (request.method) {
        case 'initialize':
          return await this.handleInitialize(request as MCPInitializeRequest, token);

        case 'tools/list':
          return await this.handleToolsList(request as MCPToolsListRequest);

        case 'tools/call':
          return await this.handleToolsCall(request as MCPToolsCallRequest, token);

        default:
          return this.createErrorResponse(
            request.id,
            MCPErrorCode.METHOD_NOT_FOUND,
            `Method not found: ${request.method}`
          );
      }
    } catch (error) {
      console.error('[MCP Server] Request handling error:', error);

      return this.createErrorResponse(
        request.id,
        MCPErrorCode.INTERNAL_ERROR,
        `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets server capabilities
   */
  getCapabilities() {
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: SERVER_INFO,
      capabilities: SERVER_CAPABILITIES,
      tools: getAvailableTools() // Include available tools
    };
  }

  /**
   * Gets server info
   */
  getServerInfo() {
    return SERVER_INFO;
  }
}

/**
 * Creates Express router for MCP endpoints
 */
export function createMCPRouter(): Router {
  const router = Router();
  const mcpServer = new MCPServer();

  // Middleware to log all MCP requests
  router.use((req: Request, _res: Response, next) => {
    console.log(`[MCP HTTP] ${req.method} ${req.path}`);
    next();
  });

  /**
   * GET /mcp - MCP server information (for VS Code compatibility)
   */
  router.get('/', (_req: Request, res: Response) => {
    res.json(mcpServer.getCapabilities());
  });

  /**
   * POST /mcp - Main MCP endpoint (handles all MCP requests)
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const mcpRequest = req.body as MCPRequest;

      // Extract token from Authorization header if present (for VS Code Copilot)
      const authHeader = req.headers.authorization;
      let extractedToken: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        extractedToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log('[MCP HTTP] Token extracted from Authorization header');
      }

      // Pass extracted token to the handler
      const mcpResponse = await mcpServer.handleRequest(mcpRequest, extractedToken);

      res.json(mcpResponse);
    } catch (error) {
      console.error('[MCP HTTP] Request error:', error);

      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: (req.body as any)?.id,
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      };

      res.status(500).json(errorResponse);
    }
  });

  /**
   * POST /mcp/initialize - Initialize client connection
   */
  router.post('/initialize', async (req: Request, res: Response) => {
    try {
      const initRequest: MCPInitializeRequest = {
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        method: 'initialize',
        params: req.body.params || req.body
      };

      const response = await mcpServer.handleRequest(initRequest);
      res.json(response);
    } catch (error) {
      console.error('[MCP HTTP] Initialize error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Initialization failed'
        }
      });
    }
  });

  /**
   * POST /mcp/tools/list - Get available tools
   */
  router.post('/tools/list', async (req: Request, res: Response) => {
    try {
      const listRequest: MCPToolsListRequest = {
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        method: 'tools/list',
        params: req.body.params || {}
      };

      const response = await mcpServer.handleRequest(listRequest);
      res.json(response);
    } catch (error) {
      console.error('[MCP HTTP] Tools list error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Failed to list tools'
        }
      });
    }
  });

  /**
   * POST /mcp/tools/call - Execute a tool
   */
  router.post('/tools/call', async (req: Request, res: Response) => {
    try {
      const callRequest: MCPToolsCallRequest = {
        jsonrpc: '2.0',
        id: req.body.id || Date.now(),
        method: 'tools/call',
        params: req.body.params || req.body
      };

      const response = await mcpServer.handleRequest(callRequest);
      res.json(response);
    } catch (error) {
      console.error('[MCP HTTP] Tools call error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Failed to execute tool'
        }
      });
    }
  });

  /**
   * GET /mcp/capabilities - Get server capabilities
   */
  router.get('/capabilities', (_req: Request, res: Response) => {
    res.json(mcpServer.getCapabilities());
  });

  /**
   * GET /mcp/health - Health check endpoint
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      server: mcpServer.getServerInfo(),
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

/**
 * Export singleton MCP server instance
 */
export const mcpServer = new MCPServer();
