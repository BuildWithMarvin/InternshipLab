# MCP Demo Server mit VTJ-OAuth-Integration

Dieses Projekt ist ein **Demo-MCP-Server**, der sich über **OAuth** bei einem eigenen Auth-Server authentifiziert und anschließend über die **Visual Trading Journal (VTJ) API** Depotdaten abrufen kann.

## Was macht dieses Projekt?

- Startet einen **MCP-HTTP-Server** (`/mcp`), der Tools bereitstellt:
  - `greet` – einfaches Begrüßungs-Tool
  - `vtj-get-depot-info` – ruft Depotdaten aus der VTJ-API ab
- Startet einen **OAuth-/Auth-Server**, der:
  - einen Login gegen die **VTJ-API** anbietet
  - **OAuth 2.0 mit PKCE** bereitstellt
  - Access Tokens ausgibt und per `/introspect` prüft
- Speichert VTJ-Accounts (Credentials, Session, Depot-IDs) **in Memory** und macht:
  - **Auto-ReLogin**, wenn die VTJ-Session abgelaufen ist
- Nutzt eine **zusätzliche MCP-Session** (über `Mcp-Session-Id`) für
  - Streaming per **SSE (Server-Sent Events)**  
  - Zuordnung von Auth-Kontext zu einer laufenden MCP-Session



## Wie spielen VTJ, OAuth und MCP zusammen?

### 1. VTJ-Login (Auth-Server)

1. User ruft `/authorize` auf → wird zu `/login` umgeleitet, falls noch nicht eingeloggt.
2. `POST /login`:
   - schickt Username/Passwort an `VTJ_LOGIN_URL`
   - VTJ-API liefert `user._id`, `session` und Depots
   - Es wird ein **VTJ-Account** im In-Memory-Store angelegt:
     - `userId` (VTJ-User-ID)
     - `vtjUsername` / `vtjPassword`
     - `vtjSession`
     - `depotIds`
   - User-Infos landen in der **Express-Session** (`req.session.user`).

### 2. OAuth-Flow

3. Beim Aufruf von `/authorize` mit PKCE:
   - `authorizePreHook` hängt die VTJ-`userId` an die `code_challenge` (Mapping in einer Map).
4. Der Auth-Server gibt einen **Authorization Code** zurück.
5. Der Client tauscht den Code gegen ein **Access-Token**:
   - intern wird `code_challenge → userId` aufgelöst
   - zu dem Token wird serverseitig gespeichert:
     - `extra.userId = <VTJ-User-ID>`

> Wichtig:  
> - Der Token-String selbst ist nur ein zufälliger UUID-String.  
> - Die `userId` steckt **nicht im Token**, sondern in der **Token-Metadaten-Map** auf dem Server.

### 3. Token-Introspektion

6. Der MCP-Server erhält Requests mit `Authorization: Bearer <access_token>`.
7. Er prüft das Token über `/introspect` beim Auth-Server.
8. Die Antwort enthält u. a.:
   - `user_id` (VTJ-User-ID)
   - `vtj_session`
   - `depot_ids`
   - `vtj_status`
9. Diese Infos werden im MCP-Server in `sessionAuth[sessionId]` gespeichert und stehen den Tools zur Verfügung.

### 4. VTJ-Depotzugriff + Auto-ReLogin

10. Das MCP-Tool `vtj-get-depot-info`:
    - liest `userId` + `depotIds` aus `sessionAuth[extra.sessionId]`
    - ruft `callVtjDepotApiWithAutoRelogin(userId, depotId?)` auf
11. `callVtjDepotApiWithAutoRelogin`:
    - nimmt die aktuelle `vtjSession` aus dem VTJ-Account
    - ruft `GET VTJ_API_BASE_URL/depot/account?depot=...` mit Header `session: <vtjSession>` auf
    - wenn 401/403:
      - führt Auto-ReLogin mit gespeicherten Credentials durch
      - aktualisiert `vtjSession` + `depotIds`
      - versucht den Depot-Call erneut

---

## Session-Ebenen im Projekt

Es gibt **drei verschiedene „Sessions“**, die getrennt sind:

1. **Express-Session (Auth-Server)**  
   - Cookie-basierte Session im Browser  
   - Speichert: VTJ-User (für `/login` und `/authorize`)

2. **OAuth-Access-Token**  
   - Wird aus dem Authorization Code erzeugt  
   - Ist nur ein Random-String (UUID)  
   - Auf dem Auth-Server: Mapping `token → { clientId, scopes, extra.userId, ... }`  
   - Zwischen MCP-Server und Auth-Server wird `user_id` über `/introspect` übertragen.

3. **MCP-Session (für Streaming/SSE)**  
   - Eigene Session-ID (`Mcp-Session-Id`) im Header  
   - Wird beim ersten MCP-Initialize-Request erzeugt  
   - Dient dazu:
     - den passenden `StreamableHTTPServerTransport` zu finden  
     - Auth-Kontext (`sessionAuth[sessionId]`) für Tools bereitzuhalten  
     - denselben Stream über `GET /mcp` (SSE) wieder anzuschließen

---

## Projektstruktur (relevante Dateien)

- **`demoInMemoryOAuthProvider.ts`**
  - VTJ-Account-Store (`VtjAccount`, `vtjAccounts`, `getVtjAccount`, …)
  - In-Memory-OAuth-Provider (`DemoInMemoryAuthProvider`)
  - Auth-Server-Setup (`setupAuthServer` mit `/login`, `/introspect`, `/authorize`)

- **`mcp-server.ts`**
  - Erstellt den MCP-Server (`createMcpServer`)
  - Registriert:
    - `greet`
    - `vtj-get-depot-info` (ruft VTJ-Depot-API über `callVtjDepotApiWithAutoRelogin`)

- **`mcpHttpHandlers.ts`**
  - `createMcpPostHandler` – verarbeitet MCP-Requests (JSON-RPC)
  - `createMcpGetHandler` – stellt SSE-Verbindung für MCP-Streaming bereit
  - Verknüpft MCP-Session-ID ↔ Transport ↔ Auth-Kontext

- **`vtjClient.ts`**
  - Lädt VTJ-Konfiguration aus `vtj-config.json`
  - Implementiert Auto-ReLogin mit gespeicherten Credentials
  - `callVtjDepotApiWithAutoRelogin(userId, depotId?)`  
    → zentrale Funktion für Depotzugriffe mit Session-Refresh

---

## Konfiguration

Die Ports und VTJ-URLs werden aus einer JSON-Datei geladen (z. B. `vtj-config.json`):

