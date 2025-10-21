// MCP Module Exports

// Tools
export {
  MCP_TOOL_SCHEMAS,
  authenticate,
  getDepot,
  getSessionStatus,
  executeTool,
  getAvailableTools
} from './tools.js';

export type {
  MCPToolInput,
  MCPToolSchema,
  AuthenticateResponse,
  GetDepotResponse,
  GetSessionStatusResponse,
  MCPErrorResponse,
  MCPToolResult
} from './types.js';

// Server
export {
  MCPServer,
  mcpServer,
  createMCPRouter
} from './server.js';

// Protocol
export {
  MCP_PROTOCOL_VERSION,
  MCPRequestType,
  MCPErrorCode
} from './protocol.js';

export type {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPToolsListRequest,
  MCPToolsListResponse,
  MCPToolsCallRequest,
  MCPToolsCallResponse,
  ServerCapabilities
} from './protocol.js';
