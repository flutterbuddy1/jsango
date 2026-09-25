import { DjangoJsError } from '@django-js/core';

export class AdminError extends DjangoJsError {
  constructor(options: {
    readonly code?: string | undefined;
    readonly message: string;
    readonly statusCode?: number | undefined;
    readonly cause?: unknown | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
  }) {
    super({
      code: options.code ?? 'ERR_ADMIN',
      message: options.message,
      statusCode: options.statusCode ?? 400,
      cause: options.cause,
      metadata: options.metadata,
    });
  }
}

export class AdminRegistrationError extends AdminError {
  constructor(options: {
    readonly code?: string | undefined;
    readonly message: string;
    readonly cause?: unknown | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
  }) {
    super({
      code: options.code ?? 'ERR_ADMIN_REGISTRATION',
      message: options.message,
      cause: options.cause,
      metadata: options.metadata,
    });
  }
}

export class AdminResourceNotFoundError extends AdminError {
  constructor(resourceName: string) {
    super({
      code: 'ERR_ADMIN_RESOURCE_NOT_FOUND',
      message: `Admin resource "${resourceName}" was not found.`,
      statusCode: 404,
      metadata: { resource: resourceName },
    });
  }
}

export class AdminItemNotFoundError extends AdminError {
  constructor(resourceName: string, id: string | number) {
    super({
      code: 'ERR_ADMIN_ITEM_NOT_FOUND',
      message: `Item "${id}" in resource "${resourceName}" was not found.`,
      statusCode: 404,
      metadata: { resource: resourceName, id },
    });
  }
}

export class AdminValidationError extends AdminError {
  constructor(options: {
    readonly message: string;
    readonly errors: readonly unknown[];
    readonly metadata?: Record<string, unknown> | undefined;
  }) {
    super({
      code: 'ERR_ADMIN_VALIDATION',
      message: options.message,
      statusCode: 422,
      metadata: { ...options.metadata, errors: options.errors },
    });
  }
}

export class AdminAuthorizationError extends AdminError {
  constructor(options: {
    readonly message?: string | undefined;
    readonly resource?: string | undefined;
    readonly action?: string | undefined;
    readonly field?: string | undefined;
  }) {
    super({
      code: 'ERR_ADMIN_FORBIDDEN',
      message: options.message ?? 'You do not have permission to perform this admin operation.',
      statusCode: 403,
      metadata: {
        resource: options.resource,
        action: options.action,
        field: options.field,
      },
    });
  }
}

export class AdminActionError extends AdminError {
  constructor(options: {
    readonly actionName: string;
    readonly message: string;
    readonly cause?: unknown | undefined;
  }) {
    super({
      code: 'ERR_ADMIN_ACTION_FAILED',
      message: `Admin action "${options.actionName}" failed: ${options.message}`,
      cause: options.cause,
      metadata: { action: options.actionName },
    });
  }
}
