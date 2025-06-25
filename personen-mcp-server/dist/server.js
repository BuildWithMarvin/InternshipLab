import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import mysql from 'mysql';
import dotenv from 'dotenv';
import { z } from "zod";
dotenv.config();
const app = express();
app.use(express.json());
const server = new McpServer({
    name: "personen-tool-server",
    version: "1.0.0",
});
const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
});
const con = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
});
server.tool("find_person_by_email", "Find a person in the database by their email address", {
    email: z.string().email().describe("The email address of the person to search for"),
}, async ({ email }) => {
    const sql = "SELECT * FROM personen WHERE email = ?";
    return new Promise((resolve) => {
        con.query(sql, [email], (error, results) => {
            if (error) {
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `Error fetching person: ${error.message}`,
                        }
                    ]
                });
                return;
            }
            if (!results || results.length === 0) {
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `No person found with email "${email}".`,
                        }
                    ]
                });
                return;
            }
            const person = results[0];
            const text = `Person found:\nVorname: ${person.vorname}\nNachname: ${person.nachname}\nGeburtsdatum: ${person.geburtsdatum}\nEmail: ${person.email}`;
            resolve({
                content: [
                    {
                        type: "text",
                        text,
                    }
                ]
            });
        });
    });
});
server.tool("get_all_persons", "List all persons in the database", {}, async () => {
    const sql = "SELECT * FROM personen";
    return new Promise((resolve) => {
        con.query(sql, [], (error, results) => {
            if (error) {
                resolve({
                    content: [
                        {
                            type: "text",
                            text: `Error fetching persons: ${error.message}`,
                        }
                    ]
                });
                return;
            }
            if (!results || results.length === 0) {
                resolve({
                    content: [
                        {
                            type: "text",
                            text: "No persons found.",
                        }
                    ]
                });
                return;
            }
            let text = "All persons:\n\n";
            results.forEach((person, index) => {
                text += `Person #${index + 1}:\nVorname: ${person.vorname}\nNachname: ${person.nachname}\nGeburtsdatum: ${person.geburtsdatum}\nEmail: ${person.email}\n\n`;
            });
            resolve({
                content: [
                    {
                        type: "text",
                        text,
                    }
                ]
            });
        });
    });
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
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`MCP HTTP server läuft auf http://localhost:${PORT}/mcp`);
});
