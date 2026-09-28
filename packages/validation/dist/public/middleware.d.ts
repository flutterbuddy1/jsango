import { HttpResponse, type RequestContext } from '@jsango/http';
import type { IValidator } from './validation.js';
import { BaseSchema } from './schema.js';
export interface ValidationMiddlewareOptions {
    readonly body?: IValidator<any> | Record<string, BaseSchema<any>> | undefined;
    readonly query?: IValidator<any> | Record<string, BaseSchema<any>> | undefined;
    readonly params?: IValidator<any> | Record<string, BaseSchema<any>> | undefined;
}
export type ValidationTarget = ValidationMiddlewareOptions | IValidator<any> | Record<string, BaseSchema<any>>;
/**
 * Route middleware that automatically validates incoming request body, query, and params.
 * Returns HTTP 400 Bad Request with structured field error details if validation fails.
 */
export declare function validate(options: ValidationTarget): (ctx: RequestContext, next: () => Promise<HttpResponse | unknown>) => Promise<HttpResponse | unknown>;
//# sourceMappingURL=middleware.d.ts.map