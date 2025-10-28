import mysql from "mysql2/promise";

// Create the connection to database
const connection = await mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "AuthorizationServer",
});

// saubere Klasse mit Dependency Injection für die DB-Connection
export default class Database {

  
  private clientId: number | null; // optionaler Cache
  constructor() {
   
    this.clientId = null; // optionaler Cache
  }

  async queryClientID(clientID: number): Promise<number> {
    const sql = "SELECT id FROM `clientids` WHERE `id` = ? LIMIT 1";
    const [rows] = await connection.execute(sql, [clientID]);

    const id = (rows as any)?.[0]?.id ?? null;
    if (id === null) {
      // lieber gezielt fehlschlagen als stillschweigend undefined zurückgeben
      throw new Error(`Client ${clientID} nicht gefunden`);
    }
    return id;
  }

  async queryLogin(username: string, password: string): Promise<string> {
    const sql = "SELECT password FROM `clientids` WHERE `username` = ? AND `password` = ? LIMIT 1";
    const [rows] = await connection.execute(sql, [username, password]);

    const id = (rows as any)?.[0]?.id ?? null;
    if (id === null) {
      // lieber gezielt fehlschlagen als stillschweigend undefined zurückgeben
      throw new Error(`Client ${username} nicht gefunden`);
    }
    return password;
  }
  // Beispiel 1: Ergebnis sofort in anderer Methode verwenden
  async doSomethingWithClient(clientID: number) {
    const id = await this.queryClientID(clientID);  // <— WICHTIG: await!
    // hier kannst du id benutzen
    return `Gefundener Client: ${id}`;
  }

  // Beispiel 2: „Direkter“ Zugriff später über ein Feld
  // Erst laden (einmalig), dann synchron auslesen.
  async initClient(clientID: number) {
    this.clientId = await this.queryClientID(clientID);
  }

  getClientId() {
    if (this.clientId == null) {
      throw new Error("Client-ID ist nicht geladen. Erst initClient() aufrufen.");
    }
    return this.clientId; // synchroner Zugriff NACH vorherigem await beim Init
  }
}
