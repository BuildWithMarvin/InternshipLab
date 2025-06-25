import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from '@supabase/supabase-js';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import 'dotenv/config';
import { z } from "zod";
// Ensure your environment variables are correctly loaded and accessible.
// For production, consider a more robust way to manage environment variables.
const supabaseUrl = process.env.SUPABASE_URL;
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
server.tool("get_playlists", "Find playlists by name or get all playlists", {
    name: z.string().optional().describe("Name of the playlist (optional)"),
}, async ({ name }) => {
    let query = supabase.from('playlists').select('*');
    if (name) {
        query = query.eq('name', name);
    }
    const { data, error } = await query;
    if (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error fetching playlists: ${error.message}`,
                }
            ]
        };
    }
    if (!data || data.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: name
                        ? `No playlists found with name "${name}".`
                        : "No playlists found.",
                }
            ]
        };
    }
    // Playlists als Text formatieren
    const playlistTexts = data.map((playlist, idx) => `${idx + 1}. ${playlist.name || "Unnamed Playlist"}`);
    const text = `Found ${data.length} playlist(s):\n` + playlistTexts.join("\n");
    return {
        content: [
            {
                type: "text",
                text,
            }
        ]
    };
});
app.post("/mcp", async (req, res) => {
    try {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
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
// Example of how you might start your server (adjust port as needed)
// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//   console.log(`MCP Server running on port ${port}`);
// });
// You would also need to integrate the McpServer with your Express app,
// likely via a transport, for it to be accessible.
// Example (this part is illustrative and might need specific McpServer transport setup):
// app.use("/mcp", new StreamableHTTPServerTransport(server).middleware());
