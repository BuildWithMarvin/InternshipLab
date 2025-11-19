import { randomUUID } from 'node:crypto';
import { AuthorizationParams, OAuthServerProvider } from '../mcp-server/auth/provider.js';
import { OAuthRegisteredClientsStore } from '../mcp-server/auth/clients.js';
import { OAuthClientInformationFull, OAuthMetadata, OAuthTokens } from '../shared/auth.js';
import express, { Request, Response, type RequestHandler } from 'express';
import { AuthInfo } from '../mcp-server/auth/types.js';
import { createOAuthMetadata, mcpAuthRouter } from '../mcp-server/auth/router.js';
import { resourceUrlFromServerUrl } from '../shared/auth-utils.js';
import { InvalidRequestError } from '../mcp-server/auth/errors.js';
import session from 'express-session';

// === VTJ Account Store (PROTOTYP – Credentials unverschlüsselt) ===

type VtjAccountStatus = 'CONNECTED' | 'BROKEN_NEEDS_USER';

export interface VtjAccount {
    userId: string; // VTJ-User-ID (z.B. _id aus der VTJ-API)
    vtjUsername: string; // Login-Username (Email)
    vtjPassword: string; // Login-Passwort (Prototyp: Klartext)
    vtjSession: string; // Aktuelle VTJ-Session-ID
    depotIds: string[]; // Liste der Depot-IDs
    status: VtjAccountStatus;
    failedLoginCount: number;
    lastLoginAt: number;
}

const vtjAccounts = new Map<string, VtjAccount>();

export function getVtjAccount(userId: string): VtjAccount | undefined {
    return vtjAccounts.get(userId);
}

export function upsertVtjAccountFromLogin(params: {
    userId: string;
    vtjUsername: string;
    vtjPassword: string;
    vtjSession: string;
    depotIds: string[];
}): VtjAccount {
    const account: VtjAccount = {
        userId: params.userId,
        vtjUsername: params.vtjUsername,
        vtjPassword: params.vtjPassword,
        vtjSession: params.vtjSession,
        depotIds: params.depotIds,
        status: 'CONNECTED',
        failedLoginCount: 0,
        lastLoginAt: Date.now()
    };

    vtjAccounts.set(params.userId, account);
    return account;
}

export function updateVtjSessionForUser(userId: string, vtjSession: string, depotIds?: string[]) {
    const account = vtjAccounts.get(userId);
    if (!account) return;
    account.vtjSession = vtjSession;
    if (depotIds) {
        account.depotIds = depotIds;
    }
    account.status = 'CONNECTED';
    account.failedLoginCount = 0;
    account.lastLoginAt = Date.now();
}

export function markVtjAccountBroken(userId: string) {
    const account = vtjAccounts.get(userId);
    if (!account) return;
    account.status = 'BROKEN_NEEDS_USER';
    account.failedLoginCount += 1;
}

// Ruft Depot-Daten aus der VTJ-API ab und macht bei abgelaufener Session automatisch einen ReLogin.
// Verwendet den Endpoint:
//   GET https://api.visualtradingjournal.com/api/v1/vtj/depot/account?depot=<depotId>
// mit Header:
//   session: <session-string>


// === VTJ Login-Konfiguration ===
const VTJ_LOGIN_URL = 'https://api.visualtradingjournal.com/api/v1/vtj/user/login';
const VTJ_CLIENT_ID = 'vtj-app';
const VTJ_APP_VERSION = 'v2.5.2';
const VTJ_API_BASE_URL = 'https://api.visualtradingjournal.com/api/v1/vtj';

export class DemoInMemoryClientsStore implements OAuthRegisteredClientsStore {
    private clients = new Map<string, OAuthClientInformationFull>();

    async getClient(clientId: string) {
        return this.clients.get(clientId);
    }

    async registerClient(clientMetadata: OAuthClientInformationFull) {
        this.clients.set(clientMetadata.client_id, clientMetadata);
        return clientMetadata;
    }
}


export class DemoInMemoryAuthProvider implements OAuthServerProvider {
    clientsStore = new DemoInMemoryClientsStore();
    private codes = new Map<
        string,
        {
            params: AuthorizationParams;
            client: OAuthClientInformationFull;
        }
    >();
    private tokens = new Map<string, AuthInfo>();

    private codeChallengeUserContext = new Map<string, { userId: string }>();

    setUserContextForCodeChallenge(codeChallenge: string, userId: string) {
        this.codeChallengeUserContext.set(codeChallenge, { userId });
    }

    private getUserContextForCodeChallenge(codeChallenge: string) {
        return this.codeChallengeUserContext.get(codeChallenge);
    }

    private clearUserContextForCodeChallenge(codeChallenge: string) {
        this.codeChallengeUserContext.delete(codeChallenge);
    }

    constructor(private validateResource?: (resource?: URL) => boolean) {}

    async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
        const code = randomUUID();

        const searchParams = new URLSearchParams({ code });
        if (params.state !== undefined) {
            searchParams.set('state', params.state);
        }

        this.codes.set(code, { client, params });

        if (!client.redirect_uris.includes(params.redirectUri)) {
            throw new InvalidRequestError('Unregistered redirect_uri');
        }
        const targetUrl = new URL(params.redirectUri);
        targetUrl.search = searchParams.toString();
        res.redirect(targetUrl.toString());
    }

    async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
        const codeData = this.codes.get(authorizationCode);
        if (!codeData) {
            throw new Error('Invalid authorization code');
        }
        return codeData.params.codeChallenge;
    }

async exchangeAuthorizationCode(
  client: OAuthClientInformationFull,
  authorizationCode: string,
  _codeVerifier?: string
): Promise<OAuthTokens> {
  const codeData = this.codes.get(authorizationCode);
  if (!codeData) {
    throw new Error('Invalid authorization code');
  }

  if (codeData.client.client_id !== client.client_id) {
    throw new Error(
      `Authorization code was not issued to this client, ${codeData.client.client_id} != ${client.client_id}`
    );
  }

  if (this.validateResource && !this.validateResource(codeData.params.resource)) {
    throw new Error(`Invalid resource: ${codeData.params.resource}`);
  }

  this.codes.delete(authorizationCode);

  let userId: string | undefined;
  const cc = codeData.params.codeChallenge;
  console.log('[AUTH] exchangeAuthorizationCode: codeData.params =', codeData.params);

  if (cc) {
    const ctx = this.getUserContextForCodeChallenge(cc);
    console.log('[AUTH] exchangeAuthorizationCode: context for', cc, '->', ctx);

    if (ctx) {
      userId = ctx.userId;
    } else {
      console.warn('[AUTH] exchangeAuthorizationCode: kein userContext für codeChallenge', cc);
    }
    this.clearUserContextForCodeChallenge(cc);
  } else {
    console.warn('[AUTH] exchangeAuthorizationCode: codeData.params.codeChallenge ist undefined');
  }

  const token = randomUUID();

  const tokenData: AuthInfo = {
    token,
    clientId: client.client_id,
    scopes: codeData.params.scopes || [],
    expiresAt: Date.now() + 3600000,
    resource: codeData.params.resource,
    extra: userId ? { userId } : {}
  };

  console.log('[AUTH] Storing tokenData:', tokenData);

  this.tokens.set(token, tokenData);

  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    scope: (codeData.params.scopes || []).join(' ')
  };
}


    async exchangeRefreshToken(
        _client: OAuthClientInformationFull,
        _refreshToken: string,
        _scopes?: string[],
        _resource?: URL
    ): Promise<OAuthTokens> {
        throw new Error('Not implemented for example demo');
    }

    async verifyAccessToken(token: string): Promise<AuthInfo> {
        const tokenData = this.tokens.get(token);
        if (!tokenData || !tokenData.expiresAt || tokenData.expiresAt < Date.now()) {
            throw new Error('Invalid or expired token');
        }

        // 🔁 extra NICHT verlieren!
        return {
            token: tokenData.token,
            clientId: tokenData.clientId,
            scopes: tokenData.scopes,
            expiresAt: Math.floor(tokenData.expiresAt / 1000),
            resource: tokenData.resource,
            extra: tokenData.extra
        };
    }
}

// === HILFSFUNKTIONEN FÜR DYNAMISCHE PKCE-CLIENTS ===
function isLoopbackRedirect(uri: string): boolean {
    try {
        const u = new URL(uri);
        return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

async function ensurePublicPkceClient(
    store: DemoInMemoryAuthProvider['clientsStore'],
    client_id: string,
    redirect_uri: string
): Promise<void> {
    const existing = await store.getClient(client_id);
    if (existing) {
        // Redirect ggf. ergänzen
        if (Array.isArray(existing.redirect_uris) && !existing.redirect_uris.includes(redirect_uri)) {
            existing.redirect_uris.push(redirect_uri);
            await store.registerClient(existing);
        }
        return;
    }

    if (!isLoopbackRedirect(redirect_uri)) {
        throw new Error('invalid_redirect_uri: only loopback redirect URIs are allowed');
    }

    const meta: OAuthClientInformationFull = {
        client_id,
        token_endpoint_auth_method: 'none', // Public client
        grant_types: ['authorization_code'],
        response_types: ['code'],
        redirect_uris: [redirect_uri]
    };

    await store.registerClient(meta);
    console.log('[AUTH] registered public PKCE client:', client_id, redirect_uri);
}

export const setupAuthServer = ({
    authServerUrl,
    mcpServerUrl,
    strictResource
}: {
    authServerUrl: URL;
    mcpServerUrl: URL;
    strictResource: boolean;
}): OAuthMetadata => {
    console.log('[AUTH-SETUP] strictResource parameter:', strictResource);
    const validateResource = strictResource
        ? (resource?: URL) => {
              if (!resource) return false;
              const expectedResource = resourceUrlFromServerUrl(mcpServerUrl);
              console.log('[AUTH-SETUP] Validating resource:', resource?.toString(), 'expected:', expectedResource.toString());
              return resource.toString() === expectedResource.toString();
          }
        : undefined;

    console.log('[AUTH-SETUP] validateResource function:', validateResource ? 'DEFINED' : 'UNDEFINED');
    const provider = new DemoInMemoryAuthProvider(validateResource);
    const authApp = express();
    authApp.use(express.json());
    authApp.use(express.urlencoded()); // For introspection requests

    authApp.use(
        session({
            secret: process.env.SESSION_SECRET ?? 'dev-session-secret',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false // lokal ok; in Prod: true + HTTPS
            }
        })
    );

    // Hilfsfunktionen lokal (können auch top-level stehen, aber lokal ist ok)
    const isLoopbackRedirect = (uri: string): boolean => {
        try {
            const u = new URL(uri);
            return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        } catch {
            return false;
        }
    };

    const ensurePublicPkceClient = async (
        clientStore: DemoInMemoryAuthProvider['clientsStore'],
        client_id: string,
        redirect_uri: string
    ) => {
        const existing = await clientStore.getClient(client_id);
        if (existing) {
            if (Array.isArray(existing.redirect_uris) && !existing.redirect_uris.includes(redirect_uri)) {
                existing.redirect_uris.push(redirect_uri);
                await clientStore.registerClient(existing);
            }
            return;
        }
        if (!isLoopbackRedirect(redirect_uri)) {
            throw new Error('invalid_redirect_uri: only loopback redirect URIs are allowed');
        }
        await clientStore.registerClient({
            client_id,
            token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code'],
            response_types: ['code'],
            redirect_uris: [redirect_uri]
        });
        console.log('[AUTH] registered public PKCE client:', client_id, redirect_uri);
    };

    // GET /login: Zeigt ein simples Login-Formular für den Nutzer
    authApp.get('/login', (req: Request, res: Response) => {
        const returnTo = (req.query.returnTo as string) ?? '/authorize';

        res.send(`
      <html>
        <head>
          <title>Login</title>
        </head>
        <body>
          <h1>Visual Trading Journal Login</h1>
          <form method="post" action="/login">
            <input type="hidden" name="returnTo" value="${returnTo}" />
            <div>
              <label>
                Benutzername (E-Mail):
                <input type="text" name="username" required />
              </label>
            </div>
            <div>
              <label>
                Passwort:
                <input type="password" name="password" required />
              </label>
            </div>
            <button type="submit">Einloggen</button>
          </form>
        </body>
      </html>
    `);
    });

    // POST /login: Credentials an die VTJ-API schicken und Session setzen
    authApp.post('/login', async (req: Request, res: Response) => {
        const { username, password, returnTo } = req.body as {
            username?: string;
            password?: string;
            returnTo?: string;
        };

        if (!username || !password) {
            res.status(400).send('Username und Passwort sind erforderlich');
            return;
        }

        try {
            const vtjResp = await fetch(VTJ_LOGIN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    client: VTJ_CLIENT_ID,
                    version: VTJ_APP_VERSION
                })
            });

            if (!vtjResp.ok) {
                const text = await vtjResp.text().catch(() => '');
                console.error('[VTJ-LOGIN] HTTP-Fehler:', vtjResp.status, text);
                res.status(401).send('Login fehlgeschlagen (HTTP-Fehler)');
                return;
            }

            const data = (await vtjResp.json()) as any;

            if (data.responseCode !== 1 || !data.user || !data.session) {
                console.error('[VTJ-LOGIN] Unexpected response:', data);
                res.status(401).send('Login fehlgeschlagen (ungültige Credentials)');
                return;
            }

            const userId: string = data.user._id;

            // Depots aus VTJ-Response extrahieren
            const depots = Array.isArray(data.user.depots) ? data.user.depots : [];
            const depotIds: string[] = depots.map((d: any) => d?._id).filter((id: any) => typeof id === 'string');

            // 👉 HIER landen Credentials + Session + Depot-IDs im VTJ-Account-Store
            upsertVtjAccountFromLogin({
                userId,
                vtjUsername: username,
                vtjPassword: password,
                vtjSession: data.session,
                depotIds
            });

            // User-Infos in der Express-Session speichern (für /authorize)
            (req.session as any).user = {
                id: userId,
                email: data.user.email,
                displayName: data.user.profile?.displayName,
                vtjSession: data.session,
                depotIds
            };

            console.log('[VTJ-LOGIN] User eingeloggt:', data.user.email);
            console.log('[VTJ-Session] User eingeloggt:', data.session, 'Depots:', depotIds);

            res.redirect(returnTo || '/authorize');
        } catch (e) {
            console.error('[VTJ-LOGIN] Fehler beim Aufruf der VTJ API:', e);
            res.status(500).send('Interner Fehler beim Login');
        }
    });

    // >>> HIER: der Hook als RequestHandler (keine Klasse nötig)
    const authorizePreHook: RequestHandler = (req, res, next): void => {
        (async () => {
            const sessionUser = (req.session as any)?.user;
            if (!sessionUser) {
                const returnTo = req.originalUrl || '/authorize';
                console.log('[AUTH] Kein User in Session, Redirect zu /login mit returnTo =', returnTo);
                res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
                return;
            }

            const { client_id, redirect_uri, code_challenge, code_challenge_method } = req.query as Record<string, string | undefined>;

            console.log('[AUTH] /authorize prehook:', {
                userId: sessionUser.id,
                client_id,
                redirect_uri,
                code_challenge,
                code_challenge_method
            });

            // 🟢 WICHTIG: userId IMMER an die Code Challenge hängen, sobald eine da ist
            if (code_challenge) {
                provider.setUserContextForCodeChallenge(String(code_challenge), String(sessionUser.id));
                console.log('[AUTH] setUserContextForCodeChallenge:', code_challenge, '->', sessionUser.id);
            }

            // PKCE-Client nur registrieren, wenn wir wirklich einen PKCE-Flow haben
            if (client_id && redirect_uri && code_challenge && code_challenge_method === 'S256') {
                await ensurePublicPkceClient(provider.clientsStore, String(client_id), String(redirect_uri));
            }

            next();
        })().catch(e => {
            console.error('[AUTH] Fehler im authorizePreHook:', e);
            res.status(400).json({
                error: 'invalid_request',
                error_description: e instanceof Error ? e.message : String(e)
            });
        });
    };

    // Wichtig: vor dem mcpAuthRouter mounten

    // --- NEU: Vor dem Router /authorize abfangen und Public-PKCE-Clients dynamisch zulassen ---

    authApp.use('/authorize', authorizePreHook);
    // OAuth-Routen zum Authentifizierungsserver hinzufügen
    // HINWEIS: Dadurch wird auch eine geschützte Metadatenroute für Ressourcen hinzugefügt,
    //
    authApp.use(
        mcpAuthRouter({
            provider,
            issuerUrl: authServerUrl,
            scopesSupported: ['mcp:tools']
        })
    );

    authApp.post('/introspect', async (req: Request, res: Response) => {
        try {
            const { token } = req.body;
            if (!token) {
                res.status(400).json({ error: 'Token is required' });
                return;
            }

            const tokenInfo = await provider.verifyAccessToken(token);
              console.log('[AUTH] /introspect tokenInfo:', tokenInfo);
            const userId = tokenInfo.extra?.userId as string | undefined;
            const vtjAccount = userId ? getVtjAccount(userId) : undefined;

            res.json({
                active: true,
                client_id: tokenInfo.clientId,
                scope: tokenInfo.scopes.join(' '),
                exp: tokenInfo.expiresAt,
                aud: tokenInfo.resource,
                user_id: userId,
                vtj_session: vtjAccount?.vtjSession,
                depot_ids: vtjAccount?.depotIds ?? [],
                vtj_status: vtjAccount?.status ?? 'UNKNOWN'
            });
        } catch (error) {
            res.status(401).json({
                active: false,
                error: 'Unauthorized',
                error_description: `Invalid token: ${error}`
            });
        }
    });

    const auth_port = authServerUrl.port;
    authApp.listen(auth_port, error => {
        if (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
        console.log(`OAuth Authorization Server listening on port ${auth_port}`);
    });

    const oauthMetadata: OAuthMetadata = createOAuthMetadata({
        provider,
        issuerUrl: authServerUrl,
        scopesSupported: ['mcp:tools']
    });

    oauthMetadata.introspection_endpoint = new URL('/introspect', authServerUrl).href;

    return oauthMetadata;
};
