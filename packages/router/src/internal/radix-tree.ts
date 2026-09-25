import type { HttpMethod } from '@jsango/http';
import { RadixNode } from './radix-node.js';
import type { Route } from '../public/route.js';
import type { RouteMatchResult } from '../public/result.js';
import { resolveConstraint, type CompiledConstraint } from '../public/constraints.js';
import {
  DuplicateRouteError,
  InvalidRoutePatternError,
  RouterLockedError,
} from '../public/errors.js';
import { normalizePath, splitSegments, safeDecodeParam } from './path-utils.js';

const EMPTY_PARAMS: Readonly<Record<string, string>> = Object.freeze({});

export class RadixTree {
  private readonly root = new RadixNode();
  private readonly staticRouteMap = new Map<string, Map<HttpMethod, Route>>();
  private _isLocked = false;

  public get isLocked(): boolean {
    return this._isLocked;
  }

  public lock(): void {
    this._isLocked = true;
  }

  public insert(route: Route): void {
    if (this._isLocked) {
      throw new RouterLockedError();
    }

    const path = normalizePath(route.path);

    // Track pure static routes for O(1) matching fast path
    if (!path.includes(':') && !path.includes('*') && !path.includes('?')) {
      let methodMap = this.staticRouteMap.get(path);
      if (!methodMap) {
        methodMap = new Map<HttpMethod, Route>();
        this.staticRouteMap.set(path, methodMap);
      }
      if (methodMap.has(route.method)) {
        throw new DuplicateRouteError(route.method, route.path);
      }
      methodMap.set(route.method, route);
    }

    // Check for optional parameter at the end (e.g. /users/:id? or /users/:id<number>? or /:id?)
    if (path.includes('?')) {
      const match = path.match(/^(.*?)\/:([a-zA-Z0-9_]+)(?:<(.+?)>)?\?$/);
      if (match) {
        const basePath = match[1] || '/';
        const paramName = match[2]!;
        const constraintPart = match[3] ? `<${match[3]}>` : '';
        // Insert branch without optional param
        this.insertSegments(splitSegments(basePath), route, []);
        // Insert branch with optional param
        const fullChildPath =
          basePath === '/'
            ? `/:${paramName}${constraintPart}`
            : `${basePath}/:${paramName}${constraintPart}`;
        this.insertSegments(splitSegments(fullChildPath), route, [paramName]);
        return;
      }
      throw new InvalidRoutePatternError(
        path,
        'Optional parameters are only supported as the trailing segment (e.g. /path/:id?).'
      );
    }

    const segments = splitSegments(path);
    const paramNames: string[] = [];
    this.insertSegments(segments, route, paramNames);
  }

  private insertSegments(segments: string[], route: Route, extractedParamNames: string[]): void {
    let current = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;

      // Wildcard segment (*path)
      if (segment.startsWith('*')) {
        if (i !== segments.length - 1) {
          throw new InvalidRoutePatternError(
            route.path,
            'Wildcard segments must appear at the end of the route path.'
          );
        }

        const wildcardName = segment.slice(1) || 'wildcard';
        extractedParamNames.push(wildcardName);

        if (!current.wildcardChild) {
          current.wildcardChild = {
            paramName: wildcardName,
            node: new RadixNode(),
          };
        }
        current = current.wildcardChild.node;
        continue;
      }

      // Parameter segment (:param or :param<constraint>)
      if (segment.startsWith(':')) {
        let paramName = segment.slice(1);
        let constraint: CompiledConstraint | undefined;
        let constraintKey: string | undefined;

        // Check for inline constraint syntax :id<number>
        const constraintMatch = paramName.match(/^([a-zA-Z0-9_]+)<(.+)>$/);
        if (constraintMatch) {
          paramName = constraintMatch[1]!;
          const constraintDef = constraintMatch[2]!;
          constraint = resolveConstraint(constraintDef);
          constraintKey = constraintDef;
        } else if (route.constraints[paramName]) {
          const rawConstraint = route.constraints[paramName]!;
          constraint = resolveConstraint(rawConstraint);
          constraintKey = typeof rawConstraint === 'string' ? rawConstraint : 'custom';
        }

        extractedParamNames.push(paramName);

        // Check existing param child with same name and constraint
        const existingChild = current.paramChildren.find(
          (c) => c.paramName === paramName && c.constraintDef === constraintKey
        );

        if (!existingChild) {
          const newNode = new RadixNode();
          const newChild = {
            paramName,
            constraintDef: constraintKey,
            constraint,
            node: newNode,
          };

          // Prioritize: constrained parameters come before unconstrained ones
          if (constraint) {
            const firstUnconstrainedIdx = current.paramChildren.findIndex((c) => !c.constraint);
            if (firstUnconstrainedIdx === -1) {
              current.paramChildren.push(newChild);
            } else {
              current.paramChildren.splice(firstUnconstrainedIdx, 0, newChild);
            }
          } else {
            current.paramChildren.push(newChild);
          }
          current = newNode;
        } else {
          current = existingChild.node;
        }
        continue;
      }

      // Static segment
      let nextNode = current.staticChildren.get(segment);
      if (!nextNode) {
        nextNode = new RadixNode();
        current.staticChildren.set(segment, nextNode);
      }
      current = nextNode;
    }

    // Terminal node
    if (current.routes.has(route.method)) {
      throw new DuplicateRouteError(route.method, route.path);
    }

    current.routes.set(route.method, route);
  }

  public search(method: HttpMethod, rawPath: string): RouteMatchResult {
    const pathname = normalizePath(rawPath);

    // O(1) Fast path for pure static routes
    const staticRoutes = this.staticRouteMap.get(pathname);
    if (staticRoutes) {
      const exactRoute = staticRoutes.get(method);
      if (exactRoute) {
        return {
          type: 'MATCHED',
          route: exactRoute,
          handler: exactRoute.handler,
          params: EMPTY_PARAMS,
          metadata: exactRoute.metadata,
        };
      }

      if (method === 'HEAD') {
        const getRoute = staticRoutes.get('GET');
        if (getRoute) {
          return {
            type: 'MATCHED',
            route: getRoute,
            handler: getRoute.handler,
            params: EMPTY_PARAMS,
            metadata: getRoute.metadata,
            isHeadFallback: true,
          };
        }
      }

      const allowed = new Set<HttpMethod>(staticRoutes.keys());
      if (staticRoutes.has('GET')) {
        allowed.add('HEAD');
      }

      return {
        type: 'METHOD_NOT_ALLOWED',
        allowedMethods: Object.freeze(Array.from(allowed)),
        pathname,
      };
    }

    const segments = splitSegments(pathname);

    interface MatchCandidate {
      node: RadixNode;
      params: Record<string, string>;
    }

    // Search algorithm with strict deterministic precedence:
    // Static > Constrained Param > Generic Param > Wildcard
    function findNode(
      node: RadixNode,
      index: number,
      collectedParams: Record<string, string>
    ): MatchCandidate | null {
      // If all segments consumed
      if (index === segments.length) {
        // Must have at least one route registered or wildcard
        if (node.routes.size > 0) {
          return { node, params: collectedParams };
        }
        // If node has wildcard child with empty match
        if (node.wildcardChild && node.wildcardChild.node.routes.size > 0) {
          return {
            node: node.wildcardChild.node,
            params: { ...collectedParams, [node.wildcardChild.paramName]: '' },
          };
        }
        return null;
      }

      const segment = segments[index]!;

      // 1. Static match (Highest Priority)
      const staticChild = node.staticChildren.get(segment);
      if (staticChild) {
        const res = findNode(staticChild, index + 1, collectedParams);
        if (res) return res;
      }

      // 2. Parameter match (Constrained params are ordered before generic params)
      for (const paramChild of node.paramChildren) {
        if (paramChild.constraint && !paramChild.constraint(segment)) {
          continue;
        }
        const decoded = safeDecodeParam(segment);
        const nextParams = { ...collectedParams, [paramChild.paramName]: decoded };
        const res = findNode(paramChild.node, index + 1, nextParams);
        if (res) return res;
      }

      // 3. Wildcard match (Lowest Priority)
      if (node.wildcardChild) {
        const remainder = segments.slice(index).map(safeDecodeParam).join('/');

        const nextParams = {
          ...collectedParams,
          [node.wildcardChild.paramName]: remainder,
        };

        if (node.wildcardChild.node.routes.size > 0) {
          return { node: node.wildcardChild.node, params: nextParams };
        }
      }

      return null;
    }

    const candidate = findNode(this.root, 0, {});

    if (!candidate) {
      return {
        type: 'NOT_FOUND',
        pathname,
      };
    }

    const { node, params } = candidate;

    // 1. Exact HTTP method match
    const exactRoute = node.routes.get(method);
    if (exactRoute) {
      return {
        type: 'MATCHED',
        route: exactRoute,
        handler: exactRoute.handler,
        params: Object.freeze(params),
        metadata: exactRoute.metadata,
      };
    }

    // 2. HEAD fallback: RFC 7231 allows automatic fallback to GET handler
    if (method === 'HEAD') {
      const getRoute = node.routes.get('GET');
      if (getRoute) {
        return {
          type: 'MATCHED',
          route: getRoute,
          handler: getRoute.handler,
          params: Object.freeze(params),
          metadata: getRoute.metadata,
          isHeadFallback: true,
        };
      }
    }

    // 3. Method Not Allowed (405)
    const allowed = new Set<HttpMethod>(node.routes.keys());
    if (node.routes.has('GET')) {
      allowed.add('HEAD');
    }

    return {
      type: 'METHOD_NOT_ALLOWED',
      allowedMethods: Object.freeze(Array.from(allowed)),
      pathname,
    };
  }
}
