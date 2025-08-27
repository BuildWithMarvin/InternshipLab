export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Deine users Tabelle Types
export interface UserProfile {
  user_id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name?: string;
  phone_number?: string;
  country?: string;
  account_balance: number;
  currency: string;
  kyc_status: string;
  created_at: Date;
  updated_at: Date;
}

// API Response Types
export interface ApiError {
  error: string;
  message?: string;
  code?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  message?: string;
}

export interface SessionResponse {
  success: boolean;
  user?: User;
  session?: Session;
  realUser?: UserProfile;
  error?: string;
}

// MCP Types
export interface McpRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
}

export interface McpResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: string | object;
}

export interface ToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

// Database Connection Types
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}