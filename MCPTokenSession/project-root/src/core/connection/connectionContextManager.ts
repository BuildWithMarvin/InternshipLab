// src/core/connection/ConnectionContextManager.ts

import { v4 as uuidv4 } from "uuid";
import type { InternalConnectionId } from "./types";

// Hinweis: McpConnection ist ein Typ aus dem MCP-SDK.
// Wir importieren ihn hier über den MCP-SDK-Typ, sobald wir ihn integrieren.
// Vorab definieren wir ihn temporär als "unknown" oder lassen optional.
type McpConnection = unknown;

export class ConnectionContextManager {
  // Map: MCP-Connection → internalConnectionId
  private connectionMap = new Map<McpConnection, InternalConnectionId>();

  /**
   * Erstellt eine neue interne Connection-Id für die gegebene Verbindung
   * (wenn noch keine vorhanden ist) und gibt sie zurück.
   */
  createContext(connection: McpConnection): InternalConnectionId {
    if (this.connectionMap.has(connection)) {
      return this.connectionMap.get(connection)!;
    }

    const id = uuidv4();
    this.connectionMap.set(connection, id);
    return id;
  }

  /**
   * Gibt die Connection Id für eine bestehende Verbindung zurück,
   * oder null, wenn sie nicht existiert.
   */
  getConnectionId(connection: McpConnection): InternalConnectionId | null {
    return this.connectionMap.get(connection) ?? null;
  }

  /**
   * Entfernt die Zuordnung (z. B. bei Verbindungsende).
   */
  removeContext(connection: McpConnection): void {
    this.connectionMap.delete(connection);
  }
}
