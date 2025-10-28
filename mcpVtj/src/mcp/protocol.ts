// MCP-Protokolltypen für HTTP-Transport

/**
 * MCP-Protokollversion
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * MCP-Anfragetypen
 */
export enum MCPRequestType {
  INITIALIZE = 'initialize',
  TOOLS_LIST = 'tools/list',
  TOOLS_CALL = 'tools/call',
  CAPABILITIES = 'capabilities'
}

/**
 * Basis-MCP-Anfrage
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

/**
 * Basis-MCP-Antwort
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: MCPError;
}

/**
 * MCP-Fehlerobjekt
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * MCP-Fehlercodes
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
 * MCP-Initialize-Anfrage
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
 * MCP-Initialize-Antwort
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
 * MCP-Tools-List-Anfrage
 */
export interface MCPToolsListRequest extends MCPRequest {
  method: 'tools/list';
  params?: {};
}

/**
 * MCP-Tools-List-Antwort
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
 * MCP-Tools-Call-Anfrage
 */
export interface MCPToolsCallRequest extends MCPRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

/**
 * MCP-Tools-Call-Antwort
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
 * Serverfähigkeiten
 */
export interface ServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
}
