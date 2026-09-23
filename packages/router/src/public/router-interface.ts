import type { HttpMethod } from '@django-js/http';
import type { Route, RouteHandler, RouteOptions } from './route.js';
import type { RouteGroup, RouteGroupConfig, RouteGroupOptions } from './group.js';
import type { RouteMatchResult } from './result.js';

export interface IRouter {
  route(method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions): Route;
  get(path: string, handler: RouteHandler, options?: RouteOptions): Route;
  post(path: string, handler: RouteHandler, options?: RouteOptions): Route;
  put(path: string, handler: RouteHandler, options?: RouteOptions): Route;
  patch(path: string, handler: RouteHandler, options?: RouteOptions): Route;
  delete(path: string, handler: RouteHandler, options?: RouteOptions): Route;
  head(path: string, handler: RouteHandler, options?: RouteOptions): Route;
  options(path: string, handler: RouteHandler, options?: RouteOptions): Route;
  group(
    prefixOrConfig: string | RouteGroupConfig,
    callback: (group: RouteGroup) => void,
    options?: RouteGroupOptions
  ): this;
  match(method: HttpMethod, path: string): RouteMatchResult;
  routes(): readonly Route[];
  url(name: string, params?: Record<string, string | number>): string;
}
