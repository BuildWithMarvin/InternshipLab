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
const supabaseKey = process.env.SUPABASE_PAT;

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
  sessionIdGenerator: undefined,
});

await server.connect(transport);

app.post("/mcp", async (req, res) => {
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});


const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`MCP HTTP server läuft auf http://localhost:${PORT}/mcp`);
});

