// src/core/session/SessionManager.ts

import type { InternalConnectionId } from "../connection/types";
import type { SessionContext } from "./SessionContext";

/**
 * Der SessionManager speichert pro Verbindung eine aktive
 * VTJ-Session (sessionId + depotId).
 */
export class SessionManager {
  private sessionMap = new Map<InternalConnectionId, SessionContext>();

  /**
   * Speichert oder überschreibt die Session für die angegebene Connection.
   */
  setSession(connectionId: InternalConnectionId, session: SessionContext): void {
    this.sessionMap.set(connectionId, session);
  }

  /**
   * Ruft die Session ab oder liefert null, falls keine existiert.
   */
  getSession(connectionId: InternalConnectionId): SessionContext | null {
    return this.sessionMap.get(connectionId) ?? null;
  }

  /**
   * Prüft, ob für die Connection eine gültige Session existiert.
   */
  hasValidSession(connectionId: InternalConnectionId): boolean {
    return this.sessionMap.has(connectionId);
  }

  /**
   * Invalideirt (löscht) die Session für die angegebene Connection.
   */
  invalidateSession(connectionId: InternalConnectionId): void {
    this.sessionMap.delete(connectionId);
  }
}
