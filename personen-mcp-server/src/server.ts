import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import mysql from "mysql";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

(async () => {
  const app = express();
  app.use(express.json());

  const server = new McpServer({
    name: "personen-tool-server",
    version: "1.0.0",
  });

  const con = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  // Register all tools BEFORE connecting to transport
  server.tool(
    "add_person",
    "Add a new person to the database",
    {
      vorname: z.string().min(1).describe("First name of the person"),
      nachname: z.string().min(1).describe("Last name of the person"),
      geburtsdatum: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Birth date in YYYY-MM-DD format"),
      email: z.string().email().describe("Email address of the person"),
    },
    async ({ vorname, nachname, geburtsdatum, email }) => {
      const sql =
        "INSERT INTO personen (vorname, nachname, geburtsdatum, email) VALUES (?, ?, ?, ?)";
      return new Promise((resolve) => {
        con.query(sql, [vorname, nachname, geburtsdatum, email], (error) => {
          if (error) {
            resolve({
              content: [
                {
                  type: "text",
                  text: `Error adding person: ${error.message}`,
                },
              ],
            });
            return;
          }
          resolve({
            content: [
              {
                type: "text",
                text: `Person successfully added:\nVorname: ${vorname}\nNachname: ${nachname}\nGeburtsdatum: ${geburtsdatum}\nEmail: ${email}`,
              },
            ],
          });
        });
      });
    }
  );

  server.tool(
    "remove_person",
    "remove a new person to the database",
    {
      vorname: z.string().min(1).describe("First name of the person"),
      nachname: z.string().min(1).describe("Last name of the person"),
    },
    async ({ vorname, nachname }) => {
      const sql = "DELETE FROM PERSONEN WHERE VORNAME = ? AND NACHNAME = ?";
      return new Promise((resolve) => {
        con.query(sql, [vorname, nachname], (error) => {
          if (error) {
            resolve({
              content: [
                {
                  type: "text",
                  text: `Error adding person: ${error.message}`,
                },
              ],
            });
            return;
          }
          resolve({
            content: [
              {
                type: "text",
                text: `Person successfully added:\nVorname: ${vorname}\nNachname: ${nachname}\n removed`,
              },
            ],
          });
        });
      });
    }
  );
  server.tool(
    "update_person_by_id",
    "Update an existing person's data by id",
    {
      id: z.number().int().positive().describe("ID of the person to update"),
      vorname: z.string().min(1).optional().describe("New first name"),
      nachname: z.string().min(1).optional().describe("New last name"),
      geburtsdatum: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("New birth date in YYYY-MM-DD format"),
      email: z.string().email().optional().describe("New email address"),
    },
    async ({ id, vorname, nachname, geburtsdatum, email }) => {
      // Sammle nur die Felder, die aktualisiert werden sollen
      const fieldsToUpdate: string[] = [];
      const values: any[] = [];

      if (vorname !== undefined) {
        fieldsToUpdate.push("vorname = ?");
        values.push(vorname);
      }
      if (nachname !== undefined) {
        fieldsToUpdate.push("nachname = ?");
        values.push(nachname);
      }
      if (geburtsdatum !== undefined) {
        fieldsToUpdate.push("geburtsdatum = ?");
        values.push(geburtsdatum);
      }
      if (email !== undefined) {
        fieldsToUpdate.push("email = ?");
        values.push(email);
      }

      if (fieldsToUpdate.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No fields provided to update.",
            },
          ],
        };
      }

      values.push(id); // für WHERE-Klausel

      const sql = `UPDATE personen SET ${fieldsToUpdate.join(
        ", "
      )} WHERE id = ?`;

      return new Promise((resolve) => {
        con.query(sql, values, (error, result) => {
          if (error) {
            resolve({
              content: [
                {
                  type: "text",
                  text: `Error updating person: ${error.message}`,
                },
              ],
            });
            return;
          }

          if (result.affectedRows === 0) {
            resolve({
              content: [
                {
                  type: "text",
                  text: `No person found with id ${id}.`,
                },
              ],
            });
            return;
          }

          resolve({
            content: [
              {
                type: "text",
                text: `Person with id ${id} was successfully updated.`,
              },
            ],
          });
        });
      });
    }
  );

  // Now connect to transport AFTER all tools are registered
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  app.post("/mcp", async (req, res) => {
    try {
      // Log session ID from request if present (will be undefined on first request)
      const sessionId =
        req.headers["mcp-session-id"] || req.headers["Mcp-Session-Id"];
      console.log("Request Session-ID:", sessionId || "none (new session)");

      await transport.handleRequest(req, res, req.body);

      // After handling, the response headers will contain the session ID
      console.log("Response Session-ID:", res.getHeader("mcp-session-id"));
    } catch (err) {
      if (!res.headersSent) {
        res
          .status(500)
          .json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
      }
    }
  });

  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`MCP HTTP server läuft auf http://localhost:${PORT}/mcp`);
  });
})();
