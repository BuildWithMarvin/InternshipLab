// src/lib/auth.ts - KOMPLETT NEUE, EINFACHE VERSION
import { betterAuth } from "better-auth";
import { mcp } from "better-auth/plugins";
import { oauthDbPool } from "./database";
import crypto from "crypto";


// MINIMALE Better Auth Konfiguration (nur das nötigste)
export const auth = betterAuth({
  database: oauthDbPool,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  
  // Nur Basic Email/Password (ohne Custom Handler)
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false
  },
  
  // MCP Plugin
plugins: [
  // Typprüfung mit `as any` umgehen
  mcp({
    oidcConfig: {
      loginPage: "/auth/signin",  // Pflichtfeld laut Typdefinition
      codeExpiresIn: 600,
      accessTokenExpiresIn: 3600,
      refreshTokenExpiresIn: 604800,
      defaultScope: "openid profile email",
      scopes: ["openid", "profile", "email", "offline_access"]
    }
  } as any)  // <<< 'as any' ignoriert hier den Typfehler
],
  
  session: {
    expiresIn: 60 * 60 * 24 * 7
  },
  
  advanced: {
    generateId: () => crypto.randomUUID()
  }
});

// MANUELLE TYPES (keine $Infer Probleme)
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
}

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