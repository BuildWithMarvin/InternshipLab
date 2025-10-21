// TypeScript Interfaces for Authentication and Session Management with Zod Validation

import { z } from 'zod';

/**
 * Zod Schema for Token Payload
 * Validates and sanitizes token payload data to prevent injection attacks
 */
export const TokenPayloadSchema = z.object({
  vtjSessionId: z.string()
    .min(1, 'VTJ Session ID cannot be empty')
    .max(1024, 'VTJ Session ID too long')
    .refine(
      (value) => !/[<>'"`;\\(){}[\]&|$`]/.test(value),
      'VTJ Session ID contains potentially dangerous characters (XSS/Injection risk)'
    ),

  depotId: z.string()
    .min(1, 'Depot ID cannot be empty')
    .max(255, 'Depot ID too long')
    .uuid('Depot ID must be a valid UUID'),

  expiresAt: z.number()
    .int('Expiration timestamp must be an integer')
    .positive('Expiration timestamp must be positive')
    .refine(
      (timestamp) => timestamp > Date.now(),
      'Expiration timestamp must be in the future'
    )
}).strict(); // Reject unknown properties

/**
 * Zod Schema for Session Data
 * Same as TokenPayload but allows expired timestamps (for validation purposes)
 */
export const SessionDataSchema = z.object({
  vtjSessionId: z.string()
    .min(1, 'VTJ Session ID cannot be empty')
    .max(1024, 'VTJ Session ID too long')
    .refine(
      (value) => !/[<>'"`;\\(){}[\]&|$`]/.test(value),
      'VTJ Session ID contains potentially dangerous characters (XSS/Injection risk)'
    ),

  depotId: z.string()
    .min(1, 'Depot ID cannot be empty')
    .max(255, 'Depot ID too long')
    .uuid('Depot ID must be a valid UUID'),

  expiresAt: z.number()
    .int('Expiration timestamp must be an integer')
    .positive('Expiration timestamp must be positive')
}).strict(); // Reject unknown properties

/**
 * Zod Schema for VTJ Login Response
 * Validates data received from VTJ API
 */
export const VTJLoginResponseSchema = z.object({
  sessionId: z.string()
    .min(1, 'Session ID cannot be empty')
    .max(1024, 'Session ID too long')
    .refine(
      (value) => !/[<>'"`;\\(){}[\]&|$`]/.test(value),
      'Session ID contains potentially dangerous characters (XSS/Injection risk)'
    ),

  depotId: z.string()
    .min(1, 'Depot ID cannot be empty')
    .max(255, 'Depot ID too long')
    .uuid('Depot ID must be a valid UUID'),

  userId: z.string()
    .min(1, 'User ID cannot be empty')
    .max(255, 'User ID too long')
    .optional(),

  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .optional(),

  message: z.string()
    .max(500, 'Message too long')
    .optional()
}).strict(); // Reject unknown properties

/**
 * TypeScript Types inferred from Zod Schemas
 * These ensure type safety and schema validation are always in sync
 */
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type VTJLoginResponse = z.infer<typeof VTJLoginResponseSchema>;
