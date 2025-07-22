import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "@supabase/supabase-js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerToolsPlaylist } from "./toolsPlaylist.js";
import { registerToolsTracks } from "./toolTracks.js";
import { registerToolsArtists } from "./toolArtists.js";
import { registerToolsUsers } from "./toolUsers.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;


if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_PAT environment variables. Please check your Claude configuration."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "Supabase MCP Server",
  version: "1.0.0",
});

registerToolsPlaylist(server, supabase);
registerToolsTracks(server, supabase);
registerToolsArtists(server, supabase);
registerToolsUsers(server, supabase);

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

try {
  console.error("Starte server.connect...");
  await server.connect(transport);
  console.error("server.connect erfolgreich abgeschlossen.");
} catch (err) {
  console.error("Fehler beim server.connect:", err);
  process.exit(1); // Programm beenden, falls Verbindung nicht klappt
}




app.post("/mcp", async (req, res) => {
    console.error("----- Neue /mcp Anfrage -----");
  console.error("Headers:", req.headers);
  console.error("Body:", JSON.stringify(req.body, null, 2));
  try {
    await transport.handleRequest(req, res, req.body);

    // Falls noch keine Antwort gesendet wurde
    if (!res.headersSent) {
      res.end();
    }
  } catch (error) {
    console.error("Fehler in /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: req.body?.id ?? null,
      });
    }
  }
});


const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.error(`MCP HTTP server läuft auf http://localhost:${PORT}/mcp`);
});


console.error(supabaseKey);
console.error("Starte MCP HTTP server in 3 Sekunden...");


