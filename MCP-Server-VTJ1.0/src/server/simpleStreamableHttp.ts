import express, { RequestHandler } from 'express';
import cors from 'cors';
import {
    getOAuthProtectedResourceMetadataUrl,
    mcpAuthMetadataRouter
} from '../mcp-server/auth/router.js';
import { requireBearerAuth } from '../mcp-server/auth/middleware/bearerAuth.js';
import { setupAuthServer } from './demoInMemoryOAuthProvider.js';
import { OAuthMetadata } from '../shared/auth.js';
import { checkResourceAllowed } from '../shared/auth-utils.js';
import { InvalidTokenError, OAuthError } from '../mcp-server/auth/errors.js';
import type { StreamableHTTPServerTransport } from '../mcp-server/streamableHttp.js';
import { createMcpPostHandler, createMcpGetHandler } from './mcpHttpHandlers.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const strictOAuth = process.argv.includes('--oauth-strict');
const useOAuth = process.argv.includes('--oauth') || strictOAuth;

console.log('[BOOT] argv:', process.argv);
console.log('[BOOT] useOAuth:', useOAuth, 'strictOAuth:', strictOAuth);

// Diese Maps bleiben hier, werden aber von den MCP-Modulen benutzt
const sessionAuth: Record<string, any> = {};
const transports: Record<string, StreamableHTTPServerTransport> = {};


interface ServerConfig {
    MCP_PORT: number;
    MCP_AUTH_PORT: number;
}

function loadServerConfig(): ServerConfig {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = join(__dirname, 'vtj-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    const fullConfig = JSON.parse(configData);
    return {
        MCP_PORT: fullConfig.MCP_PORT,
        MCP_AUTH_PORT: fullConfig.MCP_AUTH_PORT
    };
}

const serverConfig = loadServerConfig();
const MCP_PORT = serverConfig.MCP_PORT;
const AUTH_PORT = serverConfig.MCP_AUTH_PORT;

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
    console.log('[TRACE-1 after json]', req.method, req.path, 'body:', req.body);
    next();
});

app.use(
    cors({
        origin: '*',
        exposedHeaders: ['Mcp-Session-Id']
    })
);

// === OAuth-Setup gekapselt ===

function configureOAuth(app: express.Express): RequestHandler | null {
    if (!useOAuth) return null;

    console.log('[BOOT] OAuth setup starting…');

    const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}/mcp`);
    const authServerUrl = new URL(`http://localhost:${AUTH_PORT}`);

    const oauthMetadata: OAuthMetadata = setupAuthServer({
        authServerUrl,
        mcpServerUrl,
        strictResource: strictOAuth
    });

    const tokenVerifier = {
        verifyAccessToken: async (token: string) => {
            const endpoint = oauthMetadata.introspection_endpoint;
            console.log('[AUTH] Verifying token via introspection endpoint:', endpoint);

            if (!endpoint) {
                throw new OAuthError(
                    'invalid_request',
                    'No token verification endpoint available in metadata'
                );
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ token }).toString()
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new InvalidTokenError(text || 'Invalid or expired token');
            }

            const data = await response.json();

            if (data.active === false) {
                throw new InvalidTokenError('Inactive token');
            }

            if (strictOAuth) {
                if (!data.aud) {
                    throw new OAuthError('invalid_request', 'Resource Indicator (RFC8707) missing');
                }
                if (
                    !checkResourceAllowed({
                        requestedResource: data.aud,
                        configuredResource: mcpServerUrl
                    })
                ) {
                    throw new OAuthError(
                        'invalid_target',
                        `Expected resource indicator ${mcpServerUrl}, got: ${data.aud}`
                    );
                }
            }

            return {
                token,
                clientId: data.client_id,
                scopes: data.scope ? data.scope.split(' ') : [],
                expiresAt: data.exp,
                userId: data.user_id,
                vtjSession: data.vtj_session,
                depotIds: Array.isArray(data.depot_ids) ? data.depot_ids : [],
                vtjStatus: data.vtj_status
            } as any;
        }
    };

    const RESOURCE_ORIGIN = new URL(`http://localhost:${MCP_PORT}/`);

    app.use(
        mcpAuthMetadataRouter({
            oauthMetadata,
            resourceServerUrl: RESOURCE_ORIGIN,
            scopesSupported: ['mcp:tools'],
            resourceName: 'MCP Demo Server'
        })
    );

    const authMiddleware = requireBearerAuth({
        verifier: tokenVerifier,
        requiredScopes: [],
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl)
    });

    console.log('[BOOT] authMiddleware created?', !!authMiddleware);
    return authMiddleware;
}

const authMiddleware = configureOAuth(app);

// === MCP-Routen-Handler aus Modul ===

const mcpPostHandler = createMcpPostHandler({ useOAuth, sessionAuth, transports });
const mcpGetHandler = createMcpGetHandler({ useOAuth, transports });

console.log(
    '[BOOT] Registering routes for /mcp with',
    useOAuth && authMiddleware ? 'AUTH' : 'NO AUTH'
);

// POST-Routen
if (useOAuth && authMiddleware) {
    app.post('/mcp', authMiddleware, mcpPostHandler);
} else {
    app.post('/mcp', mcpPostHandler);
}

// GET (SSE)
if (useOAuth && authMiddleware) {
    app.get('/mcp', authMiddleware, mcpGetHandler);
} else {
    app.get('/mcp', mcpGetHandler);
}

// === Server starten ===

app.listen(MCP_PORT, error => {
    if (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
    console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
});

// Graceful Shutdown

process.on('SIGINT', async () => {
    console.log('Shutting down server...');

    for (const sessionId in transports) {
        try {
            console.log(`Closing transport for session ${sessionId}`);
            await transports[sessionId].close();
            delete transports[sessionId];
            delete sessionAuth[sessionId];
        } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error);
        }
    }

    console.log('Server shutdown complete');
    process.exit(0);
});
