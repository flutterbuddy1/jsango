import { HttpResponse, type RequestContext } from '@jsango/http';
import type { MiddlewareHandler } from './types.js';

export interface CorsOptions {
  /** Allowed origins (`['https://app.example.com']`), or `'*'` for any (never with credentials). */
  readonly origin: readonly string[] | '*';
  /** Send cookies / Authorization cross-origin. Default false. */
  readonly credentials?: boolean;
  /** Default: GET, HEAD, POST, PUT, PATCH, DELETE. */
  readonly methods?: readonly string[];
  /** Default: the headers the browser asks for. */
  readonly headers?: readonly string[];
  /** Preflight cache in seconds. Default 600. */
  readonly maxAge?: number;
}

/**
 * CORS for browser apps on other origins: `app.use(cors({ origin: ['https://app.example.com'] }))`.
 * Answers preflight (OPTIONS) requests itself. Unknown origins get no CORS headers (the browser
 * then blocks the response).
 */
export function cors(options: CorsOptions): MiddlewareHandler {
  if (options.origin === '*' && options.credentials) {
    throw new Error("cors(): origin '*' can't be combined with credentials; list the origins.");
  }
  const methods = (options.methods ?? ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']).join(', ');
  return async (ctx: RequestContext, next) => {
    const origin = ctx.request.headers.get('origin');
    const allowed =
      origin && (options.origin === '*' || options.origin.includes(origin)) ? origin : undefined;
    const preflight =
      ctx.request.method === 'OPTIONS' && ctx.request.headers.has('access-control-request-method');

    const response = preflight ? new HttpResponse(null, { status: 204 }) : await next();
    if (!allowed) return response;

    const h = response.headers;
    h.set('access-control-allow-origin', options.origin === '*' ? '*' : allowed);
    h.append('vary', 'Origin');
    if (options.credentials) h.set('access-control-allow-credentials', 'true');
    if (preflight) {
      h.set('access-control-allow-methods', methods);
      const asked = ctx.request.headers.get('access-control-request-headers');
      const allowHeaders = options.headers?.join(', ') ?? asked;
      if (allowHeaders) h.set('access-control-allow-headers', allowHeaders);
      h.set('access-control-max-age', String(options.maxAge ?? 600));
    }
    return response;
  };
}

/**
 * Safe default response headers: `app.use(securityHeaders())`. Blocks MIME sniffing and framing
 * (clickjacking), limits referrers, and enables HSTS on https requests.
 */
export function securityHeaders(
  options: { hsts?: boolean; frame?: 'DENY' | 'SAMEORIGIN' } = {}
): MiddlewareHandler {
  return async (ctx: RequestContext, next) => {
    const response = await next();
    const h = response.headers;
    const setDefault = (name: string, value: string) => {
      if (!h.has(name)) h.set(name, value);
    };
    setDefault('x-content-type-options', 'nosniff');
    setDefault('x-frame-options', options.frame ?? 'DENY');
    setDefault('referrer-policy', 'strict-origin-when-cross-origin');
    setDefault('cross-origin-opener-policy', 'same-origin');
    if (options.hsts !== false && ctx.request.protocol === 'https') {
      setDefault('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
    return response;
  };
}

/** A counter with expiry; `MemoryAuthStore` / `DatabaseAuthStore` from jsango fit. */
export interface RateLimitStore {
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  readonly max: number;
  /** Window length in seconds. Default 60. */
  readonly windowSeconds?: number;
  /** What to count by. Default: the client IP (use `createApp({ trustProxy })` behind a proxy). */
  readonly key?: (ctx: RequestContext) => string;
  /** Shared store for several instances, e.g. `new DatabaseAuthStore(...)`. Default: memory. */
  readonly store?: RateLimitStore;
}

/**
 * Limits requests per client: `app.post('/login', rateLimit({ max: 10 }), handler)` or globally
 * with `app.use(...)`. Over the limit: 429 with `Retry-After`.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const windowSeconds = options.windowSeconds ?? 60;
  const store = options.store ?? memoryCounter();
  const keyOf = options.key ?? ((ctx: RequestContext) => ctx.request.ip ?? 'unknown');
  return async (ctx: RequestContext, next) => {
    const count = await store.increment(`rl:${keyOf(ctx)}`, windowSeconds);
    if (count > options.max) {
      return HttpResponse.json(
        {
          error: {
            code: 'ERR_HTTP_TOO_MANY_REQUESTS',
            message: 'Too many requests. Try again later.',
          },
        },
        { status: 429, headers: { 'retry-after': String(windowSeconds) } }
      );
    }
    const response = await next();
    response.headers.set('ratelimit-limit', String(options.max));
    response.headers.set('ratelimit-remaining', String(Math.max(0, options.max - count)));
    return response;
  };
}

// ponytail: fixed window per instance; pass `store` (shared) when running several instances
function memoryCounter(): RateLimitStore {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    async increment(key, ttlSeconds) {
      const now = Date.now();
      if (windows.size > 10_000) {
        for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      }
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + ttlSeconds * 1000 });
        return 1;
      }
      return ++current.count;
    },
  };
}
