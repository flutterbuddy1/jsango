import { HttpResponse, HttpStatus } from '@jsango/http';
import { BaseSchema, schema } from './schema.js';
function normalizeValidator(validatorOrShape) {
    if (validatorOrShape instanceof BaseSchema || (typeof validatorOrShape === 'object' && 'validate' in validatorOrShape)) {
        return validatorOrShape;
    }
    return schema(validatorOrShape);
}
/**
 * Route middleware that automatically validates incoming request body, query, and params.
 * Returns HTTP 400 Bad Request with structured field error details if validation fails.
 */
export function validate(options) {
    let bodyValidator;
    let queryValidator;
    let paramsValidator;
    if (typeof options === 'object' &&
        options !== null &&
        !('validate' in options) &&
        ('body' in options || 'query' in options || 'params' in options)) {
        const opts = options;
        if (opts.body)
            bodyValidator = normalizeValidator(opts.body);
        if (opts.query)
            queryValidator = normalizeValidator(opts.query);
        if (opts.params)
            paramsValidator = normalizeValidator(opts.params);
    }
    else {
        // Shorthand for body validation: validate(schema({ name: string() })) or validate({ name: string() })
        bodyValidator = normalizeValidator(options);
    }
    return async (ctx, next) => {
        const allErrors = [];
        // 1. Validate Body
        if (bodyValidator) {
            let rawBody;
            try {
                rawBody = await ctx.request.body.json().catch(() => ({}));
            }
            catch {
                rawBody = {};
            }
            const res = await bodyValidator.validate(rawBody);
            if (res.success) {
                ctx.state.set('validatedBody', res.data);
            }
            else {
                allErrors.push(...res.errors);
            }
        }
        // 2. Validate Query
        if (queryValidator) {
            const rawQuery = {};
            for (const [k, v] of ctx.request.query.entries()) {
                rawQuery[k] = v;
            }
            const res = await queryValidator.validate(rawQuery);
            if (res.success) {
                ctx.state.set('validatedQuery', res.data);
            }
            else {
                allErrors.push(...res.errors);
            }
        }
        // 3. Validate Params
        if (paramsValidator) {
            const rawParams = (ctx.request.params || {});
            const res = await paramsValidator.validate(rawParams);
            if (res.success) {
                ctx.state.set('validatedParams', res.data);
            }
            else {
                allErrors.push(...res.errors);
            }
        }
        if (allErrors.length > 0) {
            return HttpResponse.json({
                error: {
                    code: 'ERR_VALIDATION_FAILED',
                    message: 'Validation failed for incoming request.',
                    details: allErrors,
                },
            }, { status: HttpStatus.BAD_REQUEST });
        }
        return next();
    };
}
//# sourceMappingURL=middleware.js.map