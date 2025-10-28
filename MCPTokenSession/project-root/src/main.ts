// src/main.ts

import { ConnectionContextManager } from "./core/connection/connectionContextManager";
import { SessionManager } from "./core/session/SessionManager";
import { TokenManager } from "./core/token/TokenManager";
import { VTJApiClient } from "./vtj/VTJApiClient";
import { AuthFlowController } from "./core/auth/AuthFlowController";
import { HttpServer } from "./http/httpServer";
// MCP-spezifischer Part wird in Schritt 21 ergänzt

async function startServer() {
  // Core-Manager
  const connectionContextManager = new ConnectionContextManager();
  const sessionManager = new SessionManager();
  const tokenManager = new TokenManager();
  const vtjApiClient = new VTJApiClient();

  // Auth-Controller
  const authFlowController = new AuthFlowController(
    sessionManager,
    tokenManager,
    vtjApiClient
  );

  // Login-Webserver starten
  const httpServer = new HttpServer(authFlowController);
  httpServer.start();

  // MCP-Teil wird hier im nächsten Schritt ergänzt:
  // -> startMcp(connectionContextManager, sessionManager, authFlowController)
  console.log("[INIT] MCP-Teil wird in Schritt 21 angebunden.");
}

startServer().catch((err) => {
  console.error("Fehler beim Starten des Servers:", err);
});

