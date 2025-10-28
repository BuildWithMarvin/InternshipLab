// src/mcp/startMcpServer.ts

import { startMcpServer } from "@modelcontextprotocol/sdk"; 
import type { ConnectionContextManager } from "../core/connection/connectionContextManager";
import type { SessionManager } from "../core/session/SessionManager";
import type { AuthFlowController } from "../core/auth/AuthFlowController";
import { MCPCommandRouter } from "./handlers/MCPCommandRouter";

export async function startMcpServer(
  connectionContextManager: ConnectionContextManager,
  sessionManager: SessionManager,
  authFlowController: AuthFlowController
) {
  // Hier registrieren wir den CommandRouter
  const router = new MCPCommandRouter(
    connectionContextManager,
    sessionManager,
    authFlowController
  );

  // Start MCP SDK handler
  await startMcpServer({
    onConnectionOpen(connection) {
      // Neue Verbindung → interne ID erzeugen
      const connectionId = connectionContextManager.createContext(connection);
      console.log("[MCP] Neue Verbindung erstellt:", connectionId);
    },
    onCommand(connection, command, args) {
      return router.handleCommand(connection, command, args);
    },
    onConnectionClose(connection) {
      const connectionId = connectionContextManager.getConnectionId(connection);
      if (connectionId) {
        // Session reduzieren / invalidieren
        sessionManager.invalidateSession(connectionId);
        console.log("[MCP] Session invalidiert für:", connectionId);
      }
      connectionContextManager.removeContext(connection);
    },
  });

  console.log("[MCP] Server ist aktiv und bereit für Verbindungen.");
}
