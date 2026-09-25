import { DjangoJsError } from '@django-js/core';

export interface AuthErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly statusCode?: number | undefined;
}

export class AuthenticationError extends DjangoJsError {
  public constructor(options: AuthErrorOptions) {
    super({
      code: options.code,
      message: options.message,
      cause: options.cause,
      metadata: options.metadata,
      statusCode: options.statusCode ?? 401,
    });
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthenticatedError extends AuthenticationError {
  public constructor(message = 'Authentication credentials are required.') {
    super({
      code: 'ERR_AUTH_UNAUTHENTICATED',
      message,
      statusCode: 401,
    });
    this.name = 'UnauthenticatedError';
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  public constructor(message = 'Invalid authentication credentials.') {
    super({
      code: 'ERR_AUTH_INVALID_CREDENTIALS',
      message,
      statusCode: 401,
    });
    this.name = 'InvalidCredentialsError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  public constructor(message = 'Authentication token has expired.') {
    super({
      code: 'ERR_AUTH_TOKEN_EXPIRED',
      message,
      statusCode: 401,
    });
    this.name = 'TokenExpiredError';
  }
}

export class SessionExpiredError extends AuthenticationError {
  public constructor(message = 'Authentication session has expired.') {
    super({
      code: 'ERR_AUTH_SESSION_EXPIRED',
      message,
      statusCode: 401,
    });
    this.name = 'SessionExpiredError';
  }
}

export class AuthorizationError extends DjangoJsError {
  public constructor(options: AuthErrorOptions) {
    super({
      code: options.code,
      message: options.message,
      cause: options.cause,
      metadata: options.metadata,
      statusCode: options.statusCode ?? 403,
    });
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ForbiddenError extends AuthorizationError {
  public constructor(message = 'You do not have permission to perform this action.') {
    super({
      code: 'ERR_AUTH_FORBIDDEN',
      message,
      statusCode: 403,
    });
    this.name = 'ForbiddenError';
  }
}

export class PolicyError extends AuthorizationError {
  public constructor(policyName: string, message?: string) {
    super({
      code: 'ERR_AUTH_POLICY_VIOLATION',
      message: message ?? `Access denied by policy "${policyName}".`,
      metadata: { policy: policyName },
      statusCode: 403,
    });
    this.name = 'PolicyError';
  }
}
