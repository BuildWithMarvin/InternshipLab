// src/vtj/types.ts

export interface VTJLoginResponseSuccess {
  success: true;
  sessionId: string;
  depotId: string;
}

export interface VTJLoginResponseError {
  success: false;
  error: string;
}

export type VTJLoginResponse = VTJLoginResponseSuccess | VTJLoginResponseError;

export interface VTJDepotResponseSuccess {
  success: true;
  data: any; // kann später typisiert werden
}

export interface VTJDepotResponse401 {
  success: false;
  isUnauthorized: true;
}

export interface VTJDepotResponseError {
  success: false;
  error: string;
  isUnauthorized?: false;
}

export type VTJDepotResponse =
  | VTJDepotResponseSuccess
  | VTJDepotResponse401
  | VTJDepotResponseError;
