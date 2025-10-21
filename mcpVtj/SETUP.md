# Claude Desktop Setup-Anleitung für VTJ MCP Server

## Schritt 1: Server starten

```bash
# Im mcpVtj-Verzeichnis:
npm start
```

Der Server läuft jetzt auf `http://localhost:3000`

## Schritt 2: Token holen

1. **Browser öffnen:** Gehe zu http://localhost:3000
2. **Einloggen:** Gib deine VTJ-Credentials ein (Username & Password)
3. **Token kopieren:** Nach erfolgreichem Login wird dir ein verschlüsselter Token angezeigt
4. **Token speichern:** Klicke auf "Copy Token to Clipboard"

## Schritt 3: Claude Desktop konfigurieren

### Config-Datei finden:

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Config-Datei bearbeiten:

Öffne die `claude_desktop_config.json` und füge den MCP-Server hinzu:

```json
{
  "mcpServers": {
    "vtj-auth-server": {
      "url": "http://localhost:3000/mcp",
      "transport": {
        "type": "http"
      },
      "env": {
        "TOKEN": "DEIN_TOKEN_HIER_EINFÜGEN"
      }
    }
  }
}
```

**Wichtig:** Ersetze `DEIN_TOKEN_HIER_EINFÜGEN` mit dem Token aus Schritt 2!

### Beispiel mit echtem Token:

```json
{
  "mcpServers": {
    "vtj-auth-server": {
      "url": "http://localhost:3000/mcp",
      "transport": {
        "type": "http"
      },
      "env": {
        "TOKEN": "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ=="
      }
    }
  }
}
```

## Schritt 4: Claude Desktop neu starten

1. Claude Desktop **komplett schließen**
2. Claude Desktop neu öffnen
3. Der MCP-Server sollte jetzt verbunden sein

## Schritt 5: Verfügbare Tools verwenden

In Claude Desktop kannst du nun folgende Tools verwenden:

### 1. **authenticate**
Validiert deinen Token:
```
Bitte authentifiziere meinen Token
```

### 2. **get_depot**
Holt Depot-Daten von der VTJ API:
```
Zeige mir meine Depot-Daten
```

### 3. **get_session_status**
Prüft Token-Status und Ablaufzeit:
```
Wie ist der Status meiner Session?
```

## Troubleshooting

### Problem: "Server nicht erreichbar"

**Lösung:**
- Prüfe, ob der Server läuft: `curl http://localhost:3000/health`
- Prüfe, ob Port 3000 frei ist
- Prüfe Firewall-Einstellungen

### Problem: "Token ungültig"

**Lösung:**
- Token ist abgelaufen (24h Gültigkeit)
- Neuen Token holen: http://localhost:3000
- Token in Config aktualisieren
- Claude Desktop neu starten

### Problem: "Tools werden nicht angezeigt"

**Lösung:**
- Claude Desktop komplett beenden (auch Background-Prozesse)
- Config-Datei prüfen (JSON-Syntax korrekt?)
- Server-Logs prüfen: `npm start`
- Claude Desktop neu starten

## Token-Verwaltung

### Token-Gültigkeit prüfen:
```bash
curl -X POST http://localhost:3000/api/validate-token \
  -H "Content-Type: application/json" \
  -d '{"token":"DEIN_TOKEN"}'
```

### Neuen Token holen:
1. Gehe zu http://localhost:3000
2. Logge dich mit VTJ-Credentials ein
3. Kopiere den neuen Token
4. Aktualisiere `claude_desktop_config.json`
5. Claude Desktop neu starten

## Erweiterte Konfiguration

### Mehrere MCP-Server:

```json
{
  "mcpServers": {
    "vtj-auth-server": {
      "url": "http://localhost:3000/mcp",
      "transport": {
        "type": "http"
      },
      "env": {
        "TOKEN": "dein_vtj_token_hier"
      }
    },
    "andere-server": {
      "url": "http://localhost:4000/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

### Mit Custom Port:

Wenn der Server auf einem anderen Port läuft:

```json
{
  "mcpServers": {
    "vtj-auth-server": {
      "url": "http://localhost:8080/mcp",
      "transport": {
        "type": "http"
      },
      "env": {
        "TOKEN": "dein_token_hier"
      }
    }
  }
}
```

## Server-Endpoints

Alle verfügbaren Endpoints:

- `POST /mcp` - Hauptendpoint für MCP-Requests
- `POST /mcp/initialize` - Client-Initialisierung
- `POST /mcp/tools/list` - Tool-Liste abrufen
- `POST /mcp/tools/call` - Tool ausführen
- `GET /mcp/capabilities` - Server-Capabilities

## Logs prüfen

### Server-Logs:
```bash
npm start
```

Alle Requests werden mit Timestamp und IP geloggt:
```
[2025-10-21T08:09:07.219Z] GET /health - IP: ::1
[MCP HTTP] POST /tools/call
```

### Claude Desktop Logs:

**Windows:**
```
%APPDATA%\Claude\logs\
```

**macOS:**
```
~/Library/Logs/Claude/
```

## Sicherheit

⚠️ **Wichtig:**
- Token nie in Git committen
- Token nicht öffentlich teilen
- Token alle 24 Stunden erneuern
- `.env` in `.gitignore` hinzufügen

## Support

Bei Problemen:
1. Server-Logs prüfen
2. Claude Desktop Logs prüfen
3. Token-Validität prüfen: `POST /api/validate-token`
4. Server-Health prüfen: `GET /health`
