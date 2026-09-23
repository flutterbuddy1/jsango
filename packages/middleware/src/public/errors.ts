import { DjangoJsError } from '@django-js/core';

export class MiddlewareError extends DjangoJsError {}

export class MultipleNextCallsError extends MiddlewareError {
  constructor(middlewareName?: string) {
    const caller = middlewareName ? ` in middleware "${middlewareName}"` : '';
    super({
      code: 'ERR_MIDDLEWARE_MULTIPLE_NEXT_CALLS',
      message: `next() was called multiple times${caller}. A middleware may only invoke next() once.`,
      statusCode: 500,
      metadata: middlewareName ? { middleware: middlewareName } : undefined,
    });
  }
}

export class NamedMiddlewareNotFoundError extends MiddlewareError {
  constructor(name: string) {
    super({
      code: 'ERR_NAMED_MIDDLEWARE_NOT_FOUND',
      message: `Named middleware "${name}" is not registered.`,
      statusCode: 500,
      metadata: { middlewareName: name },
    });
  }
}

export class PipelineExecutionError extends MiddlewareError {
  constructor(message: string, cause?: unknown) {
    super({
      code: 'ERR_PIPELINE_EXECUTION',
      message,
      statusCode: 500,
      cause,
    });
  }
}
