// vtjClient.ts
import {
    getVtjAccount,
    updateVtjSessionForUser,
    markVtjAccountBroken,
    type VtjAccount
} from './demoInMemoryOAuthProvider.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';


interface VtjConfig {
    VTJ_LOGIN_URL: string;
    VTJ_CLIENT_ID: string;
    VTJ_APP_VERSION: string;
    VTJ_API_BASE_URL: string;
}


function loadVtjConfig(): VtjConfig {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = join(__dirname, 'vtj-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    return JSON.parse(configData) as VtjConfig;
}

const config = loadVtjConfig();
const VTJ_LOGIN_URL = config.VTJ_LOGIN_URL;
const VTJ_CLIENT_ID = config.VTJ_CLIENT_ID;
const VTJ_APP_VERSION = config.VTJ_APP_VERSION;
const VTJ_API_BASE_URL = config.VTJ_API_BASE_URL;

async function vtjReloginWithStoredCredentials(userId: string): Promise<VtjAccount> {
    const account = getVtjAccount(userId);
    if (!account) {
        throw new Error('Kein VTJ-Account für diesen Benutzer vorhanden.');
    }

    console.log('[VTJ] Auto-ReLogin für User', userId);

    const resp = await fetch(VTJ_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: account.vtjUsername,
            password: account.vtjPassword,
            client: VTJ_CLIENT_ID,
            version: VTJ_APP_VERSION
        })
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('[VTJ] Auto-ReLogin HTTP-Fehler:', resp.status, text);
        markVtjAccountBroken(userId);
        throw new Error('VTJ Auto-ReLogin fehlgeschlagen (HTTP-Fehler). Bitte neu einloggen.');
    }

    const data = (await resp.json()) as any;
    if (data.responseCode !== 1 || !data.user || !data.session) {
        console.error('[VTJ] Auto-ReLogin unerwartete Antwort:', data);
        markVtjAccountBroken(userId);
        throw new Error('VTJ Auto-ReLogin fehlgeschlagen (ungültige Antwort). Bitte neu einloggen.');
    }

    const depots = Array.isArray(data.user.depots) ? data.user.depots : [];
    const depotIds = depots.map((d: any) => d?._id).filter((id: any) => typeof id === 'string');

    updateVtjSessionForUser(userId, data.session, depotIds);

    const updated = getVtjAccount(userId);
    if (!updated) {
        throw new Error('VTJ-Account nach Auto-ReLogin nicht gefunden.');
    }

    console.log('[VTJ] Auto-ReLogin erfolgreich für', data.user.email, 'Depots:', depotIds);
    return updated;
}

// Prototyp-Implementierung: Depot-API aufrufen, bei 401/403 Auto-ReLogin versuchen
export async function callVtjDepotApiWithAutoRelogin(
    userId: string,
    depotId?: string
): Promise<any> {
    let account = getVtjAccount(userId);
    if (!account) {
        throw new Error('Kein VTJ-Account für diesen Benutzer vorhanden.');
    }

    let effectiveDepotId = depotId;
    if (!effectiveDepotId) {
        if (!account.depotIds || account.depotIds.length === 0) {
            throw new Error('Für diesen VTJ-Account sind keine Depot-IDs gespeichert.');
        }
        effectiveDepotId = account.depotIds[0];
    }

    const callOnce = async (session: string) => {
        // URL an die echte VTJ-Depot-API anpassen, falls nötig
        const url = `${VTJ_API_BASE_URL}/depot/account?depot=${encodeURIComponent(
            effectiveDepotId!
        )}`;

        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'session': session
            }
        });

        return resp;
    };

    // 1. Versuch mit aktueller Session
    let resp = await callOnce(account.vtjSession);

    if (resp.ok) {
        const data = await resp.json().catch(() => null);
        return data;
    }

    // Wenn Session abgelaufen / ungültig: Auto-ReLogin versuchen
    if (resp.status === 401 || resp.status === 403) {
        if (account.status === 'BROKEN_NEEDS_USER') {
            throw new Error('VTJ-Credentials sind ungültig. Bitte neu einloggen.');
        }

        // Auto-ReLogin
        account = await vtjReloginWithStoredCredentials(userId);

        // 2. Versuch mit neuer Session
        resp = await callOnce(account.vtjSession);
        if (resp.ok) {
            const data = await resp.json().catch(() => null);
            return data;
        }

        if (resp.status === 401 || resp.status === 403) {
            markVtjAccountBroken(userId);
            throw new Error('VTJ-Session auch nach Auto-ReLogin ungültig. Bitte neu einloggen.');
        }

        const text = await resp.text().catch(() => '');
        throw new Error(`Depot-API-Fehler nach Auto-ReLogin: HTTP ${resp.status} ${text}`);
    }

    // Andere Fehler (z.B. 500)
    const text = await resp.text().catch(() => '');
    throw new Error(`Depot-API-Fehler: HTTP ${resp.status} ${text}`);
}
