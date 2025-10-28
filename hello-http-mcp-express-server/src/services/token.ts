import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

const APP_SECRET = process.env.APP_SECRET || "super_secret_key";

interface TokenPayload {
  sub?: string;          // User-ID (nur im Access Token)
  scope?: string;        // Scopes (nur im Access Token)
  client_id: string;     // ID des Clients
  redirect_uri?: string; // für Authorization Token
}

/**
 * Erzeugt ein Authorization Token (ähnlich einem Authorization Code).
 * Dieses Token enthält KEINE Userdaten und hat eine kurze Lebensdauer.
 */
export function createAuthorizationToken(payload: Pick<TokenPayload, "client_id" | "redirect_uri">): string {
  // Man könnte auch einfach randomBytes(32).toString("hex") zurückgeben,
  // falls du lieber serverseitig eine Zuordnung speichern willst.
  return jwt.sign(
    {
      type: "authorization_token",
      client_id: payload.client_id,
      redirect_uri: payload.redirect_uri,
      jti: randomBytes(8).toString("hex"), // eindeutige ID des Tokens
    },
    APP_SECRET,
    { expiresIn: "2m", issuer: "my-oauth-server" } // sehr kurzlebig
  );
}

/**
 * Erzeugt ein Access Token mit User-ID, Scope und längerer Laufzeit.
 */
export function createAccessToken(payload: Pick<TokenPayload, "sub" | "scope" | "client_id">): string {
  return jwt.sign(
    {
      type: "access_token",
      sub: payload.sub,             // Benutzer-ID
      scope: payload.scope,         // Genehmigte Scopes
      client_id: payload.client_id, // zugehörige Client-App
    },
    APP_SECRET,
    { expiresIn: "1h", issuer: "my-oauth-server", audience: "resource-api" }
  );
}

/**
 * Beispielhafte Nutzung:
 */
const authorizationToken = createAuthorizationToken({
  client_id: "spotify-client",
  redirect_uri: "https://app.example.com/callback",
});

console.log("Authorization Token:", authorizationToken);

// Später, wenn der Code eingelöst wird (nach Login)
const accessToken = createAccessToken({
  sub: "user_12345",       // kommt aus der Nutzer-Session
  scope: "read:profile",   // genehmigte Scopes
  client_id: "spotify-client",
});

console.log("Access Token:", accessToken);
