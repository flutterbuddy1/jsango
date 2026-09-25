import { JsangoError, type ErrorMetadata } from '@jsango/core';

export class RouterError extends JsangoError {
  constructor(code: string, message: string, metadata?: ErrorMetadata) {
    super({
      code,
      message,
      metadata,
      statusCode: 500,
    });
    this.name = 'RouterError';
  }
}

export class DuplicateRouteError extends RouterError {
  constructor(method: string, path: string) {
    super(
      'ERR_ROUTER_DUPLICATE_ROUTE',
      `Duplicate route definition: [${method}] "${path}" is already registered.`,
      { method, path }
    );
    this.name = 'DuplicateRouteError';
  }
}

export class DuplicateRouteNameError extends RouterError {
  constructor(name: string, existingPath: string, newPath: string) {
    super(
      'ERR_ROUTER_DUPLICATE_NAME',
      `Duplicate route name: "${name}" is already assigned to "${existingPath}", cannot assign to "${newPath}".`,
      { name, existingPath, newPath }
    );
    this.name = 'DuplicateRouteNameError';
  }
}

export class InvalidRoutePatternError extends RouterError {
  constructor(path: string, reason: string) {
    super('ERR_ROUTER_INVALID_PATTERN', `Invalid route pattern "${path}": ${reason}`, {
      path,
      reason,
    });
    this.name = 'InvalidRoutePatternError';
  }
}

export class RouterLockedError extends RouterError {
  constructor(action = 'register new routes') {
    super('ERR_ROUTER_LOCKED', `Router is locked/compiled. Cannot ${action} after compilation.`, {
      action,
    });
    this.name = 'RouterLockedError';
  }
}

export class RouteNotFoundError extends RouterError {
  constructor(name: string) {
    super('ERR_ROUTER_NOT_FOUND', `Route with name "${name}" was not found.`, { name });
    this.name = 'RouteNotFoundError';
  }
}
