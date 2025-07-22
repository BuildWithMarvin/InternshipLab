import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { MCPAuth, fetchServerConfig } from "mcp-auth";
import { MCPAuthTokenVerificationError } from "mcp-auth";
import fs from "fs";

function loadJsonFromFile(filepath: string): any {
  try {
    const fileContent = fs.readFileSync(filepath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error Loading JSON from file ${filepath}`);
  }
}

const env = loadJsonFromFile("./config/config.development.json");

async function main() {
  try {
    const authIssuer = env.authIssuer;
    const mcpAuth = new MCPAuth({
      server: await fetchServerConfig(authIssuer, { type: "oidc" }),
    });

    interface VerifiedToken {
      token: string;
      issuer: string;
      subject: string;
      clientId: string;
      scopes: string[];
      claims: Record<string, unknown>;
    }

    interface UserInfo {
      sub: string;
      [key: string]: unknown;
    }

    const verifyToken = async (token: string): Promise<VerifiedToken> => {
      const { issuer, userinfoEndpoint } = mcpAuth.config.server.metadata;

      if (!userinfoEndpoint) {
        throw new Error(
          "Userinfo-Endpunkt ist in den Server-Metadaten nicht konfiguriert"
        );
      }

      const response: Response = await fetch(userinfoEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new MCPAuthTokenVerificationError(
          "token_verification_failed",
          response
        );
      }

      const userInfo: UserInfo = await response.json();

      if (
        typeof userInfo !== "object" ||
        userInfo === null ||
        !("sub" in userInfo)
      ) {
        throw new MCPAuthTokenVerificationError("invalid_token", response);
      }

      return {
        token,
        issuer,
        subject: String(userInfo.sub), // 'sub' ist ein Standard-Anspruch (Claim) für das Subjekt (Benutzer-ID)
        clientId: "", // Client ID wird in diesem Beispiel nicht verwendet, kann aber gesetzt werden
        scopes: [],
        claims: userInfo,
      };
    };

    const server = new McpServer({
      name: "WhoAmI",
      version: "0.0.0",
    });

    server.tool("whoami", ({ authInfo }) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              authInfo?.claims ?? { error: "Nicht authentifiziert" }
            ),
          },
        ],
      };
    });

    // Nachfolgend der Boilerplate-Code aus der MCP SDK-Dokumentation
    const PORT = 3001;
    const app = express();

    app.use(express.json());

    app.use(mcpAuth.delegatedRouter());
    app.use(mcpAuth.bearerAuth(verifyToken));

    const transports: { [sessionId: string]: SSEServerTransport } = {};

    app.get("/sse", async (_req, res) => {
      
      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;

      res.on("close", () => {
        delete transports[transport.sessionId];
      });

      await server.connect(transport);
    });

    app.post("/messages", async (req, res) => {
      const sessionId = String(req.query.sessionId);
      const transport = transports[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send("Kein Transport für sessionId gefunden");
      }
    });

    app.listen(PORT);
  } catch (error) {
    console.error("Fehler beim Starten des Servers:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unbehandelter Fehler:", error);
  process.exit(1);
});
