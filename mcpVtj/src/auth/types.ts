// TypeScript-Schnittstellen für Authentifizierung und Sitzungsverwaltung mit Zod-Validierung

import { z } from 'zod';

/**
 * Zod-Schema für den Token-Payload
 * Validiert und bereinigt Payload-Daten, um Injektionsangriffe zu verhindern
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
}).strict(); // Unbekannte Eigenschaften zurückweisen

/**
 * Zod-Schema für Sitzungsdaten
 * Entspricht dem TokenPayload, erlaubt jedoch abgelaufene Zeitstempel (für Validierungszwecke)
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
}).strict(); // Unbekannte Eigenschaften zurückweisen

/**
 * Zod-Schema für die VTJ-Login-Antwort
 * Validiert Daten, die von der VTJ-API empfangen werden
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
}).strict(); // Unbekannte Eigenschaften zurückweisen

/**
 * Von Zod-Schemata abgeleitete TypeScript-Typen
 * Stellen sicher, dass Typensicherheit und Schemenvalidierung stets übereinstimmen
 */
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;
export type SessionData = z.infer<typeof SessionDataSchema>;
export type VTJLoginResponse = z.infer<typeof VTJLoginResponseSchema>;
