// src/core/token/TokenEntry.ts
import type { InternalConnectionId } from "../connection/types";

export interface TokenEntry {
  token: string;
  connectionId: InternalConnectionId;
  // Optional: Verfallszeitpunkt (kann bei Bedarf später genutzt werden)
  expiresAt?: Date;
}
