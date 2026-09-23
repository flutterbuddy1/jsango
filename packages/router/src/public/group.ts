import type { HttpMethod } from '@django-js/http';
import { Route, type RouteHandler, type RouteOptions } from './route.js';
import type { IRouter } from './router-interface.js';
import { joinPaths } from '../internal/path-utils.js';

export interface RouteGroupConfig {
  readonly prefix: string;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly middleware?: readonly unknown[] | undefined;
}

export interface RouteGroupOptions {
  readonly metadata?: Record<string, unknown> | undefined;
  readonly middleware?: readonly unknown[] | undefined;
}

export class RouteGroup {
  private readonly router: IRouter;
  public readonly prefix: string;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly middleware: readonly unknown[];

  constructor(router: IRouter, prefix: string, options: RouteGroupOptions = {}) {
    this.router = router;
    this.prefix = prefix;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.middleware = Object.freeze([...(options.middleware ?? [])]);
  }

  public route(
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    options: RouteOptions = {}
  ): Route {
    const fullPath = joinPaths(this.prefix, path);
    const mergedMetadata = {
      ...this.metadata,
      ...(options.metadata ?? {}),
    };
    const mergedMiddleware = [...this.middleware, ...(options.middleware ?? [])];
    return this.router.route(method, fullPath, handler, {
      ...options,
      metadata: mergedMetadata,
      middleware: mergedMiddleware,
    });
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
    let subPrefix: string;
    let groupMetadata: Record<string, unknown> = {};
    let groupMiddleware: readonly unknown[] = [];

    if (typeof prefixOrConfig === 'string') {
      subPrefix = prefixOrConfig;
      groupMetadata = options.metadata ?? {};
      groupMiddleware = options.middleware ?? [];
    } else {
      subPrefix = prefixOrConfig.prefix;
      groupMetadata = prefixOrConfig.metadata ?? {};
      groupMiddleware = prefixOrConfig.middleware ?? [];
    }

    const fullPrefix = joinPaths(this.prefix, subPrefix);
    const mergedMetadata = {
      ...this.metadata,
      ...groupMetadata,
    };
    const mergedMiddleware = [...this.middleware, ...groupMiddleware];
    const subGroup = new RouteGroup(this.router, fullPrefix, {
      metadata: mergedMetadata,
      middleware: mergedMiddleware,
    });
    callback(subGroup);
    return this;
  }
}
