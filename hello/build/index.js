import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// Server-Instanz erstellen
const server = new McpServer({
    name: "hello-world-mcp-server",
    version: "1.0.0",
});
// Tool registrieren
server.tool("hello", "Gibt 'Hello, World!' zurück", {}, // keine Parameter
async () => {
    return {
        content: [
            {
                type: "text",
                text: "Hello, World!"
            }
        ]
    };
});
// Server-Start in einer eigenen Funktion
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
// Starten und Fehlerbehandlung
main().catch((error) => {
    process.exit(1);
});
