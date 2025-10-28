import type { InternalConnectionId } from "../connection/types";
import { SessionManager } from "../session/SessionManager";
import { TokenManager } from "../token/TokenManager";
import type { SessionContext } from "../session/SessionContext";
import { VTJApiClient } from "../../vtj/VTJApiClient";
import { config } from "../../config/configManager";


export class AuthFlowController {
  constructor(
    private sessionManager: SessionManager,
    private tokenManager: TokenManager,
    private vtjApiClient: VTJApiClient
  ) {}

   requireSessionOrReturnLoginUrl(connectionId: InternalConnectionId): 
    { type: "sessionExists" } | { type: "authRequired", loginUrl: string } 
  {
    if (this.sessionManager.hasValidSession(connectionId)) {
      return { type: "sessionExists" };
    }

    const token = this.tokenManager.createToken(connectionId);
    const loginUrl = `${config.httpBaseUrl}/login?token=${token}`;
    return { type: "authRequired", loginUrl };
  }

  /**
   * Wird von der LoginRoute aufgerufen, um den Web-Login abzuschließen.
   */
  async completeLogin(token: string, username: string, password: string):
    Promise<
      | { type: "success" }
      | { type: "invalidToken" }
      | { type: "loginFailed"; reason: string }
    >
  {
    const connectionId = this.tokenManager.getConnectionIdByToken(token);
    if (!connectionId) {
      return { type: "invalidToken" };
    }

    // Versuche Login über VTJ-API
    const result = await this.vtjApiClient.login(username, password);
    if (!result.success) {
      return { type: "loginFailed", reason: result.error };
    }

    // Session speichern
    const session: SessionContext = {
      sessionId: result.sessionId,
      depotId: result.depotId,
    };
    this.sessionManager.setSession(connectionId, session);

    // Token invalidieren
    this.tokenManager.invalidateToken(token);

    return { type: "success" };
  }
  
}
export{}
