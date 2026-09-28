import { type HttpRequest, HttpResponse } from '@jsango/http';
import type { AdminListQuery } from './types.js';
/**
 * Parses the standard admin list query parameters from an HTTP request.
 */
export declare function parseListQuery(req: HttpRequest): AdminListQuery;
/**
 * Returns a standard Admin JSON success response.
 */
export declare function sendJson(data: unknown, status?: number): HttpResponse;
/**
 * Returns a standard Admin JSON error response.
 * Never exposes stack traces or raw error internals in production.
 */
export declare function sendError(status: number, code: string, message: string, meta?: Record<string, unknown> | undefined): HttpResponse;
/**
 * Extracts the requesting actor's IP address from standard headers.
 */
export declare function extractIpAddress(req: HttpRequest): string | undefined;
//# sourceMappingURL=http-helpers.d.ts.map