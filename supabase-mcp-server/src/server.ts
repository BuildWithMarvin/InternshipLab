import 'dotenv/config'; 
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from '@supabase/supabase-js';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const supabaseUrl = process.env.SUPABASE_URL 
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. Please check your .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "Supabase MCP Server",
  version: "1.0.0",
});

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, 
});


server.tool(
  "get_playlists",
  "Gibt alle Playlists zurück",
  {}, 
  async () => {
   
    const { data, error } = await supabase.from('playlists').select('*');

    if (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching playlists: ${error.message ?? "Unknown error"}`,
          }
        ]
      };
    }

    if (!data || data.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Keine Playlists gefunden.",
          }
        ]
      };
    }

    const playlistTexts = data.map(
      (playlist, idx) => `${idx + 1}. ${playlist.name || "Unbenannte Playlist"}`
    );
    const text = `Gefundene Playlists (${data.length}):\n` + playlistTexts.join("\n");

    return {
      content: [
        {
          type: "text",
          text,
        }
      ]
    };
  }
);

    
app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP HTTP server läuft auf http://localhost:${PORT}/mcp`);

});









