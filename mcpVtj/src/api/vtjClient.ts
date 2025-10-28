import axios, { AxiosInstance, AxiosError } from 'axios';
import { VTJLoginResponse } from '../auth/types.js';

// VTJ-API-Basis-URL aus der Umgebung
const VTJ_API_BASE_URL = process.env.VTJ_API_BASE_URL || 'https://api-beta.visualtradingjournal.com';


const API_TIMEOUT = 30000;

/**
 * Erstellt eine Axios-Instanz für VTJ-API-Aufrufe
 */
const createVTJClient = (): AxiosInstance => {
  return axios.create({
    baseURL: VTJ_API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
};

/**
 * Behandelt API-Fehler und wandelt sie in verständliche Fehlermeldungen um
 */
function handleAPIError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    if (axiosError.response) {
      // Server hat mit Fehlerstatus geantwortet
      const status = axiosError.response.status;
      const data = axiosError.response.data;

      throw new Error(`VTJ API Error (${status}): ${JSON.stringify(data)}`);
    } else if (axiosError.request) {
      // Anfrage gesendet, aber keine Antwort erhalten
      throw new Error('VTJ API Error: No response from server. Check your network connection.');
    } else {
      // Fehler bei der Anfragevorbereitung
      throw new Error(`VTJ API Error: ${axiosError.message}`);
    }
  }

  throw new Error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

/**
 * Meldet sich bei der VTJ-API an und ruft Sitzungsinformationen ab
 * @param username - VTJ-Benutzername/E-Mail
 * @param password - VTJ-Passwort
 * @returns Login-Antwort mit Sitzungs- und Depotinformationen
 */
export async function login(username: string, password: string): Promise<VTJLoginResponse> {
  const client = createVTJClient();

  try {
    const response = await client.post('/api/v1/vtj/user/login', {
      username,
      password,
      client: 'vtj-app',
      version: 'v2.3.8'
    });

    const responseData = response.data;

    // Sitzungs-ID aus der Antwort extrahieren
    if (!responseData.session) {
      throw new Error('Login response missing session ID');
    }

    // Benutzerdaten extrahieren
    if (!responseData.user) {
      throw new Error('Login response missing user information');
    }

    const userData = responseData.user;

    // Depots aus dem Benutzerobjekt extrahieren
    if (!userData.depots || !Array.isArray(userData.depots) || userData.depots.length === 0) {
      throw new Error('Login response missing depots information');
    }

    // Erste Depot-ID ermitteln (VTJ verwendet das Feld _id)
    const firstDepot = userData.depots[0];
    const depotId = firstDepot._id;

    if (!depotId) {
      throw new Error('Could not extract depot ID from response');
    }

    return {
      sessionId: responseData.session,
      depotId: depotId,
      userId: userData._id,
      email: userData.email,
      message: 'Login successful'
    };
  } catch (error) {
    handleAPIError(error);
  }
}

/**
 * Ruft Depotdaten von der VTJ-API ab
 * @param sessionId - VTJ-Sitzungs-ID
 * @param depotId - Abzurufende Depot-ID
 * @returns Depotdaten-Objekt
 */
export async function getDepotData(sessionId: string, depotId: string): Promise<any> {
  const client = createVTJClient();

  try {
    const response = await client.get(`/api/v1/vtj/depot/account`, {
      params: {
        depot: depotId
      },
      headers: {
        'Accept': 'application/json',
        'session': sessionId
      }
    });

    return response.data;
  } catch (error) {
    handleAPIError(error);
  }
}
