import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";

dotenv.config();

const server = new McpServer({
  name: "hello-world-mcp-server",
  version: "1.0.0",
  capabilities: {
    tools: {
      hello: {
        description: "Gibt Hello, World! zurück",
        parameters: {  type: "object",
    properties: {},
    required: []},
        handler: async () => ({
          role: "assistant",
          content: [{ type: "text", text: "Hello, World!" }]
        })
      }
    }
  }
});

async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP Server läuft und gibt Hello World als Tool aus.");
}

startServer().catch(console.error);
