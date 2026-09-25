import { JsangoError, type ErrorMetadata, type SafeErrorResponse } from '@jsango/core';
import { HttpStatus, type HttpStatusCode } from './status.js';

export interface HttpErrorOptions {
  readonly message?: string | undefined;
  readonly code?: string | undefined;
  readonly cause?: unknown;
  readonly metadata?: ErrorMetadata | undefined;
  readonly headers?: Record<string, string> | undefined;
}

export class HttpError extends JsangoError {
  public readonly headers?: Readonly<Record<string, string>> | undefined;

  constructor(statusCode: HttpStatusCode, options: HttpErrorOptions = {}) {
    super({
      statusCode,
      code: options.code ?? `ERR_HTTP_${statusCode}`,
      message: options.message ?? `HTTP Error ${statusCode}`,
      cause: options.cause,
      metadata: options.metadata,
    });
    this.name = 'HttpError';
    this.headers = options.headers ? Object.freeze({ ...options.headers }) : undefined;
  }
}

export class BadRequestError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.BAD_REQUEST, {
      code: opts.code ?? 'ERR_HTTP_BAD_REQUEST',
      message: opts.message ?? 'Bad Request',
      ...opts,
    });
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.UNAUTHORIZED, {
      code: opts.code ?? 'ERR_HTTP_UNAUTHORIZED',
      message: opts.message ?? 'Unauthorized',
      ...opts,
    });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.FORBIDDEN, {
      code: opts.code ?? 'ERR_HTTP_FORBIDDEN',
      message: opts.message ?? 'Forbidden',
      ...opts,
    });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.NOT_FOUND, {
      code: opts.code ?? 'ERR_HTTP_NOT_FOUND',
      message: opts.message ?? 'Not Found',
      ...opts,
    });
    this.name = 'NotFoundError';
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.METHOD_NOT_ALLOWED, {
      code: opts.code ?? 'ERR_HTTP_METHOD_NOT_ALLOWED',
      message: opts.message ?? 'Method Not Allowed',
      ...opts,
    });
    this.name = 'MethodNotAllowedError';
  }
}

export class ConflictError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.CONFLICT, {
      code: opts.code ?? 'ERR_HTTP_CONFLICT',
      message: opts.message ?? 'Conflict',
      ...opts,
    });
    this.name = 'ConflictError';
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.PAYLOAD_TOO_LARGE, {
      code: opts.code ?? 'ERR_HTTP_PAYLOAD_TOO_LARGE',
      message: opts.message ?? 'Payload Too Large',
      ...opts,
    });
    this.name = 'PayloadTooLargeError';
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.UNSUPPORTED_MEDIA_TYPE, {
      code: opts.code ?? 'ERR_HTTP_UNSUPPORTED_MEDIA_TYPE',
      message: opts.message ?? 'Unsupported Media Type',
      ...opts,
    });
    this.name = 'UnsupportedMediaTypeError';
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.UNPROCESSABLE_ENTITY, {
      code: opts.code ?? 'ERR_HTTP_UNPROCESSABLE_ENTITY',
      message: opts.message ?? 'Unprocessable Entity',
      ...opts,
    });
    this.name = 'UnprocessableEntityError';
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.TOO_MANY_REQUESTS, {
      code: opts.code ?? 'ERR_HTTP_TOO_MANY_REQUESTS',
      message: opts.message ?? 'Too Many Requests',
      ...opts,
    });
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.INTERNAL_SERVER_ERROR, {
      code: opts.code ?? 'ERR_HTTP_INTERNAL_SERVER_ERROR',
      message: opts.message ?? 'Internal Server Error',
      ...opts,
    });
    this.name = 'InternalServerError';
  }
}

export class BadGatewayError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.BAD_GATEWAY, {
      code: opts.code ?? 'ERR_HTTP_BAD_GATEWAY',
      message: opts.message ?? 'Bad Gateway',
      ...opts,
    });
    this.name = 'BadGatewayError';
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.SERVICE_UNAVAILABLE, {
      code: opts.code ?? 'ERR_HTTP_SERVICE_UNAVAILABLE',
      message: opts.message ?? 'Service Unavailable',
      ...opts,
    });
    this.name = 'ServiceUnavailableError';
  }
}

export class GatewayTimeoutError extends HttpError {
  constructor(options: HttpErrorOptions | string = {}) {
    const opts = typeof options === 'string' ? { message: options } : options;
    super(HttpStatus.GATEWAY_TIMEOUT, {
      code: opts.code ?? 'ERR_HTTP_GATEWAY_TIMEOUT',
      message: opts.message ?? 'Gateway Timeout',
      ...opts,
    });
    this.name = 'GatewayTimeoutError';
  }
}

export class PayloadAlreadyConsumedError extends JsangoError {
  constructor(message = 'Request body has already been consumed.') {
    super({
      code: 'ERR_PAYLOAD_ALREADY_CONSUMED',
      message,
      statusCode: 500,
    });
    this.name = 'PayloadAlreadyConsumedError';
  }
}

export class ResponseAlreadyCommittedError extends JsangoError {
  constructor(message = 'Cannot modify response after headers or body have been committed.') {
    super({
      code: 'ERR_RESPONSE_ALREADY_COMMITTED',
      message,
      statusCode: 500,
    });
    this.name = 'ResponseAlreadyCommittedError';
  }
}

export interface HttpErrorResponseBody {
  readonly error: SafeErrorResponse;
}

export function formatHttpErrorResponse(
  error: unknown,
  isProduction = true
): { statusCode: number; body: HttpErrorResponseBody } {
  if (error instanceof JsangoError) {
    return {
      statusCode: error.statusCode,
      body: { error: error.toSafeJSON(isProduction) },
    };
  }

  // Non-framework or generic errors
  return {
    statusCode: 500,
    body: {
      error: {
        code: 'ERR_INTERNAL_ERROR',
        message: isProduction
          ? 'An internal error occurred.'
          : error instanceof Error
            ? error.message
            : 'Unknown error',
      },
    },
  };
}
