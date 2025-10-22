# VTJ MCP Authentication Server

HTTP-based Model Context Protocol (MCP)Authentication Server

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

### 2. Konfiguration

Kopiere `.env.example` zu `.env` und passe die Werte an:

```bash
cp .env.example .env
```

### 3. Server starten

```bash
# Development (mit Hot-Reload)
npm run dev

# Production
npm run build
npm start
```

### 4. Token holen

1. Öffne http://localhost:3000 im Browser
2. Logge dich mit deinen VTJ-Credentials ein
3. Kopiere den angezeigten Token

### 5. Claude Desktop und VSC Konfiguration konfiguration

**Config-Inhalt:**

Siehe: 

MCPVTJ/claudeconfig.json

MCPVTJ/.vscode/mcp.json

## 📋 Features

### Web Interface
- **Login-Seite** mit responsive Design
- **Token-Display** mit Copy-to-Clipboard-Funktion
- **Mobile-optimiert**

### Web API
- `POST /api/login` - Authentifizierung (Rate-Limited: 5/min)
- `POST /api/validate-token` - Token-Validierung (Rate-Limited: 20/min)
- `GET /api/status` - Server-Status

### MCP Protocol
- `POST /mcp` - JSON-RPC 2.0 Hauptendpoint
- `POST /mcp/initialize` - Client-Initialisierung
- `POST /mcp/tools/list` - Verfügbare Tools
- `POST /mcp/tools/call` - Tool-Ausführung
- `GET /mcp/capabilities` - Server-Capabilities

### MCP Tools

#### 1. **authenticate**
Validiert Token und gibt Token-Informationen zurück (Depot-ID, Ablaufzeit).

```json
{
  "name": "authenticate",
  "arguments": {
    "token": "your_encrypted_token"
  }
}
```

#### 2. **get_depot**
Ruft Depot-Daten von der VTJ API ab.

```json
{
  "name": "get_depot",
  "arguments": {
    "token": "your_encrypted_token"
  }
}
```

#### 3. **get_session_status**
Prüft Token-Status und Ablaufzeit.

```json
{
  "name": "get_session_status",
  "arguments": {
    "token": "your_encrypted_token"
  }
}
```

## 🏗️ Architektur

```
mcpVtj/
├── src/
│   ├── api/              # VTJ API Client (Axios)
│   ├── auth/             # Stateless Token-Management (AES-256-GCM)
│   ├── mcp/              # MCP Server & Tools (Stateless)
│   ├── web/              # Web API Routes
│   ├── server.ts         # Express Server Setup
│   └── index.ts          # Entry Point
├── public/               # Static Files (Login UI)
├── dist/                 # Compiled JavaScript
└── .env                  # Environment Config
```

**Stateless Design:** Der Server speichert keine Sessions. Alle Authentifizierungsdaten sind in verschlüsselten Tokens enthalten.

## 🔒 Sicherheit

### Stateless Authentication
- **Kein Session-Store:** Server speichert keine Sessions in Memory/DB
- **Token-basiert:** Alle Authentifizierungsdaten im verschlüsselten Token
- **Skalierbar:** Keine Server-State, horizontal skalierbar

### Token-Verschlüsselung
- **Algorithmus:** AES-256-GCM
- **Key Derivation:** PBKDF2 (100,000 Iterationen, SHA-256)
- **Authentifizierung:** GCM Authentication Tag
- **Gültigkeit:** 24 Stunden
- **Payload:** VTJ-Session-ID, Depot-ID, Ablaufzeit

### Input-Validierung
- Username: 3-100 Zeichen, alphanumerisch + `@._-`
- Password: 6-255 Zeichen
- Token: Base64-Format-Validierung

### Rate-Limiting
- Login: 5 Versuche/Minute pro IP
- Token-Validation: 20 Requests/Minute pro IP

### Error-Handling
- Keine sensitiven Daten in Error-Responses
- Error-Message-Sanitization
- Generic Messages für Security-Errors

## 🌐 Environment Variables

```env
# Server Port (default: 3000)
PORT=3000

# Encryption Secret für AES-256-GCM (MINDESTENS 32 Zeichen!)
ENCRYPTION_SECRET=your-super-secret-key-at-least-32-chars

# VTJ API Base URL
VTJ_API_BASE_URL=https://api-beta.visualtradingjournal.com

# Server URL für Login-Links in Responses
SERVER_URL=http://localhost:3000

# CORS Origins (comma-separated, * für alle)
CORS_ORIGINS=*

# Node Environment (development|production)
NODE_ENV=development
```

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### API Status
```bash
curl http://localhost:3000/api/status
```

### MCP Capabilities
```bash
curl http://localhost:3000/mcp/capabilities
```

### Token Validation
```bash
curl -X POST http://localhost:3000/api/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"your_token_here"}'
```

### MCP Inspector
Der MCP Inspector ist als Dev-Dependency installiert und ermöglicht das interaktive Testen der MCP-Tools.

```bash
# MCP Server mit Inspector starten
npx @modelcontextprotocol/inspector node src/server.ts
```

## 📝 Scripts

```bash
# Development mit Hot-Reload
npm run dev

# TypeScript Build
npm run build

# Production Start
npm start

# Build-Ordner löschen
npm run clean
```
## 📚 API-Dokumentation

Vollständige API-Dokumentation verfügbar unter:
```
GET http://localhost:3000/api/info
```


