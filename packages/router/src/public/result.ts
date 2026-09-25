import type { HttpMethod } from '@jsango/http';
import type { Route, RouteHandler } from './route.js';

export interface RouteMatch {
  readonly type: 'MATCHED';
  readonly route: Route;
  readonly handler: RouteHandler;
  readonly params: Readonly<Record<string, string>>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly isHeadFallback?: boolean | undefined;
}

export interface MethodNotAllowedMatch {
  readonly type: 'METHOD_NOT_ALLOWED';
  readonly allowedMethods: readonly HttpMethod[];
  readonly pathname: string;
}

export interface NotFoundMatch {
  readonly type: 'NOT_FOUND';
  readonly pathname: string;
}

export type RouteMatchResult = RouteMatch | MethodNotAllowedMatch | NotFoundMatch;

export function isRouteMatch(result: RouteMatchResult): result is RouteMatch {
  return result.type === 'MATCHED';
}

export function isMethodNotAllowedMatch(result: RouteMatchResult): result is MethodNotAllowedMatch {
  return result.type === 'METHOD_NOT_ALLOWED';
}

export function isNotFoundMatch(result: RouteMatchResult): result is NotFoundMatch {
  return result.type === 'NOT_FOUND';
}
