import axios, { AxiosInstance, AxiosError } from 'axios';
import { VTJLoginResponse } from '../auth/types.js';

// VTJ API Base URL from environment
const VTJ_API_BASE_URL = process.env.VTJ_API_BASE_URL || 'https://api-beta.visualtradingjournal.com';

// Timeout configuration (30 seconds)
const API_TIMEOUT = 30000;

/**
 * Creates an Axios instance for VTJ API calls
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
 * Handles API errors and converts them to readable error messages
 */
function handleAPIError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    if (axiosError.response) {
      // Server responded with error status
      const status = axiosError.response.status;
      const data = axiosError.response.data;

      throw new Error(`VTJ API Error (${status}): ${JSON.stringify(data)}`);
    } else if (axiosError.request) {
      // Request was made but no response received
      throw new Error('VTJ API Error: No response from server. Check your network connection.');
    } else {
      // Error in request setup
      throw new Error(`VTJ API Error: ${axiosError.message}`);
    }
  }

  throw new Error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

/**
 * Logs in to VTJ API and retrieves session information
 * @param username - VTJ username/email
 * @param password - VTJ password
 * @returns Login response with session and depot information
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

    // Extract session ID from response
    if (!responseData.session) {
      throw new Error('Login response missing session ID');
    }

    // Extract user data
    if (!responseData.user) {
      throw new Error('Login response missing user information');
    }

    const userData = responseData.user;

    // Extract depots from user object
    if (!userData.depots || !Array.isArray(userData.depots) || userData.depots.length === 0) {
      throw new Error('Login response missing depots information');
    }

    // Get first depot ID (VTJ uses _id field)
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
 * Retrieves depot data from VTJ API
 * @param sessionId - VTJ session ID
 * @param depotId - Depot ID to retrieve
 * @returns Depot data object
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
