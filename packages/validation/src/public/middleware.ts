import { HttpResponse, HttpStatus, type RequestContext } from '@jsango/http';
import type { IValidator, ValidationErrorItem } from './validation.js';
import { BaseSchema, schema } from './schema.js';

export interface ValidationMiddlewareOptions {
  readonly body?: IValidator<any> | Record<string, BaseSchema<any>> | undefined;
  readonly query?: IValidator<any> | Record<string, BaseSchema<any>> | undefined;
  readonly params?: IValidator<any> | Record<string, BaseSchema<any>> | undefined;
}

export type ValidationTarget =
  ValidationMiddlewareOptions | IValidator<any> | Record<string, BaseSchema<any>>;

function normalizeValidator(
  validatorOrShape: IValidator<any> | Record<string, BaseSchema<any>>
): IValidator<any> {
  if (
    validatorOrShape instanceof BaseSchema ||
    (typeof validatorOrShape === 'object' && 'validate' in validatorOrShape)
  ) {
    return validatorOrShape as IValidator<any>;
  }
  return schema(validatorOrShape as Record<string, BaseSchema<any>>);
}

/**
 * Route middleware that automatically validates incoming request body, query, and params.
 * Returns HTTP 400 Bad Request with structured field error details if validation fails.
 */
export function validate(options: ValidationTarget) {
  let bodyValidator: IValidator<any> | undefined;
  let queryValidator: IValidator<any> | undefined;
  let paramsValidator: IValidator<any> | undefined;

  if (
    typeof options === 'object' &&
    options !== null &&
    !('validate' in options) &&
    ('body' in options || 'query' in options || 'params' in options)
  ) {
    const opts = options as ValidationMiddlewareOptions;
    if (opts.body) bodyValidator = normalizeValidator(opts.body);
    if (opts.query) queryValidator = normalizeValidator(opts.query);
    if (opts.params) paramsValidator = normalizeValidator(opts.params);
  } else {
    // Shorthand for body validation: validate(schema({ name: string() })) or validate({ name: string() })
    bodyValidator = normalizeValidator(
      options as IValidator<any> | Record<string, BaseSchema<any>>
    );
  }

  return async (
    ctx: RequestContext,
    next: () => Promise<HttpResponse | unknown>
  ): Promise<HttpResponse | unknown> => {
    const allErrors: ValidationErrorItem[] = [];

    // 1. Validate Body
    if (bodyValidator) {
      let rawBody: unknown;
      try {
        rawBody = await ctx.request.body.json().catch(() => ({}));
      } catch {
        rawBody = {};
      }
      const res = await bodyValidator.validate(rawBody);
      if (res.success) {
        ctx.state.set('validatedBody', res.data);
      } else {
        allErrors.push(...res.errors);
      }
    }

    // 2. Validate Query
    if (queryValidator) {
      const rawQuery: Record<string, string | readonly string[]> = {};
      for (const [k, v] of ctx.request.query.entries()) {
        rawQuery[k] = v;
      }
      const res = await queryValidator.validate(rawQuery);
      if (res.success) {
        ctx.state.set('validatedQuery', res.data);
      } else {
        allErrors.push(...res.errors);
      }
    }

    // 3. Validate Params
    if (paramsValidator) {
      const rawParams = (ctx.request.params || {}) as Record<string, string>;
      const res = await paramsValidator.validate(rawParams);
      if (res.success) {
        ctx.state.set('validatedParams', res.data);
      } else {
        allErrors.push(...res.errors);
      }
    }

    if (allErrors.length > 0) {
      return HttpResponse.json(
        {
          error: {
            code: 'ERR_VALIDATION_FAILED',
            message: 'Validation failed for incoming request.',
            details: allErrors,
          },
        },
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    return next();
  };
}
