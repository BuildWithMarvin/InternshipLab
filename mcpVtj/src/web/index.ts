// Web Module Exports

export { createWebApiRouter } from './routes.js';
export type { SuccessResponse, ErrorResponse, ApiResponse } from './routes.js';

export {
  validateLoginRequest,
  validateToken,
  validateUsername,
  validatePassword,
  sanitizeString,
  sanitizeErrorMessage
} from './validation.js';

export type { ValidationResult, LoginRequest } from './validation.js';
