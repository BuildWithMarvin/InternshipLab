// TypeScript Interfaces for MCP Tools

/**
 * Standard MCP tool input with token parameter
 */
export interface MCPToolInput {
  token: string;
}

/**
 * MCP Tool schema definition for HTTP transport
 */
export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Authentication tool response
 */
export interface AuthenticateResponse {
  success: boolean;
  message: string;
  sessionInfo: {
    depotId: string;
    expiresAt: number;
    expiresIn: string;
  };
}

/**
 * Get depot tool response
 */
export interface GetDepotResponse {
  success: boolean;
  depotId: string;
  data: any;
}

/**
 * Get session status tool response
 */
export interface GetSessionStatusResponse {
  success: boolean;
  status: 'valid' | 'expired' | 'invalid';
  depotId?: string;
  expiresAt?: number;
  expiresIn?: string;
  remainingTime?: number;
}

/**
 * Error response for MCP tools
 */
export interface MCPErrorResponse {
  error: string;
  message: string;
  login_url: string;
  instructions: string;
}

/**
 * MCP Tool execution result
 */
export type MCPToolResult =
  | AuthenticateResponse
  | GetDepotResponse
  | GetSessionStatusResponse
  | MCPErrorResponse;
