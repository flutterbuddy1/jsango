import type { HttpMethod, RequestContext } from '@django-js/http';
import { HttpResponse, HttpStatus } from '@django-js/http';
import { Route, type RouteHandler, type RouteOptions } from './route.js';
import { RouteGroup, type RouteGroupConfig, type RouteGroupOptions } from './group.js';
import type { IRouter } from './router-interface.js';
import type { RouteMatchResult } from './result.js';
import { RadixTree } from '../internal/radix-tree.js';
import { normalizePath } from '../internal/path-utils.js';
import {
  DuplicateRouteNameError,
  RouteNotFoundError,
  RouterLockedError,
  InvalidRoutePatternError,
} from './errors.js';

export type RouterState = 'registering' | 'compiled' | 'locked';

export class Router implements IRouter {
  private readonly tree = new RadixTree();
  private readonly registeredRoutes: Route[] = [];
  private readonly namedRoutes = new Map<string, Route>();
  private _state: RouterState = 'registering';

  public get state(): RouterState {
    return this._state;
  }

  public get isLocked(): boolean {
    return this._state === 'locked' || this._state === 'compiled';
  }

  public compile(): this {
    if (!this.isLocked) {
      this._state = 'locked';
      this.tree.lock();
    }
    return this;
  }

  public lock(): this {
    return this.compile();
  }

  private assertNotLocked(): void {
    if (this.isLocked) {
      throw new RouterLockedError();
    }
  }

  public route(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    options: RouteOptions = {}
  ): Route {
    this.assertNotLocked();
    const normalized = normalizePath(path);
    const routeInstance = new Route(method, normalized, handler, options);

    this.tree.insert(routeInstance);
    this.registeredRoutes.push(routeInstance);

    if (options.name) {
      this.registerRouteName(options.name, routeInstance);
    }

    // Intercept fluent .name() call
    const originalNameMethod = routeInstance.name.bind(routeInstance);
    routeInstance.name = (newName: string) => {
      this.registerRouteName(newName, routeInstance);
      return originalNameMethod(newName);
    };

    return routeInstance;
  }

  private registerRouteName(name: string, route: Route): void {
    const existing = this.namedRoutes.get(name);
    if (existing && existing !== route) {
      throw new DuplicateRouteNameError(name, existing.path, route.path);
    }
    this.namedRoutes.set(name, route);
  }

  public get(path: string, handler: RouteHandler, options: RouteOptions = {}): Route {
    return this.route('GET', path, handler, options);
  }

  public post(path: string, handler: RouteHandler, options: RouteOptions = {}): Route {
    return this.route('POST', path, handler, options);
  }

  public put(path: string, handler: RouteHandler, options: RouteOptions = {}): Route {
    return this.route('PUT', path, handler, options);
  }

  public patch(path: string, handler: RouteHandler, options: RouteOptions = {}): Route {
    return this.route('PATCH', path, handler, options);
  }

  public delete(path: string, handler: RouteHandler, options: RouteOptions = {}): Route {
    return this.route('DELETE', path, handler, options);
  }

  public head(path: string, handler: RouteHandler, options: RouteOptions = {}): Route {
    return this.route('HEAD', path, handler, options);
  }

  public options(path: string, handler: RouteHandler, options: RouteOptions = {}): Route {
    return this.route('OPTIONS', path, handler, options);
  }

  public group(
    prefixOrConfig: string | RouteGroupConfig,
    callback: (group: RouteGroup) => void,
    options: RouteGroupOptions = {}
  ): this {
    this.assertNotLocked();
    let prefix: string;
    let groupMetadata: Record<string, unknown> = {};
    let groupMiddleware: readonly unknown[] = [];

    if (typeof prefixOrConfig === 'string') {
      prefix = prefixOrConfig;
      groupMetadata = options.metadata ?? {};
      groupMiddleware = options.middleware ?? [];
    } else {
      prefix = prefixOrConfig.prefix;
      groupMetadata = prefixOrConfig.metadata ?? {};
      groupMiddleware = prefixOrConfig.middleware ?? [];
    }

    const groupInstance = new RouteGroup(this, prefix, {
      metadata: groupMetadata,
      middleware: groupMiddleware,
    });
    callback(groupInstance);
    return this;
  }

  public match(method: HttpMethod, path: string): RouteMatchResult {
    return this.tree.search(method, path);
  }

  public routes(): readonly Route[] {
    return Object.freeze([...this.registeredRoutes]);
  }

  public getRouteByName(name: string): Route | undefined {
    return this.namedRoutes.get(name);
  }

  public url(name: string, params: Record<string, string | number> = {}): string {
    const route = this.namedRoutes.get(name);
    if (!route) {
      throw new RouteNotFoundError(name);
    }

    let generatedPath = route.path;
    const unusedParams = { ...params };

    // Replace optional parameters: /:param? or /:param<constraint>?
    generatedPath = generatedPath.replace(
      /\/?:([a-zA-Z0-9_]+)(?:<.+?>)?\?/g,
      (match, paramName: string) => {
        const val = unusedParams[paramName];
        if (typeof val !== 'undefined') {
          delete unusedParams[paramName];
          return match.startsWith('/')
            ? `/${encodeURIComponent(String(val))}`
            : encodeURIComponent(String(val));
        }
        return '';
      }
    );

    // Replace required parameters: :param or :param<constraint>
    generatedPath = generatedPath.replace(/:([a-zA-Z0-9_]+)(?:<.+?>)?/g, (_, paramName: string) => {
      const val = unusedParams[paramName];
      if (typeof val === 'undefined') {
        throw new InvalidRoutePatternError(
          route.path,
          `Missing required route parameter "${paramName}" for route "${name}".`
        );
      }
      delete unusedParams[paramName];
      return encodeURIComponent(String(val));
    });

    // Replace *wildcards
    generatedPath = generatedPath.replace(/\*([a-zA-Z0-9_]*)/g, (_, wildcardName: string) => {
      const key = wildcardName || 'wildcard';
      const val = unusedParams[key];
      if (typeof val === 'undefined') {
        return '';
      }
      delete unusedParams[key];
      return String(val);
    });

    // Ensure generatedPath starts with / and clean duplicate slashes
    if (!generatedPath.startsWith('/')) {
      generatedPath = '/' + generatedPath;
    }
    generatedPath = generatedPath.replace(/\/+/g, '/');
    if (generatedPath.length > 1 && generatedPath.endsWith('/')) {
      generatedPath = generatedPath.slice(0, -1);
    }

    // Append extra parameters as query string
    const remainingKeys = Object.keys(unusedParams);
    if (remainingKeys.length > 0) {
      const searchParams = new URLSearchParams();
      for (const key of remainingKeys) {
        searchParams.append(key, String(unusedParams[key]));
      }
      generatedPath += `?${searchParams.toString()}`;
    }

    return generatedPath;
  }

  /**
   * Dispatches a RequestContext against the route table and returns the resulting HttpResponse.
   */
  public async handle(ctx: RequestContext): Promise<HttpResponse> {
    const match = this.match(ctx.request.method, ctx.request.pathname);

    if (match.type === 'MATCHED') {
      // Expose matched parameters on request
      (ctx.request as { params: Readonly<Record<string, string>> }).params = match.params;

      const raw = await match.handler(ctx);
      const response =
        raw instanceof HttpResponse
          ? raw
          : raw === undefined || raw === null
            ? HttpResponse.empty()
            : typeof raw === 'string'
              ? HttpResponse.text(raw)
              : HttpResponse.json(raw);

      // If HEAD request matched a GET handler via fallback, discard response body
      if (match.isHeadFallback && ctx.request.method === 'HEAD') {
        response.body = null;
      }

      return response;
    }

    if (match.type === 'METHOD_NOT_ALLOWED') {
      const allowHeader = match.allowedMethods.join(', ');
      return HttpResponse.json(
        {
          error: {
            code: 'ERR_HTTP_METHOD_NOT_ALLOWED',
            message: `Method ${ctx.request.method} is not allowed for path "${ctx.request.pathname}".`,
          },
        },
        {
          status: HttpStatus.METHOD_NOT_ALLOWED,
          headers: {
            allow: allowHeader,
          },
        }
      );
    }

    // NOT_FOUND
    return HttpResponse.json(
      {
        error: {
          code: 'ERR_HTTP_NOT_FOUND',
          message: `Cannot ${ctx.request.method} ${ctx.request.pathname}`,
        },
      },
      { status: HttpStatus.NOT_FOUND }
    );
  }
}
