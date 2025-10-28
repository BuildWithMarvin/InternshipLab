// src/vtj/VTJApiClient.ts

import axios, { AxiosError } from "axios";
import { config } from "../config/configManager";
import type { VTJLoginResponse, VTJDepotResponse } from "./types";
import type { SessionContext } from "../core/session/SessionContext";

export class VTJApiClient {
  /**
   * Login beim VTJ-Server.
   * Erwartet, dass die API so etwas wie sessionId + depotId liefert.
   */
  async login(username: string, password: string): Promise<VTJLoginResponse> {
    try {
      const response = await axios.post(`${config.vtjApiUrl}/user/login`, {
        username,
        password,
        "client": "vtj-app",
        "version": "v2.3.8"
      });

      const responseData = response.data;

         if (!responseData.session) {
      throw new Error('Login response missing session ID');
    }
      
       if (!responseData.user) {
      throw new Error('Login response missing user information');
    }
      const userData = responseData.user;

        if (!userData.depots || !Array.isArray(userData.depots) || userData.depots.length === 0) {
      throw new Error('Login response missing depots information');
    }

     const firstDepot = userData.depots[0];
    const depotId = firstDepot._id;

      return {
        success: true,
        sessionId: responseData.session,
        depotId,
      };
    } catch (err) {
      const error = err as AxiosError;
      return {
        success: false,
        error: error.message || "Login fehlgeschlagen",
      };
    }
  }

  /**
   * Beispiel: Depot-Daten abrufen.
   * Verwendet die bestehende Session über sessionId.
   */
  async getDepotData(session: SessionContext): Promise<VTJDepotResponse> {
    try {
      const response = await axios.get(`${config.vtjApiUrl}/depot`, {
        headers: {
          "x-session-id": session.sessionId, // abhängig von VTJ-API
          "x-depot-id": session.depotId,
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (err) {
      const error = err as AxiosError;

      // Prüfen, ob die API mit 401 antwortet → Session ungültig
      if (error.response && error.response.status === 401) {
        return { success: false, isUnauthorized: true };
      }

      return {
        success: false,
        error: error.message || "API Fehler",
      };
    }
  }
}
