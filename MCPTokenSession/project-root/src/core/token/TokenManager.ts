// src/core/token/TokenManager.ts
import { v4 as uuidv4 } from "uuid";
import type { InternalConnectionId } from "../connection/types";
import type { TokenEntry } from "./tokenEntry";

export class TokenManager {
  private tokenMap = new Map<string, TokenEntry>();

  /**
   * Erstellt ein neues Token für die angegebene Connection
   * und speichert es intern.
   */
  createToken(connectionId: InternalConnectionId): string {
    const token = uuidv4();
    const entry: TokenEntry = { token, connectionId };
    this.tokenMap.set(token, entry);
    return token;
  }

  /**
   * Liefert die ConnectionId zu einem Token
   * oder null, wenn das Token unbekannt oder abgelaufen ist.
   */
  getConnectionIdByToken(token: string): InternalConnectionId | null {
    const entry = this.tokenMap.get(token);
    if (!entry) {
      return null;
    }

    // Optional: Ablaufzeit prüfen (noch deaktiviert)
    return entry.connectionId;
  }

  /**
   * Löscht ein Token, z. B. nach erfolgreichem Login.
   */
  invalidateToken(token: string): void {
    this.tokenMap.delete(token);
  }
}

