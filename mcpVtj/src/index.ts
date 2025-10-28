// Anwendungseinstiegspunkt für den VTJ-MCP-Server

import dotenv from "dotenv";
import http from "http";
import { createApp, getServerConfig, validateEnvironment } from "./server.js";

// Umgebungsvariablen aus der Datei .env laden
dotenv.config();

/**
 * Globale Serverinstanz für das saubere Herunterfahren
 */
let server: http.Server | null = null;

/**
 * Startet den HTTP-Server
 */
async function startServer(): Promise<void> {
  try {

    // Umgebungsvariablen validieren
    validateEnvironment();

    // Serverkonfiguration abrufen
    const config = getServerConfig();

    // Express-Anwendung erstellen
    const app = createApp();

    // HTTP-Server erstellen
    server = http.createServer(app);

    // Server starten (Port binden)
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        return reject(new Error("Server instance not created"));
      }

      server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          reject(new Error(`Port ${config.port} is already in use`));
        } else if (error.code === "EACCES") {
          reject(new Error(`Permission denied to bind to port ${config.port}`));
        } else {
          reject(error);
        }
      });

      server.listen(config.port, () => {
        // Einzige Konsolenausgabe zum Start
        console.log(`Server gestartet: ${config.serverUrl}`);
        resolve();
      });
    });

    // Handler für sauberes Herunterfahren einrichten
    setupGracefulShutdown();
  } catch (error) {
    console.error("[Startup] Failed to start server:", error);

    if (error instanceof Error) {
      console.error("[Startup] Error message:", error.message);
      if (error.stack) {
        console.error("[Startup] Stack trace:", error.stack);
      }
    }

    process.exit(1);
  }
}

/**
 * Fährt den Server kontrolliert herunter
 */
async function shutdown(signal: string): Promise<void> {
  // Mehrfache Shutdown-Aufrufe verhindern
  if (!server) {
    process.exit(0);
    return;
  }

  const shutdownTimeout = setTimeout(() => {
    console.error("[Shutdown] Forced shutdown after timeout");
    process.exit(1);
  }, 10000); // 10 Sekunden Timeout

  try {
    // Keine neuen Verbindungen mehr annehmen
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        return resolve();
      }

      server.close((err) => {
        if (err) {
          console.error("[Shutdown] Error closing server:", err);
          reject(err);
        } else {
          console.log("[Shutdown] Server closed successfully");
          resolve();
        }
      });
    });

    // Shutdown-Timeout aufräumen
    clearTimeout(shutdownTimeout);

    process.exit(0);
  } catch (error) {
    console.error("[Shutdown] Error during shutdown:", error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Richtet Signal-Handler für ein sauberes Herunterfahren ein
 */
function setupGracefulShutdown(): void {
  // SIGTERM behandeln (Kubernetes, Docker, etc.)
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // SIGINT behandeln (Strg+C)
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Unbehandelte Ausnahmen behandeln
  process.on("uncaughtException", (error: Error) => {
    console.error("[Error] Uncaught Exception:", error);
    console.error("[Error] Stack:", error.stack);

    // Versuch, kontrolliert herunterzufahren
    shutdown("UNCAUGHT_EXCEPTION").catch(() => {
      process.exit(1);
    });
  });

  // Unbehandelte Promise-Ablehnungen behandeln
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    console.error("[Error] Unhandled Promise Rejection:", reason);
    console.error("[Error] Promise:", promise);

    // Versuch, kontrolliert herunterzufahren
    shutdown("UNHANDLED_REJECTION").catch(() => {
      process.exit(1);
    });
  });

  // Graceful-Shutdown-Handler registriert
}

async function main(): Promise<void> {
  await startServer();
}

// Anwendung starten
main().catch((error) => {
  console.error("[Fatal] Application startup failed:", error);
  process.exit(1);
});
