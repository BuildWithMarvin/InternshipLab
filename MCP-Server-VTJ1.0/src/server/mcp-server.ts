// mcpServer.ts
import { McpServer } from '../mcp-server/mcp.js';
import { z } from 'zod';
import { CallToolResult } from '../types.js';
import { callVtjDepotApiWithAutoRelogin } from './vtjClient.js';

export interface McpServerOptions {
    useOAuth: boolean;
    sessionAuth: Record<string, any>;
}

function textToolResult(text: string): CallToolResult {
    return {
        content: [
            {
                type: 'text',
                text
            }
        ]
    };
}

export function createMcpServer({ useOAuth, sessionAuth }: McpServerOptions): McpServer {
    const server = new McpServer(
        {
            name: 'simple-streamable-http-server',
            version: '1.0.0'
        },
        { capabilities: { logging: {} } }
    );

    // Einfaches Greeting-Tool
    server.registerTool(
        'greet',
        {
            title: 'Greeting Tool',
            description: 'A simple greeting tool',
            inputSchema: {
                name: z.string().describe('Name to greet')
            }
        },
        async ({ name }): Promise<CallToolResult> => {
            return textToolResult(`Hello, ${name}!`);
        }
    );

    // VTJ Depot-Tool
    server.registerTool(
        'vtj-get-depot-info',
        {
            title: 'VTJ Depot-Info',
            description: 'Ruft Depotinformationen aus der VisualTradingJournal-API ab',
            inputSchema: {
                depotIndex: z.number().optional().describe('Index des Depots (0-basiert). Standard: 0 = erstes Depot'),
                depotId: z.string().optional().describe('Alternative: direkte Depot-ID. Überschreibt depotIndex.')
            }
        },
        async ({ depotIndex = 0, depotId }, extra): Promise<CallToolResult> => {
            if (!useOAuth) {
                return textToolResult('Dieses Tool erfordert OAuth-Authentifizierung.');
            }

            if (!extra.sessionId) {
                return textToolResult('Keine MCP-Session-ID verfügbar.');
            }

            const authCtx = sessionAuth[extra.sessionId];
            if (!authCtx) {
                return textToolResult('Keine Authentifizierungsdaten für diese Session vorhanden.');
            }

            const userId = authCtx.userId as string | undefined;
            if (!userId) {
                return textToolResult('Kein VTJ-Benutzer mit diesem Token verknüpft.');
            }

            let effectiveDepotId = depotId;
            if (!effectiveDepotId) {
                const depotIds = (authCtx.depotIds as string[] | undefined) ?? [];
                if (depotIds.length === 0) {
                    return textToolResult('Für diesen Benutzer sind keine Depots bekannt.');
                }
                effectiveDepotId = depotIds[depotIndex] ?? depotIds[0];
            }

            try {
                const depotData = await callVtjDepotApiWithAutoRelogin(userId, effectiveDepotId!);

                return textToolResult(`Depotdaten für ${effectiveDepotId}:\n` + '```json\n' + JSON.stringify(depotData, null, 2) + '\n```');
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return textToolResult(`Fehler beim Abruf der VTJ-Depotdaten: ${msg}`);
            }
        }
    );

    return server;
}
