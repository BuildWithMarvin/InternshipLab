// Eingabevalidierungs- und Bereinigungswerkzeuge

/**
 * Validierungsergebnis
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validierung der Login-Anfrage
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Bereinigt einen String durch Entfernen potenziell gefährlicher Zeichen,
 * wobei gültige Eingaben erhalten bleiben
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Leerzeichen trimmen
  let sanitized = input.trim();

  // Länge begrenzen
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validiert den Benutzernamen
 * - Muss ein nicht-leerer String sein
 * - Länge zwischen 3 und 100 Zeichen
 * - Alphanumerisch, Punkte, Unterstriche, Bindestriche, @ erlaubt
 */
export function validateUsername(username: any): ValidationResult {
  // Prüfen, ob ein Benutzername vorhanden ist
  if (!username) {
    return {
      valid: false,
      error: 'Username is required'
    };
  }

  // Prüfen, ob der Benutzername ein String ist
  if (typeof username !== 'string') {
    return {
      valid: false,
      error: 'Username must be a string'
    };
  }

  // Bereinigen
  const sanitized = sanitizeString(username, 100);

  // Minimallänge prüfen
  if (sanitized.length < 3) {
    return {
      valid: false,
      error: 'Username must be at least 3 characters long'
    };
  }

  // Maximallänge prüfen
  if (sanitized.length > 100) {
    return {
      valid: false,
      error: 'Username must be at most 100 characters long'
    };
  }

  // Auf gültige Zeichen prüfen (alphanumerisch, Punkte, Unterstriche, Bindestriche, @)
  const usernameRegex = /^[a-zA-Z0-9._@-]+$/;
  if (!usernameRegex.test(sanitized)) {
    return {
      valid: false,
      error: 'Username contains invalid characters'
    };
  }

  return {
    valid: true,
    sanitized
  };
}

/**
 * Validiert das Passwort
 * - Muss ein nicht-leerer String sein
 * - Länge zwischen 6 und 255 Zeichen
 */
export function validatePassword(password: any): ValidationResult {
  // Prüfen, ob ein Passwort vorhanden ist
  if (!password) {
    return {
      valid: false,
      error: 'Password is required'
    };
  }

  // Prüfen, ob das Passwort ein String ist
  if (typeof password !== 'string') {
    return {
      valid: false,
      error: 'Password must be a string'
    };
  }

  // Minimallänge prüfen (Passwort nicht bereinigen, um Eingabe exakt zu bewahren)
  if (password.length < 6) {
    return {
      valid: false,
      error: 'Password must be at least 6 characters long'
    };
  }

  // Maximallänge prüfen
  if (password.length > 255) {
    return {
      valid: false,
      error: 'Password is too long'
    };
  }

  return {
    valid: true,
    sanitized: password
  };
}

/**
 * Validiert die Login-Anfrage
 */
export function validateLoginRequest(body: any): {
  valid: boolean;
  error?: string;
  data?: LoginRequest;
} {
  // Prüfen, ob ein Body vorhanden ist
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Invalid request body'
    };
  }

  // Benutzernamen validieren
  const usernameValidation = validateUsername(body.username);
  if (!usernameValidation.valid) {
    return {
      valid: false,
      error: usernameValidation.error
    };
  }

  // Passwort validieren
  const passwordValidation = validatePassword(body.password);
  if (!passwordValidation.valid) {
    return {
      valid: false,
      error: passwordValidation.error
    };
  }

  return {
    valid: true,
    data: {
      username: usernameValidation.sanitized!,
      password: passwordValidation.sanitized!
    }
  };
}

/**
 * Validiert den Token-String
 */
export function validateToken(token: any): ValidationResult {
  // Prüfen, ob ein Token vorhanden ist
  if (!token) {
    return {
      valid: false,
      error: 'Token is required'
    };
  }

  // Prüfen, ob der Token ein String ist
  if (typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token must be a string'
    };
  }

  // Leerzeichen trimmen
  const sanitized = token.trim();

  // Prüfen, ob der Token nach dem Trimmen leer ist
  if (sanitized.length === 0) {
    return {
      valid: false,
      error: 'Token cannot be empty'
    };
  }

  // Prüfen, ob der Token wie Base64 aussieht (Basisprüfung)
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  if (!base64Regex.test(sanitized)) {
    return {
      valid: false,
      error: 'Token format is invalid'
    };
  }

  return {
    valid: true,
    sanitized
  };
}

/**
 * Bereinigt Fehlermeldungen, um Informationsabfluss zu verhindern
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Liste zu bereinigender Muster
  const sensitivePatterns = [
    /password/gi,
    /secret/gi,
    /key/gi,
    /token/gi,
    /session/gi,
    /cookie/gi,
    /authorization/gi
  ];

  let sanitized = errorMessage;

  // Prüfen, ob die Meldung sensible Informationen enthält
  for (const pattern of sensitivePatterns) {
    if (pattern.test(sanitized)) {
      // Generische Fehlermeldung für sensible Informationen zurückgeben
      return 'Authentication failed. Please check your credentials.';
    }
  }

  // Länge begrenzen
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200) + '...';
  }

  return sanitized;
}
