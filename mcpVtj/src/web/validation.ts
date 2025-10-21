// Input Validation and Sanitization Utilities

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Login Request Validation
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * while preserving valid input
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validates username
 * - Must be a non-empty string
 * - Length between 3 and 100 characters
 * - Alphanumeric, dots, underscores, hyphens, @ allowed
 */
export function validateUsername(username: any): ValidationResult {
  // Check if username exists
  if (!username) {
    return {
      valid: false,
      error: 'Username is required'
    };
  }

  // Check if username is a string
  if (typeof username !== 'string') {
    return {
      valid: false,
      error: 'Username must be a string'
    };
  }

  // Sanitize
  const sanitized = sanitizeString(username, 100);

  // Check minimum length
  if (sanitized.length < 3) {
    return {
      valid: false,
      error: 'Username must be at least 3 characters long'
    };
  }

  // Check maximum length
  if (sanitized.length > 100) {
    return {
      valid: false,
      error: 'Username must be at most 100 characters long'
    };
  }

  // Check for valid characters (alphanumeric, dots, underscores, hyphens, @)
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
 * Validates password
 * - Must be a non-empty string
 * - Length between 6 and 255 characters
 */
export function validatePassword(password: any): ValidationResult {
  // Check if password exists
  if (!password) {
    return {
      valid: false,
      error: 'Password is required'
    };
  }

  // Check if password is a string
  if (typeof password !== 'string') {
    return {
      valid: false,
      error: 'Password must be a string'
    };
  }

  // Check minimum length (don't sanitize password to preserve exact input)
  if (password.length < 6) {
    return {
      valid: false,
      error: 'Password must be at least 6 characters long'
    };
  }

  // Check maximum length
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
 * Validates login request
 */
export function validateLoginRequest(body: any): {
  valid: boolean;
  error?: string;
  data?: LoginRequest;
} {
  // Check if body exists
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Invalid request body'
    };
  }

  // Validate username
  const usernameValidation = validateUsername(body.username);
  if (!usernameValidation.valid) {
    return {
      valid: false,
      error: usernameValidation.error
    };
  }

  // Validate password
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
 * Validates token string
 */
export function validateToken(token: any): ValidationResult {
  // Check if token exists
  if (!token) {
    return {
      valid: false,
      error: 'Token is required'
    };
  }

  // Check if token is a string
  if (typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token must be a string'
    };
  }

  // Trim whitespace
  const sanitized = token.trim();

  // Check if token is empty after trimming
  if (sanitized.length === 0) {
    return {
      valid: false,
      error: 'Token cannot be empty'
    };
  }

  // Check if token looks like base64 (basic check)
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
 * Sanitizes error messages to prevent information leakage
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  // List of patterns to sanitize
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

  // Check if message contains sensitive information
  for (const pattern of sensitivePatterns) {
    if (pattern.test(sanitized)) {
      // Return generic error for sensitive information
      return 'Authentication failed. Please check your credentials.';
    }
  }

  // Limit length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200) + '...';
  }

  return sanitized;
}
