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



server.tool(
  "find_person_by_email",
  "Find a person in the database by their email address",
  {
    email: z.string().email().describe("The email address of the person to search for"),
  },
  async ({ email }) => {
    // Die Query mit Parameter
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
        // Person gefunden, Daten formatieren
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
  }
);

interface Person {
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  email: string;
}

server.tool(
  "get_all_persons",
  "List all persons in the database",
  {},
  async () => {
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
        results.forEach((person: Person, index: number) => {
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
  }
);

server.tool(
  "add_person",
  "Add a new person to the database",
  {
    vorname: z.string().min(1).describe("First name of the person"),
    nachname: z.string().min(1).describe("Last name of the person"),
    geburtsdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Birth date in YYYY-MM-DD format"),
    email: z.string().email().describe("Email address of the person"),
  },
  async ({ vorname, nachname, geburtsdatum, email }) => {
    const sql = "INSERT INTO personen (vorname, nachname, geburtsdatum, email) VALUES (?, ?, ?, ?)";
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

server.tool(
  "update_person_by_id",
  "Update an existing person's data by id",
  {
    id: z.number().int().positive().describe("ID of the person to update"),
    vorname: z.string().min(1).optional().describe("New first name"),
    nachname: z.string().min(1).optional().describe("New last name"),
    geburtsdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("New birth date in YYYY-MM-DD format"),
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

    const sql = `UPDATE personen SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;

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



const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`MCP HTTP server läuft auf http://localhost:${PORT}/mcp`);
})

