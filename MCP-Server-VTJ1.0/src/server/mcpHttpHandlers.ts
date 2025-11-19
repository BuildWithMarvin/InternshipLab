// mcpHttpHandlers.ts
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '../mcp-server/streamableHttp.js';
import { InMemoryEventStore } from '../shared1/inMemoryEventStore.js';
import { isInitializeRequest } from '../types.js';
import { createMcpServer } from './mcp-server.js';

export interface McpPostHandlerDeps {
    useOAuth: boolean;
    sessionAuth: Record<string, any>;
    transports: Record<string, StreamableHTTPServerTransport>;
}

export interface McpGetHandlerDeps {
    useOAuth: boolean;
    transports: Record<string, StreamableHTTPServerTransport>;
}

export function createMcpPostHandler({
    useOAuth,
    sessionAuth,
    transports
}: McpPostHandlerDeps) {
    return async function mcpPostHandler(req: Request, res: Response) {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (sessionId) {
            console.log(`Received MCP request for session: ${sessionId}`);
        } else {
            console.log('Request body:', req.body);
        }

        if (useOAuth && (req as any).auth) {
            console.log('Authenticated user:', (req as any).auth);
        }

        try {
            let transport: StreamableHTTPServerTransport;

            if (sessionId && transports[sessionId]) {
                // Vorhandenen Transport wiederverwenden
                transport = transports[sessionId];

                // Auth-Kontext ggf. aktualisieren (falls Request mit gültigem Token kommt)
                if (useOAuth && (req as any).auth) {
                    sessionAuth[sessionId] = (req as any).auth;
                }
            } else if (!sessionId && isInitializeRequest(req.body)) {
                // Neue MCP-Session initialisieren
                const eventStore = new InMemoryEventStore();

                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    eventStore,
                    onsessioninitialized: newSessionId => {
                        console.log(`Session initialized with ID: ${newSessionId}`);
                        transports[newSessionId] = transport;

                        if (useOAuth && (req as any).auth) {
                            sessionAuth[newSessionId] = (req as any).auth;
                            console.log(
                                '[MCP] Stored auth context for session',
                                newSessionId,
                                sessionAuth[newSessionId]
                            );
                        }
                    }
                });

                // Aufräumen bei Verbindungsende
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && transports[sid]) {
                        console.log(
                            `Transport closed for session ${sid}, removing from transports map`
                        );
                        delete transports[sid];
                        delete sessionAuth[sid];
                    }
                };

                // MCP-Server erstellen und verbinden
                const server = createMcpServer({ useOAuth, sessionAuth });
                await server.connect(transport);

                await transport.handleRequest(req, res, req.body);
                return; // Bereits bearbeitet
            } else {
                // Ungültige Anfrage - keine Sitzungs-ID oder keine Initialisierungsanfrage
                res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Bad Request: No valid session ID provided'
                    },
                    id: null
                });
                return;
            }

            // Anfrage mit bestehendem Transport bearbeiten
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error'
                    },
                    id: null
                });
            }
        }
    };
}

export function createMcpGetHandler({
    useOAuth,
    transports
}: McpGetHandlerDeps) {
    return async function mcpGetHandler(req: Request, res: Response) {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }

        if (useOAuth && (req as any).auth) {
            console.log('Authenticated SSE connection from user:', (req as any).auth);
        }

        const lastEventId = req.headers['last-event-id'] as string | undefined;
        if (lastEventId) {
            console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
        } else {
            console.log(`Establishing new SSE stream for session ${sessionId}`);
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    };
}
