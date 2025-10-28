import { createAuthorizationToken } from "./token.js";



export async function getAuthToken() {
  try {
    const authData = await getAuth();
    const token = createAuthorizationToken(authData);
    return token;
  } catch (error) {
    console.error("Error generating auth token:", error);
    throw error;
  }
}