import type { ServiceErrorCode } from '@nuanban/contracts';

export type ServerErrorCode = ServiceErrorCode;

export interface ErrorDetails {
  current_version?: number;
  conflict_id?: string;
}

export class DomainError extends Error {
  readonly status: number;
  readonly code: ServerErrorCode;
  readonly retryable: boolean;
  readonly details?: ErrorDetails;

  constructor(status: number, code: ServerErrorCode, message: string, retryable = false, details?: ErrorDetails) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function invalidRequest(message: string): DomainError {
  return new DomainError(400, 'INVALID_REQUEST', message);
}

export function authenticationFailed(message = 'Authentication failed'): DomainError {
  return new DomainError(401, 'AUTH_FAILED', message);
}

export function authenticationExpired(message = 'Authentication expired'): DomainError {
  return new DomainError(401, 'AUTH_EXPIRED', message);
}

export function permissionDenied(message = 'Permission denied'): DomainError {
  return new DomainError(403, 'PERMISSION_DENIED', message);
}

export function scopeDenied(message = 'Requested scope is not granted'): DomainError {
  return new DomainError(403, 'SCOPE_DENIED', message);
}

export function consentRequired(message = 'A current consent is required'): DomainError {
  return new DomainError(403, 'CONSENT_REQUIRED', message);
}

