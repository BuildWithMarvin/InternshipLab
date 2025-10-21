// MCP Protocol Types for HTTP Transport

/**
 * MCP Protocol Version
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * MCP Request Types
 */
export enum MCPRequestType {
  INITIALIZE = 'initialize',
  TOOLS_LIST = 'tools/list',
  TOOLS_CALL = 'tools/call',
  CAPABILITIES = 'capabilities'
}

/**
 * Base MCP Request
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

/**
 * Base MCP Response
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: MCPError;
}

/**
 * MCP Error Object
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * MCP Error Codes
 */
export enum MCPErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  SERVER_ERROR = -32000
}

/**
 * MCP Initialize Request
 */
export interface MCPInitializeRequest extends MCPRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities?: {
      tools?: {};
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

/**
 * MCP Initialize Response
 */
export interface MCPInitializeResponse extends MCPResponse {
  result: {
    protocolVersion: string;
    capabilities: {
      tools?: {
        listChanged?: boolean;
      };
    };
    serverInfo: {
      name: string;
      version: string;
    };
  };
}

/**
 * MCP Tools List Request
 */
export interface MCPToolsListRequest extends MCPRequest {
  method: 'tools/list';
  params?: {};
}

/**
 * MCP Tools List Response
 */
export interface MCPToolsListResponse extends MCPResponse {
  result: {
    tools: Array<{
      name: string;
      description: string;
      inputSchema: {
        type: string;
        properties: Record<string, any>;
        required: string[];
      };
    }>;
  };
}

/**
 * MCP Tools Call Request
 */
export interface MCPToolsCallRequest extends MCPRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

/**
 * MCP Tools Call Response
 */
export interface MCPToolsCallResponse extends MCPResponse {
  result: {
    content: Array<{
      type: 'text' | 'image' | 'resource';
      text?: string;
      data?: string;
      mimeType?: string;
    }>;
    isError?: boolean;
  };
}

/**
 * Server Capabilities
 */
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
}

